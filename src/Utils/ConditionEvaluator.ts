/**
 * ConditionEvaluator — safe evaluator for pipeline `RunIf` expressions
 * (v3.0.1, ENG-C3). Replaces `new Function(...)`.
 *
 * Context values (branch, commit message, author…) are attacker-influenced,
 * so they are only ever treated as data: the expression is tokenized and
 * parsed by a tiny recursive-descent parser; nothing is executed and no
 * global is reachable.
 *
 * Grammar:
 *   expr    := or
 *   or      := and ( '||' and )*
 *   and     := unary ( '&&' unary )*
 *   unary   := '!' unary | compare
 *   compare := primary ( ( '==' | '===' | '!=' | '!==' | 'contains' ) primary )?
 *   primary := '(' expr ')' | STRING | NUMBER | 'true' | 'false'
 *            | 'hasVar' '(' STRING ')' | VARIABLE
 *   VARIABLE:= IDENT | '$' IDENT | '{{' IDENT '}}'
 *
 * Variables are looked up exactly first, then case- and underscore-
 * insensitively (so `$BRANCH` finds `Branch`). An unknown variable, an
 * unknown token or any syntax error is an evaluation failure, and callers
 * must fail closed (skip the step).
 */

export type TConditionContext = Record<string, string | undefined>;

export type TConditionResult = { Ok: true; Value: boolean } | { Ok: false; Error: string };

type TValue = string | number | boolean;

type TToken =
  | { Kind: 'string'; Value: string }
  | { Kind: 'number'; Value: number }
  | { Kind: 'ident'; Value: string }
  | { Kind: 'var'; Value: string }
  | { Kind: 'op'; Value: string }
  | { Kind: 'end' };

export const MAX_CONDITION_LENGTH = 1000;
const MAX_DEPTH = 32;
const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y;
const NUMBER = /[0-9]+(?:\.[0-9]+)?/y;
const OPERATORS = ['===', '!==', '==', '!=', '&&', '||', '!', '(', ')'];

class ConditionError extends Error {}

function Tokenize(input: string): TToken[] {
  const tokens: TToken[] = [];
  let i = 0;

  const readIdent = (at: number): string => {
    IDENT.lastIndex = at;
    const match = IDENT.exec(input);
    if (!match) throw new ConditionError(`Expected identifier at position ${at}`);
    return match[0];
  };

  while (i < input.length) {
    const ch = input[i] as string;

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      let value = '';
      let j = i + 1;
      let closed = false;
      while (j < input.length) {
        const c = input[j] as string;
        if (c === '\\') {
          const next = input[j + 1];
          if (next === undefined) break;
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next;
          j += 2;
          continue;
        }
        if (c === ch) {
          closed = true;
          j += 1;
          break;
        }
        value += c;
        j += 1;
      }
      if (!closed) throw new ConditionError('Unterminated string literal');
      tokens.push({ Kind: 'string', Value: value });
      i = j;
      continue;
    }

    if (input.startsWith('{{', i)) {
      let j = i + 2;
      while (j < input.length && /\s/.test(input[j] as string)) j += 1;
      const name = readIdent(j);
      j += name.length;
      while (j < input.length && /\s/.test(input[j] as string)) j += 1;
      if (!input.startsWith('}}', j)) throw new ConditionError('Unterminated {{variable}}');
      tokens.push({ Kind: 'var', Value: name });
      i = j + 2;
      continue;
    }

    if (ch === '$') {
      const name = readIdent(i + 1);
      tokens.push({ Kind: 'var', Value: name });
      i += 1 + name.length;
      continue;
    }

    NUMBER.lastIndex = i;
    const num = NUMBER.exec(input);
    if (num) {
      tokens.push({ Kind: 'number', Value: Number(num[0]) });
      i += num[0].length;
      continue;
    }

    IDENT.lastIndex = i;
    const ident = IDENT.exec(input);
    if (ident) {
      tokens.push({ Kind: 'ident', Value: ident[0] });
      i += ident[0].length;
      continue;
    }

    const op = OPERATORS.find((candidate) => input.startsWith(candidate, i));
    if (op) {
      tokens.push({ Kind: 'op', Value: op });
      i += op.length;
      continue;
    }

    throw new ConditionError(`Unexpected character '${ch}' at position ${i}`);
  }

  tokens.push({ Kind: 'end' });
  return tokens;
}

function Normalize(name: string): string {
  return name.replace(/_/g, '').toLowerCase();
}

function Truthy(value: TValue): boolean {
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return value !== 0;
  return value;
}

function LooseEquals(a: TValue, b: TValue): boolean {
  if (typeof a === typeof b) return a === b;
  return String(a) === String(b);
}

class Parser {
  private position = 0;
  private depth = 0;

  constructor(
    private readonly tokens: TToken[],
    private readonly context: TConditionContext
  ) {}

  public Parse(): TValue {
    const value = this.Or();
    if (this.Peek().Kind !== 'end') {
      throw new ConditionError('Unexpected trailing input');
    }
    return value;
  }

  private Peek(): TToken {
    return this.tokens[this.position] ?? { Kind: 'end' };
  }

  private Next(): TToken {
    const token = this.Peek();
    this.position += 1;
    return token;
  }

  private IsOp(value: string): boolean {
    const token = this.Peek();
    return token.Kind === 'op' && token.Value === value;
  }

  private Expect(value: string): void {
    if (!this.IsOp(value)) throw new ConditionError(`Expected '${value}'`);
    this.position += 1;
  }

  private Enter(): void {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) throw new ConditionError('Expression is nested too deeply');
  }

  private Or(): TValue {
    let left = this.And();
    while (this.IsOp('||')) {
      this.position += 1;
      const right = this.And();
      left = Truthy(left) || Truthy(right);
    }
    return left;
  }

  private And(): TValue {
    let left = this.Unary();
    while (this.IsOp('&&')) {
      this.position += 1;
      const right = this.Unary();
      left = Truthy(left) && Truthy(right);
    }
    return left;
  }

  private Unary(): TValue {
    if (this.IsOp('!')) {
      this.position += 1;
      this.Enter();
      const value = !Truthy(this.Unary());
      this.depth -= 1;
      return value;
    }
    return this.Compare();
  }

  private Compare(): TValue {
    const left = this.Primary();
    const token = this.Peek();

    if (token.Kind === 'op' && ['==', '===', '!=', '!=='].includes(token.Value)) {
      this.position += 1;
      const right = this.Primary();
      const equal = LooseEquals(left, right);
      return token.Value.startsWith('!') ? !equal : equal;
    }

    if (token.Kind === 'ident' && token.Value === 'contains') {
      this.position += 1;
      const right = this.Primary();
      return String(left).includes(String(right));
    }

    return left;
  }

  private Primary(): TValue {
    const token = this.Next();
    switch (token.Kind) {
      case 'string':
      case 'number':
        return token.Value;
      case 'var':
        return this.Resolve(token.Value);
      case 'ident': {
        if (token.Value === 'true') return true;
        if (token.Value === 'false') return false;
        if (token.Value === 'hasVar') {
          this.Expect('(');
          const name = this.Next();
          if (name.Kind !== 'string') throw new ConditionError('hasVar() expects a quoted name');
          this.Expect(')');
          const value = this.Lookup(name.Value);
          return value !== undefined && value !== null && value !== '';
        }
        if (token.Value === 'contains') throw new ConditionError("Unexpected 'contains'");
        return this.Resolve(token.Value);
      }
      case 'op':
        if (token.Value === '(') {
          this.Enter();
          const value = this.Or();
          this.Expect(')');
          this.depth -= 1;
          return value;
        }
        throw new ConditionError(`Unexpected '${token.Value}'`);
      default:
        throw new ConditionError('Unexpected end of expression');
    }
  }

  private Lookup(name: string): string | undefined {
    if (Object.prototype.hasOwnProperty.call(this.context, name)) {
      return this.context[name];
    }
    const wanted = Normalize(name);
    const key = Object.keys(this.context).find((candidate) => Normalize(candidate) === wanted);
    return key === undefined ? undefined : this.context[key];
  }

  private Resolve(name: string): string {
    const value = this.Lookup(name);
    if (value === undefined || value === null) {
      throw new ConditionError(`Unknown variable '${name}'`);
    }
    return String(value);
  }
}

/**
 * Evaluate a RunIf expression against string context values. Never throws.
 */
export function EvaluateCondition(expression: string, context: TConditionContext): TConditionResult {
  if (typeof expression !== 'string') {
    return { Ok: false, Error: 'Expression must be a string' };
  }
  if (expression.length > MAX_CONDITION_LENGTH) {
    return { Ok: false, Error: `Expression longer than ${MAX_CONDITION_LENGTH} characters` };
  }
  if (expression.trim() === '') {
    return { Ok: true, Value: true };
  }
  try {
    const value = new Parser(Tokenize(expression), context).Parse();
    return { Ok: true, Value: Truthy(value) };
  } catch (error) {
    if (error instanceof ConditionError) {
      return { Ok: false, Error: error.message };
    }
    return { Ok: false, Error: 'Expression could not be evaluated' };
  }
}

export default { EvaluateCondition };
