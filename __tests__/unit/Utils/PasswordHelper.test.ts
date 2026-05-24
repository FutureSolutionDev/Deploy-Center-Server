/**
 * PasswordHelper unit tests — F-002 (T041).
 * Hash + Verify + Validate + bcrypt cost ≥ 10 (Constitution Principle V).
 */

import PasswordHelper from '@Utils/PasswordHelper';

describe('PasswordHelper', () => {
  describe('Hash + Verify', () => {
    it('Verify accepts the original password', async () => {
      const hash = await PasswordHelper.Hash('S0me-Strong!Password');
      expect(await PasswordHelper.Verify('S0me-Strong!Password', hash)).toBe(true);
    });

    it('Verify rejects a wrong password', async () => {
      const hash = await PasswordHelper.Hash('correct');
      expect(await PasswordHelper.Verify('wrong', hash)).toBe(false);
    });

    it('bcrypt cost meets constitution minimum (≥ 10)', async () => {
      const hash = await PasswordHelper.Hash('cost-check');
      // bcrypt format: $2b$<cost>$<22 char salt><31 char hash>
      const m = /^\$2[aby]\$(\d{2})\$/.exec(hash);
      expect(m).not.toBeNull();
      const cost = Number(m![1]);
      expect(cost).toBeGreaterThanOrEqual(10);
    });

    it('two hashes of the same password differ (random salt)', async () => {
      const a = await PasswordHelper.Hash('same');
      const b = await PasswordHelper.Hash('same');
      expect(a).not.toBe(b);
      expect(await PasswordHelper.Verify('same', a)).toBe(true);
      expect(await PasswordHelper.Verify('same', b)).toBe(true);
    });
  });

  describe('GenerateRandomPassword', () => {
    it('returns a string of the requested length', () => {
      expect(PasswordHelper.GenerateRandomPassword(20)).toHaveLength(20);
      expect(PasswordHelper.GenerateRandomPassword(8)).toHaveLength(8);
    });

    it('uses only characters from the documented charset', () => {
      const pw = PasswordHelper.GenerateRandomPassword(64);
      expect(pw).toMatch(/^[A-Za-z0-9!@#$%^&*]+$/);
    });

    it('two calls return different strings', () => {
      const a = PasswordHelper.GenerateRandomPassword(16);
      const b = PasswordHelper.GenerateRandomPassword(16);
      expect(a).not.toBe(b);
    });
  });

  describe('ValidateStrength', () => {
    it('accepts a strong password', () => {
      const r = PasswordHelper.ValidateStrength('Aa1!aaaaa');
      expect(r.IsValid).toBe(true);
      expect(r.Errors).toHaveLength(0);
    });

    it('rejects passwords shorter than 8', () => {
      const r = PasswordHelper.ValidateStrength('Aa1!');
      expect(r.IsValid).toBe(false);
      expect(r.Errors.some((e) => e.includes('8 characters'))).toBe(true);
    });

    it('rejects passwords missing uppercase', () => {
      const r = PasswordHelper.ValidateStrength('aaaaaaa1!');
      expect(r.IsValid).toBe(false);
      expect(r.Errors.some((e) => e.toLowerCase().includes('uppercase'))).toBe(true);
    });

    it('rejects passwords missing a number', () => {
      const r = PasswordHelper.ValidateStrength('Aaaaaaa!');
      expect(r.IsValid).toBe(false);
      expect(r.Errors.some((e) => e.toLowerCase().includes('number'))).toBe(true);
    });

    it('rejects passwords missing a special char', () => {
      const r = PasswordHelper.ValidateStrength('Aaaaaa11');
      expect(r.IsValid).toBe(false);
      expect(r.Errors.some((e) => e.toLowerCase().includes('special'))).toBe(true);
    });
  });
});
