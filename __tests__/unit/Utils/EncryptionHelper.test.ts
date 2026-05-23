/**
 * EncryptionHelper unit tests — F-002 (T041).
 * Round-trip + IV uniqueness + AuthTag tamper rejection + edge cases.
 */

// Load .env.test BEFORE importing the helper (it reads ENCRYPTION_KEY at init).
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test'), override: true });

import EncryptionHelper from '@Utils/EncryptionHelper';

describe('EncryptionHelper', () => {
  describe('Encrypt / Decrypt round-trip', () => {
    it('returns the original plaintext after decrypt', () => {
      const original = 'sk_live_p@$$w0rd-with-symbols-and-12345';
      const encrypted = EncryptionHelper.Encrypt(original);
      const decrypted = EncryptionHelper.Decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('round-trips UTF-8 including emoji', () => {
      const original = 'مرحبا 🚀 with emoji and عربى';
      const encrypted = EncryptionHelper.Encrypt(original);
      expect(EncryptionHelper.Decrypt(encrypted)).toBe(original);
    });

    it('handles empty string', () => {
      const encrypted = EncryptionHelper.Encrypt('');
      expect(EncryptionHelper.Decrypt(encrypted)).toBe('');
    });

    it('handles long values (8KB)', () => {
      const original = 'a'.repeat(8192);
      const encrypted = EncryptionHelper.Encrypt(original);
      expect(EncryptionHelper.Decrypt(encrypted)).toBe(original);
    });
  });

  describe('IV uniqueness (FR-009: unique IV per row)', () => {
    it('produces a fresh IV on every Encrypt call', () => {
      const value = 'same_value';
      const a = EncryptionHelper.Encrypt(value);
      const b = EncryptionHelper.Encrypt(value);
      expect(a.Iv).not.toBe(b.Iv);
      expect(a.Encrypted).not.toBe(b.Encrypted); // ciphertext differs too
      // But both still decrypt to the same plaintext
      expect(EncryptionHelper.Decrypt(a)).toBe(value);
      expect(EncryptionHelper.Decrypt(b)).toBe(value);
    });

    it('IV is 32 hex chars (16 bytes)', () => {
      const enc = EncryptionHelper.Encrypt('x');
      expect(enc.Iv).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('GCM auth tag tamper detection', () => {
    it('throws if ciphertext is tampered with', () => {
      const enc = EncryptionHelper.Encrypt('original');
      const tampered = {
        ...enc,
        Encrypted: enc.Encrypted.slice(0, -2) + (enc.Encrypted.slice(-2) === 'ff' ? '00' : 'ff'),
      };
      expect(() => EncryptionHelper.Decrypt(tampered)).toThrow();
    });

    it('throws if AuthTag is tampered with', () => {
      const enc = EncryptionHelper.Encrypt('original');
      const tampered = {
        ...enc,
        AuthTag: enc.AuthTag.slice(0, -2) + (enc.AuthTag.slice(-2) === 'ff' ? '00' : 'ff'),
      };
      expect(() => EncryptionHelper.Decrypt(tampered)).toThrow();
    });

    it('throws if IV is tampered with', () => {
      const enc = EncryptionHelper.Encrypt('original');
      const tampered = {
        ...enc,
        Iv: enc.Iv.slice(0, -2) + (enc.Iv.slice(-2) === 'ff' ? '00' : 'ff'),
      };
      expect(() => EncryptionHelper.Decrypt(tampered)).toThrow();
    });
  });

  describe('Hash + GenerateRandomString + HMAC helpers', () => {
    it('Hash is deterministic and 64 hex chars (SHA-256)', () => {
      const h1 = EncryptionHelper.Hash('value');
      const h2 = EncryptionHelper.Hash('value');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('GenerateRandomString returns unique hex of requested length × 2', () => {
      const a = EncryptionHelper.GenerateRandomString(16);
      const b = EncryptionHelper.GenerateRandomString(16);
      expect(a).toMatch(/^[0-9a-f]{32}$/);
      expect(a).not.toBe(b);
    });

    it('CreateHmacSignature + VerifyHmacSignature round-trip', () => {
      const sig = EncryptionHelper.CreateHmacSignature('payload', 'secret');
      expect(EncryptionHelper.VerifyHmacSignature('payload', 'secret', sig)).toBe(true);
    });

    it('VerifyHmacSignature rejects a tampered signature', () => {
      const sig = EncryptionHelper.CreateHmacSignature('payload', 'secret');
      const tampered = sig.slice(0, -2) + (sig.slice(-2) === 'ff' ? '00' : 'ff');
      expect(EncryptionHelper.VerifyHmacSignature('payload', 'secret', tampered)).toBe(false);
    });
  });
});
