/**
 * SafeExec — shell-free process execution and input validation for git,
 * rsync, chown and ssh-keygen (v3.0.1, ENG-C2).
 *
 * Every call goes through execFile with an argument array: no shell parses
 * the values, so quotes, `;`, `$()`, backticks and newlines are just bytes.
 * Values that git or rsync could still interpret as options (a leading `-`)
 * are rejected by the validators below and separated with `--` at call sites.
 *
 * SecurityMiddleware's regex filter stays in front of the API as defence in
 * depth, but nothing here relies on it.
 */

import { execFile } from 'child_process';

export interface IRunOptions {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
}

export interface IRunResult {
  stdout: string;
  stderr: string;
}

/** A user- or webhook-supplied value failed validation. Maps to HTTP 400. */
export class CommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandValidationError';
  }
}

/**
 * Run `file` with `args` and no shell. Rejects with the usual execFile error
 * (which carries stdout / stderr / code) on a non-zero exit or timeout.
 */
export function RunFile(file: string, args: string[], options: IRunOptions = {}): Promise<IRunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeout ?? 300000,
        env: options.env ?? process.env,
        maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
        shell: false,
        windowsHide: true,
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        if (error) {
          // Node puts the full argv in message/cmd; a repo URL may carry a token.
          error.message = RedactUrlCredentialsInText(error.message);
          if (typeof error.cmd === 'string') error.cmd = RedactUrlCredentialsInText(error.cmd);
          Object.assign(error, {
            stdout: RedactUrlCredentialsInText(stdout),
            stderr: RedactUrlCredentialsInText(stderr),
          });
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const BRANCH_CHARSET = /^[A-Za-z0-9._/+@-]+$/;

/** Full or abbreviated lowercase hex object id. */
export const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/;

export function IsValidCommitHash(value: unknown): value is string {
  return typeof value === 'string' && COMMIT_HASH_PATTERN.test(value);
}

export function AssertCommitHash(value: unknown): string {
  if (!IsValidCommitHash(value)) {
    throw new CommandValidationError(
      'Invalid commit hash: expected 7-40 lowercase hexadecimal characters'
    );
  }
  return value;
}

/**
 * Cheap structural checks done before asking git, so obviously hostile values
 * never reach a process at all.
 */
function PrecheckBranch(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) {
    throw new CommandValidationError('Invalid branch name: must be 1-255 characters');
  }
  if (value.startsWith('-')) {
    throw new CommandValidationError('Invalid branch name: must not start with "-"');
  }
  if (CONTROL_CHARS.test(value) || /\s/.test(value)) {
    throw new CommandValidationError('Invalid branch name: whitespace and control characters are not allowed');
  }
  // Stricter than git: branch names are also substituted into pipeline
  // commands ({{Branch}}), which run in a shell, so shell metacharacters are
  // refused even though git itself would accept some of them.
  if (!BRANCH_CHARSET.test(value)) {
    throw new CommandValidationError(
      'Invalid branch name: only letters, digits and . _ / + @ - are allowed'
    );
  }
  return value;
}

/** Synchronous subset of the branch rules, for places that cannot await. */
export function IsPlausibleBranchName(value: unknown): value is string {
  try {
    PrecheckBranch(value);
    return !(value as string).includes('..');
  } catch {
    return false;
  }
}

/**
 * Validate a branch name with `git check-ref-format --branch` (the
 * authoritative rules) after the structural pre-check. Returns the name.
 */
export async function AssertBranchName(value: unknown): Promise<string> {
  const branch = PrecheckBranch(value);
  try {
    const { stdout } = await RunFile('git', ['check-ref-format', '--branch', branch], {
      timeout: 5000,
    });
    if (stdout.trim() !== branch) {
      throw new CommandValidationError('Invalid branch name');
    }
  } catch (error) {
    if (error instanceof CommandValidationError) throw error;
    throw new CommandValidationError('Invalid branch name');
  }
  return branch;
}

const SCP_STYLE = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:(?!\/\/)[A-Za-z0-9._~/-]+$/;
const ALLOWED_URL_PROTOCOLS = new Set(['https:', 'ssh:']);

/**
 * Accept only https://, ssh:// and scp-style `user@host:path` repository
 * URLs. Everything else (file://, ext::, local paths, option-like values)
 * is rejected.
 */
export function AssertRepoUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    throw new CommandValidationError('Invalid repository URL');
  }
  if (value.startsWith('-') || CONTROL_CHARS.test(value) || /\s/.test(value)) {
    throw new CommandValidationError('Invalid repository URL: unexpected characters');
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new CommandValidationError('Invalid repository URL');
    }
    if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
      throw new CommandValidationError(
        'Invalid repository URL: only https://, ssh:// and git@host:path are allowed'
      );
    }
    if (!parsed.hostname || parsed.hostname.startsWith('-')) {
      throw new CommandValidationError('Invalid repository URL: missing host');
    }
    if (!parsed.pathname || parsed.pathname === '/') {
      throw new CommandValidationError('Invalid repository URL: missing repository path');
    }
    return value;
  }

  if (SCP_STYLE.test(value)) {
    const repoPath = value.slice(value.indexOf(':') + 1);
    if (repoPath.startsWith('-')) {
      throw new CommandValidationError('Invalid repository URL');
    }
    return value;
  }

  throw new CommandValidationError(
    'Invalid repository URL: only https://, ssh:// and git@host:path are allowed'
  );
}

/** Long rsync options a project may set (anything that runs a command is absent). */
const RSYNC_LONG_OPTIONS = new Set([
  '--recursive',
  '--verbose',
  '--quiet',
  '--archive',
  '--links',
  '--copy-links',
  '--safe-links',
  '--hard-links',
  '--perms',
  '--no-perms',
  '--times',
  '--no-times',
  '--omit-dir-times',
  '--omit-link-times',
  '--owner',
  '--no-owner',
  '--group',
  '--no-group',
  '--devices',
  '--specials',
  '--checksum',
  '--compress',
  '--delete',
  '--delete-before',
  '--delete-during',
  '--delete-after',
  '--delete-excluded',
  '--ignore-errors',
  '--ignore-existing',
  '--update',
  '--existing',
  '--inplace',
  '--whole-file',
  '--no-whole-file',
  '--human-readable',
  '--itemize-changes',
  '--stats',
  '--progress',
  '--prune-empty-dirs',
  '--size-only',
  '--no-o',
  '--no-g',
  '--no-p',
  '--no-t',
]);

/** Short flags allowed alone or bundled (e.g. `-rv`, `-avz`). */
const RSYNC_SHORT_FLAGS = new Set('rvqalLHptogDczuOhimy'.split(''));

/** Options that take a value, with the accepted value shape. */
const RSYNC_VALUE_OPTIONS: Record<string, RegExp> = {
  '--chmod': /^[ugoaDF0-7,=+\-rwxXst]+$/,
  '--chown': /^[A-Za-z0-9._-]*(:[A-Za-z0-9._-]*)?$/,
  '--timeout': /^[0-9]{1,5}$/,
  '--bwlimit': /^[0-9]{1,9}[KMG]?$/,
  '--max-size': /^[0-9]{1,12}[KMGkmg]?$/,
  '--min-size': /^[0-9]{1,12}[KMGkmg]?$/,
  '--modify-window': /^[0-9]{1,5}$/,
};

/**
 * Split a project's RsyncOptions string into arguments, accepting only
 * allow-listed options. Throws CommandValidationError on anything else
 * (notably -e / --rsh / --rsync-path, which execute commands).
 */
export function ParseRsyncOptions(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string' || value.length > 1000 || CONTROL_CHARS.test(value)) {
    throw new CommandValidationError('Invalid rsync options');
  }

  const args = value.trim().split(/\s+/).filter(Boolean);
  for (const arg of args) {
    if (/^-[A-Za-z]+$/.test(arg)) {
      const flags = arg.slice(1).split('');
      if (!flags.every((flag) => RSYNC_SHORT_FLAGS.has(flag))) {
        throw new CommandValidationError(`rsync option not allowed: ${arg}`);
      }
      continue;
    }

    if (arg.startsWith('--') && arg.includes('=')) {
      const name = arg.slice(0, arg.indexOf('='));
      const optionValue = arg.slice(arg.indexOf('=') + 1);
      const shape = RSYNC_VALUE_OPTIONS[name];
      if (!shape || !shape.test(optionValue)) {
        throw new CommandValidationError(`rsync option not allowed: ${name}`);
      }
      continue;
    }

    if (!RSYNC_LONG_OPTIONS.has(arg)) {
      throw new CommandValidationError(`rsync option not allowed: ${arg}`);
    }
  }
  return args;
}

/** Reject a filesystem path that could be read as an option or smuggle bytes. */
export function AssertSafePath(value: unknown, label: string = 'path'): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4096 ||
    value.startsWith('-') ||
    CONTROL_CHARS.test(value)
  ) {
    throw new CommandValidationError(`Invalid ${label}`);
  }
  return value;
}

const URL_USERINFO = /(\b[A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/\s@]+@/g;

/** Strip `user:token@` from every URL inside free text (error messages, stderr). */
export function RedactUrlCredentialsInText(text: string): string {
  return typeof text === 'string' ? text.replace(URL_USERINFO, '$1') : text;
}

/**
 * Strip credentials from a URL for logs ("https://token@host/x" → "https://host/x").
 */
export function RedactUrlCredentials(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
      return parsed.toString();
    }
  } catch {
    // scp-style or invalid: no embedded secret to strip
  }
  return value;
}

export default {
  RunFile,
  AssertCommitHash,
  AssertBranchName,
  AssertRepoUrl,
  ParseRsyncOptions,
  AssertSafePath,
  IsValidCommitHash,
  RedactUrlCredentials,
  RedactUrlCredentialsInText,
};
