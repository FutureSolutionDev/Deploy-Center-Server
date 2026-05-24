/**
 * SshKeyGenerator unit tests — F-002 (T042).
 * Validate / fingerprint / extract pure functions; key-pair generation gated
 * on ssh-keygen availability (skipped on CI runners without it).
 */

import SshKeyGenerator from '@Utils/SshKeyGenerator';

const SSH_KEYGEN_AVAILABLE_PROMISE = SshKeyGenerator.CheckSshKeygenAvailable();

// Sample ED25519 public key for pure-function tests (valid OpenSSH format).
const SAMPLE_ED25519_PUB =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFAKEKEYpdJfFakeOnlyForTestsNotRealKeyXxXxXxX deploycenter@test';
const SAMPLE_RSA_PUB =
  'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ' +
  'A'.repeat(200) +
  ' test@test';

describe('SshKeyGenerator — pure functions', () => {
  describe('ValidatePublicKey', () => {
    it('accepts a well-formed ED25519 public key', () => {
      expect(SshKeyGenerator.ValidatePublicKey(SAMPLE_ED25519_PUB)).toBe(true);
    });

    it('accepts a well-formed RSA public key', () => {
      expect(SshKeyGenerator.ValidatePublicKey(SAMPLE_RSA_PUB)).toBe(true);
    });

    it('rejects garbage', () => {
      expect(SshKeyGenerator.ValidatePublicKey('not-a-key')).toBe(false);
      expect(SshKeyGenerator.ValidatePublicKey('')).toBe(false);
    });
  });

  describe('ExtractKeyType', () => {
    it('returns ed25519 for ed25519 keys', () => {
      expect(SshKeyGenerator.ExtractKeyType(SAMPLE_ED25519_PUB)).toBe('ed25519');
    });

    it('returns rsa for rsa keys', () => {
      expect(SshKeyGenerator.ExtractKeyType(SAMPLE_RSA_PUB)).toBe('rsa');
    });

    it('returns null for unknown', () => {
      expect(SshKeyGenerator.ExtractKeyType('ssh-other AAAA')).toBeNull();
      expect(SshKeyGenerator.ExtractKeyType('')).toBeNull();
    });
  });

  describe('GenerateFingerprint', () => {
    it('produces a non-empty fingerprint for a valid key', () => {
      const fp = SshKeyGenerator.GenerateFingerprint(SAMPLE_ED25519_PUB);
      expect(fp.length).toBeGreaterThan(10);
    });

    it('same key → same fingerprint (deterministic)', () => {
      const a = SshKeyGenerator.GenerateFingerprint(SAMPLE_ED25519_PUB);
      const b = SshKeyGenerator.GenerateFingerprint(SAMPLE_ED25519_PUB);
      expect(a).toBe(b);
    });

    it('different keys → different fingerprints', () => {
      const a = SshKeyGenerator.GenerateFingerprint(SAMPLE_ED25519_PUB);
      const b = SshKeyGenerator.GenerateFingerprint(SAMPLE_RSA_PUB);
      expect(a).not.toBe(b);
    });
  });
});

describe('SshKeyGenerator — key generation (requires ssh-keygen on PATH)', () => {
  // Auto-skip if ssh-keygen isn't available (CI containers may lack it).
  let available = false;
  beforeAll(async () => {
    available = await SSH_KEYGEN_AVAILABLE_PROMISE;
    if (!available) {
      // eslint-disable-next-line no-console
      console.warn('ssh-keygen not on PATH — generation tests skipped');
    }
  });

  it('GenerateEd25519KeyPair returns valid OpenSSH keys', async () => {
    if (!available) return;
    const pair = await SshKeyGenerator.GenerateEd25519KeyPair('test@deploycenter');
    expect(pair.publicKey).toMatch(/^ssh-ed25519 /);
    expect(pair.privateKey.length).toBeGreaterThan(100);
    expect(pair.keyType).toBe('ed25519');
    expect(SshKeyGenerator.ValidatePublicKey(pair.publicKey)).toBe(true);
    expect(SshKeyGenerator.ValidatePrivateKey(pair.privateKey)).toBe(true);
    expect(SshKeyGenerator.ExtractKeyType(pair.publicKey)).toBe('ed25519');
  }, 30000);

  it('GenerateRsaKeyPair returns valid OpenSSH keys', async () => {
    if (!available) return;
    const pair = await SshKeyGenerator.GenerateRsaKeyPair(2048, 'test@deploycenter');
    expect(pair.publicKey).toMatch(/^ssh-rsa /);
    expect(pair.privateKey.length).toBeGreaterThan(100);
    expect(pair.keyType).toBe('rsa');
    expect(SshKeyGenerator.ValidatePublicKey(pair.publicKey)).toBe(true);
    expect(SshKeyGenerator.ValidatePrivateKey(pair.privateKey)).toBe(true);
    expect(SshKeyGenerator.ExtractKeyType(pair.publicKey)).toBe('rsa');
  }, 30000);
});
