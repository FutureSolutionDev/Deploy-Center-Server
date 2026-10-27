/**
 * ConditionEvaluator — v3.0.1 / ENG-C3.
 * RunIf must keep its documented syntax, treat context values as inert data,
 * and fail closed on anything it cannot parse.
 */

import fs from 'fs';
import path from 'path';
import { EvaluateCondition, MAX_CONDITION_LENGTH } from '@Utils/ConditionEvaluator';

const ctx = {
  Branch: 'main',
  Commit: 'abc1234',
  RepoName: 'app',
  ProjectPath: '/srv/app',
  ENVIRONMENT: 'production',
  Environment: 'production',
  COMMIT_MESSAGE: 'release: ship it [deploy]',
  TRIGGERED_BY: 'webhook',
  EMPTY: '',
  COUNT: '3',
};

const value = (expr: string, context: Record<string, string | undefined> = ctx): boolean | string => {
  const result = EvaluateCondition(expr, context);
  return result.Ok ? result.Value : `error: ${result.Error}`;
};

describe('ConditionEvaluator — supported syntax', () => {
  it.each([
    ["Branch == 'main'", true],
    ["Branch === 'main'", true],
    ['Branch != "main"', false],
    ["Branch !== 'dev'", true],
    ["$ENVIRONMENT == 'production'", true],
    ["$BRANCH == 'main'", true],
    ["{{Environment}} === 'production'", true],
    ["{{ Environment }} === 'staging'", false],
    ["$COMMIT_MESSAGE contains '[deploy]'", true],
    ["$BRANCH contains 'release'", false],
    ["$ENVIRONMENT == 'production' && $BRANCH == 'main'", true],
    ["$ENVIRONMENT == 'staging' || $ENVIRONMENT == 'production'", true],
    ["($ENVIRONMENT == 'production' && $BRANCH == 'dev') || $TRIGGERED_BY == 'webhook'", true],
    ["!($BRANCH == 'main')", false],
    ["hasVar('ENVIRONMENT')", true],
    ["hasVar('EMPTY')", false],
    ["hasVar('MISSING')", false],
    ["hasVar('ENVIRONMENT') && Branch != 'dev'", true],
    ['COUNT == 3', true],
    ['true', true],
    ['false || !false', true],
    ['', true],
  ])('%s → %s', (expr, expected) => {
    expect(value(expr)).toBe(expected);
  });
});

describe('ConditionEvaluator — fail closed', () => {
  it.each([
    "Branch == 'main",
    "Branch == 'main' &&",
    "(Branch == 'main'",
    "MISSING == 'x'",
    "MISSING != 'x'",
    "Branch == 'main'; process.exit(1)",
    'process.exit(1)',
    "require('child_process')",
    "constructor.constructor('return process')()",
    'this',
    'globalThis',
    "Branch.constructor",
    '`id`',
    "$__proto__ == 'x'",
    "hasVar(Branch)",
    "Branch = 'main'",
    "Branch contains",
    "{{Branch}",
  ])('%s fails closed', (expr) => {
    const result = EvaluateCondition(expr, ctx);
    expect(result.Ok).toBe(false);
  });

  it('rejects over-long expressions', () => {
    const result = EvaluateCondition(`${"'a' == 'a' && ".repeat(MAX_CONDITION_LENGTH)}true`, ctx);
    expect(result.Ok).toBe(false);
  });

  it('rejects absurd nesting without overflowing the stack', () => {
    const result = EvaluateCondition(`${'('.repeat(200)}true${')'.repeat(200)}`, ctx);
    expect(result.Ok).toBe(false);
  });

  it('does not see inherited properties as variables', () => {
    expect(value("hasVar('constructor')")).toBe(false);
    expect(EvaluateCondition("toString == 'x'", ctx).Ok).toBe(false);
  });
});

describe('ConditionEvaluator — injection payloads in context values are inert', () => {
  const sentinel = globalThis as unknown as { __runIfPwned?: boolean };

  beforeEach(() => {
    sentinel.__runIfPwned = false;
  });

  it.each([
    'main"; globalThis.__runIfPwned = true; "',
    "main'; globalThis.__runIfPwned = true; '",
    '" + (globalThis.__runIfPwned = true) + "',
    '${globalThis.__runIfPwned = true}',
    "main\n\"); globalThis.__runIfPwned = true; (\"",
    '\\"; globalThis.__runIfPwned = true; //',
  ])('commit message %j is compared as data', (payload) => {
    const context = { ...ctx, Branch: payload, COMMIT_MESSAGE: payload };
    expect(value("Branch == 'main'", context)).toBe(false);
    expect(value("$COMMIT_MESSAGE contains 'deploy'", context)).toBe(false);
    expect(value(`Branch == ${JSON.stringify(payload)}`, context)).toBe(true);
    expect(sentinel.__runIfPwned).toBe(false);
  });
});

describe('PipelineService no longer evaluates code', () => {
  it('contains no Function constructor or eval', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../src/Services/PipelineService.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/new Function\s*\(/);
    expect(source).not.toMatch(/\beval\s*\(/);
  });
});
