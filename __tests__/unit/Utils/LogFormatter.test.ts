/**
 * LogFormatter unit tests — F-002 (T042).
 * Focus on F-003 / FR-012 secret-redaction (RedactSecrets) + format helpers.
 */

import LogFormatter, { LogLevel, LogPhase } from '@Utils/LogFormatter';

describe('LogFormatter', () => {
  describe('Format', () => {
    it('prefixes with timestamp + level + phase', () => {
      const line = LogFormatter.Format(LogLevel.INFO, LogPhase.STEP, 'hello');
      expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] \[STEP\] hello$/);
    });

    it('emits ANSI colors when useColors=true', () => {
      const line = LogFormatter.Format(LogLevel.ERROR, LogPhase.STEP, 'boom', true);
      // ANSI escape ESC[ ... m
      // eslint-disable-next-line no-control-regex
      expect(line).toMatch(/\x1b\[\d+m/);
      expect(line).toContain('boom');
    });
  });

  describe('RedactSecrets — F-003 / FR-012', () => {
    it('replaces every occurrence of a secret with ***', () => {
      const text = 'token=sk_live_abc123 and again sk_live_abc123 elsewhere';
      const out = LogFormatter.RedactSecrets(text, ['sk_live_abc123']);
      expect(out).toBe('token=*** and again *** elsewhere');
    });

    it('redacts multiple distinct secrets in one line', () => {
      const out = LogFormatter.RedactSecrets('DB=mysql://user:pw@host KEY=apikey', [
        'pw',
        'apikey',
      ]);
      // 'pw' is 2 chars (skipped — too short), 'apikey' is 6 chars and gets redacted.
      expect(out).toContain('apikey'.length === 6 ? '***' : 'apikey');
      expect(out).toContain('pw'); // skipped by < 4 chars rule
    });

    it('handles secrets that contain regex meta-characters', () => {
      const tricky = 'p@$$w0rd?+*().|^{}[]';
      const out = LogFormatter.RedactSecrets(`value=${tricky}`, [tricky]);
      expect(out).toBe('value=***');
    });

    it('idempotent — running twice gives the same result', () => {
      const text = 'secret=hunter2 secret=hunter2';
      const once = LogFormatter.RedactSecrets(text, ['hunter2']);
      const twice = LogFormatter.RedactSecrets(once, ['hunter2']);
      expect(once).toBe(twice);
    });

    it('skips secrets shorter than 4 chars to avoid over-redaction', () => {
      const text = 'this is a normal line';
      const out = LogFormatter.RedactSecrets(text, ['is', 'a', 'an']);
      expect(out).toBe(text);
    });

    it('no-ops on empty inputs', () => {
      expect(LogFormatter.RedactSecrets('', ['secret'])).toBe('');
      expect(LogFormatter.RedactSecrets('plain', [])).toBe('plain');
    });

    it('preserves non-matching text', () => {
      const out = LogFormatter.RedactSecrets('hello world', ['xyz123']);
      expect(out).toBe('hello world');
    });
  });

  describe('Convenience wrappers', () => {
    it('Info / Success / Warn / Error / Debug all emit the right level', () => {
      expect(LogFormatter.Info(LogPhase.STEP, 'x')).toContain('[INFO]');
      expect(LogFormatter.Success(LogPhase.STEP, 'x')).toContain('[SUCCESS]');
      expect(LogFormatter.Warn(LogPhase.STEP, 'x')).toContain('[WARN]');
      expect(LogFormatter.Error(LogPhase.STEP, 'x')).toContain('[ERROR]');
      expect(LogFormatter.Debug(LogPhase.STEP, 'x')).toContain('[DEBUG]');
    });
  });

  describe('FormatCommandOutput multi-line', () => {
    it('prefixes every output line with the same phase header', () => {
      const result = LogFormatter.FormatCommandOutput('line1\nline2', LogPhase.STEP);
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('line1');
      expect(lines[1]).toContain('line2');
      expect(lines[0]).toContain('[STEP]');
      expect(lines[1]).toContain('[STEP]');
    });
  });

  describe('FormatDuration', () => {
    it('seconds-only for under 60s', () => {
      expect(LogFormatter.FormatDuration(45)).toBe('45s');
    });
    it('minutes + seconds for ≥ 60s', () => {
      expect(LogFormatter.FormatDuration(125)).toBe('2m 5s');
    });
  });
});
