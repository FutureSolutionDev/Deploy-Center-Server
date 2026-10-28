/**
 * SafeExec — v3.0.1 / ENG-C2.
 * Strict validation of refs / URLs / rsync options, and proof that RunFile
 * never hands its arguments to a shell.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AssertBranchName,
  AssertCommitHash,
  AssertRepoUrl,
  AssertSafePath,
  CommandValidationError,
  ParseRsyncOptions,
  RedactUrlCredentials,
  RedactUrlCredentialsInText,
  RunFile,
} from '@Utils/SafeExec';
import { SanitizeKeyComment } from '@Utils/SshKeyGenerator';

const marker = path.join(os.tmpdir(), `dc-safeexec-pwned-${process.pid}`);

const INJECTIONS = [
  `main; touch ${marker}`,
  `main && touch ${marker}`,
  `main | touch ${marker}`,
  `main\ntouch ${marker}`,
  `main\r\ntouch ${marker}`,
  `$(touch ${marker})`,
  `\`touch ${marker}\``,
  `main' ; touch ${marker} ; '`,
  `main" ; touch ${marker} ; "`,
  '--upload-pack=touch /tmp/x',
  '-oProxyCommand=touch /tmp/x',
];

afterEach(() => {
  expect(fs.existsSync(marker)).toBe(false);
});

afterAll(() => {
  if (fs.existsSync(marker)) fs.unlinkSync(marker);
});

describe('AssertCommitHash', () => {
  it.each(['abc1234', 'a'.repeat(40), '0123456789abcdef0123456789abcdef01234567'])('accepts %s', (h) => {
    expect(AssertCommitHash(h)).toBe(h);
  });

  it.each([
    'abc123',
    'a'.repeat(41),
    'ABC1234',
    'abc1234 ',
    'abc1234\n',
    'abc1234;id',
    'HEAD',
    'main',
    '-abc1234',
    ...INJECTIONS,
    undefined,
    1234567,
  ])('rejects %j', (h) => {
    expect(() => AssertCommitHash(h)).toThrow(CommandValidationError);
  });
});

describe('AssertBranchName', () => {
  it.each(['main', 'feature/login', 'release-3.0.1', 'user/sabry/fix_1', 'v3.0'])('accepts %s', async (b) => {
    await expect(AssertBranchName(b)).resolves.toBe(b);
  });

  it.each([
    ...INJECTIONS,
    '',
    'a..b',
    'feature/',
    'bad~name',
    'bad^name',
    'bad:name',
    'with space',
    'x'.repeat(256),
    'refs/heads/@{-1}',
    'branch.lock',
    'main;id',
    'main|id',
    'feat$(id)',
    "it's",
  ])('rejects %j', async (b) => {
    await expect(AssertBranchName(b)).rejects.toThrow(CommandValidationError);
  });
});

describe('AssertRepoUrl', () => {
  it.each([
    'https://github.com/org/repo.git',
    'https://x-access-token:abc@github.com/org/repo.git',
    'ssh://git@github.com/org/repo.git',
    'ssh://git@gitlab.internal:2222/group/repo.git',
    'git@github.com:org/repo.git',
    'deploy@git.example.com:team/app',
  ])('accepts %s', (u) => {
    expect(AssertRepoUrl(u)).toBe(u);
  });

  it.each([
    'http://github.com/org/repo.git',
    'file:///etc/passwd',
    'git://github.com/org/repo.git',
    'ext::sh -c touch% /tmp/x',
    'ext::sh',
    '/srv/repos/app.git',
    './repo',
    '--upload-pack=touch /tmp/x',
    '-u touch',
    'https://github.com/org/repo.git; touch /tmp/x',
    'https://github.com/org/repo.git\ntouch /tmp/x',
    'git@github.com:-oProxyCommand=x',
    'git@github.com:org/repo.git && id',
    'https://',
    'https://github.com/',
    'github.com:org/repo',
    '',
  ])('rejects %j', (u) => {
    expect(() => AssertRepoUrl(u)).toThrow(CommandValidationError);
  });
});

describe('ParseRsyncOptions', () => {
  it.each([
    ['-rv --delete --omit-dir-times', ['-rv', '--delete', '--omit-dir-times']],
    ['--no-perms --no-owner --no-group --omit-dir-times', ['--no-perms', '--no-owner', '--no-group', '--omit-dir-times']],
    ['-avz --chmod=ugo=rwX', ['-avz', '--chmod=ugo=rwX']],
    ['', []],
  ])('accepts %j', (input, expected) => {
    expect(ParseRsyncOptions(input)).toEqual(expected);
  });

  it.each([
    '-e "sh -c id"',
    '-e',
    '-rve',
    '--rsh=ssh',
    '--rsync-path=touch /tmp/x',
    '--files-from=/etc/passwd',
    '-rv; touch /tmp/x',
    '-rv $(id)',
    '-rv\n--delete',
    '--chmod=$(id)',
    '--exclude-from=/etc/shadow',
    'not-an-option',
  ])('rejects %j', (input) => {
    expect(() => ParseRsyncOptions(input)).toThrow(CommandValidationError);
  });
});

describe('AssertSafePath', () => {
  it('rejects option-like and control-character paths', () => {
    expect(() => AssertSafePath('-rf')).toThrow(CommandValidationError);
    expect(() => AssertSafePath('/srv/app\n/etc')).toThrow(CommandValidationError);
    expect(AssertSafePath('/srv/my app')).toBe('/srv/my app');
  });
});

describe('RunFile', () => {
  // Option-like payloads are handled by the validators + `--`; here we prove
  // shell metacharacters (and newlines) are never interpreted.
  it.each(INJECTIONS.filter((p) => !p.startsWith('-')))(
    'passes %j through as one literal argument',
    async (payload) => {
    const { stdout } = await RunFile(process.execPath, [
      '-e',
      'process.stdout.write(JSON.stringify(process.argv.slice(1)))',
      payload,
    ]);
    expect(JSON.parse(stdout)).toEqual([payload]);
    }
  );

  it('strips URL credentials from a failed command error', async () => {
    const url = 'https://deploy:s3cr3t-token@git.example.com/o/r.git';
    const error = await RunFile(process.execPath, [
      '-e',
      'process.stderr.write(process.argv[1]); process.exit(2)',
      url,
    ]).catch((e: Error & { cmd?: string; stderr?: string }) => e);
    const failure = error as Error & { cmd?: string; stderr?: string };
    expect(failure.message).toContain('Command failed');
    for (const text of [failure.message, failure.cmd, failure.stderr]) {
      expect(text).not.toContain('s3cr3t-token');
    }
    expect(failure.stderr).toBe('https://git.example.com/o/r.git');
  });
});

describe('helpers', () => {
  it('redacts URL credentials for logs', () => {
    expect(RedactUrlCredentials('https://user:tok@github.com/o/r.git')).toBe('https://github.com/o/r.git');
    expect(RedactUrlCredentials('git@github.com:o/r.git')).toBe('git@github.com:o/r.git');
    expect(RedactUrlCredentialsInText('fatal: https://u:p@h.io/x and ssh://k@h.io/y')).toBe(
      'fatal: https://h.io/x and ssh://h.io/y'
    );
  });

  it('sanitizes ssh-keygen comments', () => {
    expect(SanitizeKeyComment('deploy-center-my"; touch /tmp/x; "')).not.toMatch(/[";\s/]/);
    expect(SanitizeKeyComment('')).toBe('deploy-center');
  });
});
