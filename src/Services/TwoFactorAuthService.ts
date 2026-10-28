/**
 * Two-Factor Authentication Service
 * Implements TOTP generation, verification, and backup codes
 */

import crypto from 'crypto';
import qrcode from 'qrcode';
import speakeasy from 'speakeasy';
import { TwoFactorAuth, User } from '@Models/index';
import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';

interface ITotpSecret {
  secret: string;
  qrCodeUrl: string;
}

/** Number of backup codes issued per (re)generation. */
export const BACKUP_CODE_COUNT = 10;
/** Random bytes per backup code: 10 bytes = 80 bits of entropy (SEC-C3). */
const BACKUP_CODE_BYTES = 10;
/** Storage prefix for salted backup-code hashes. Entries without it are legacy. */
const BACKUP_CODE_HASH_PREFIX = 'v2$';
/** Crockford base32 alphabet: no I, L, O, U, so codes are easy to read aloud. */
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Consecutive failed second-factor attempts before the account is locked. */
export const TWO_FACTOR_MAX_FAILURES = 5;
/** Lockout duration after too many failures. */
export const TWO_FACTOR_LOCKOUT_MS = 15 * 60 * 1000;

function EncodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Uppercase and drop separators so "abcd-efgh ..." matches "ABCDEFGH...". */
export function NormalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '');
}

function HashBackupCode(normalized: string, salt: Buffer): string {
  return crypto.createHash('sha256').update(salt).update(normalized, 'utf8').digest('hex');
}

export class TwoFactorAuthService {
  /**
   * Generate a new TOTP secret and QR code for a user
   */
  public async GenerateTOTP(userId: number): Promise<ITotpSecret> {
    const user = await this.GetUserOrThrow(userId);
    const userData = user.toJSON();
    const secret = speakeasy.generateSecret({
      name: `Deploy Center (${userData.Email})`,
      length: 20,
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');

    const encrypted = EncryptionHelper.Encrypt(secret.base32);
    const record = await this.GetOrCreateRecord(userId);

    record.set('Secret', encrypted.Encrypted);
    record.set('SecretIv', encrypted.Iv);
    record.set('SecretAuthTag', encrypted.AuthTag);
    record.set('IsEnabled', false);
    await record.save();

    Logger.Info('Generated TOTP secret', { userId });

    return { secret: secret.base32, qrCodeUrl };
  }

  /**
   * Enable 2FA after verifying TOTP code
   */
  public async Enable2FA(userId: number, totpCode: string): Promise<{ backupCodes: string[] }> {
    const record = await this.GetOrCreateRecord(userId);
    const secret = this.DecryptSecret(record);

    if (!secret) {
      throw new Error('2FA secret not found, please generate again');
    }

    const isValid = this.VerifyCode(secret, totpCode);
    if (!isValid) {
      throw new Error('Invalid verification code');
    }

    const backupCodes = this.GenerateBackupCodes();
    record.set('BackupCodes', JSON.stringify(backupCodes.hashes));
    record.set('IsEnabled', true);
    record.set('EnabledAt', new Date());
    await record.save();

    await User.update({ TwoFactorEnabled: true }, { where: { Id: userId } });

    Logger.Info('2FA enabled', { userId });
    return { backupCodes: backupCodes.codes };
  }

  /**
   * Disable 2FA (verify via TOTP or backup code)
   */
  public async Disable2FA(userId: number, code: string): Promise<void> {
    const record = await this.GetOrCreateRecord(userId);
    const secret = this.DecryptSecret(record);
    const codes = this.ParseBackupCodes(record);
    let verified = false;

    if (secret && this.VerifyCode(secret, code)) {
      verified = true;
    }

    if (!verified && this.FindBackupCodeIndex(codes, code) !== -1) {
      verified = true;
    }

    if (!verified) {
      throw new Error('Invalid code');
    }

    record.set('IsEnabled', false);
    record.set('EnabledAt', null as any);
    record.set('BackupCodes', null as any);
    record.set('Secret', null as any);
    record.set('SecretIv', null as any);
    record.set('SecretAuthTag', null as any);
    await record.save();

    await User.update({ TwoFactorEnabled: false }, { where: { Id: userId } });
    Logger.Info('2FA disabled', { userId });
  }

  /**
   * Regenerate backup codes
   */
  public async RegenerateBackupCodes(userId: number): Promise<string[]> {
    const record = await this.GetOrCreateRecord(userId);
    const recordData = record.toJSON();

    if (!recordData.IsEnabled) {
      throw new Error('2FA must be enabled to regenerate backup codes');
    }

    const backupCodes = this.GenerateBackupCodes();
    record.set('BackupCodes', JSON.stringify(backupCodes.hashes));
    await record.save();

    Logger.Info('Backup codes regenerated', { userId });
    return backupCodes.codes;
  }

  /**
   * Get 2FA status. `legacyBackupCodesInvalidated` is true when the stored
   * codes predate v3.0.1: those weak codes are no longer accepted and the
   * user should regenerate (SEC-C3).
   */
  public async GetStatus(userId: number): Promise<{
    enabled: boolean;
    enabledAt?: Date | null;
    backupCodesRemaining: number;
    legacyBackupCodesInvalidated: boolean;
  }> {
    const record = await this.GetOrCreateRecord(userId);
    const recordData = record.toJSON();
    const all = this.ParseBackupCodes(record);
    const current = all.filter((c) => c.startsWith(BACKUP_CODE_HASH_PREFIX));
    return {
      enabled: recordData.IsEnabled,
      enabledAt: recordData.EnabledAt || null,
      backupCodesRemaining: current.length,
      legacyBackupCodesInvalidated: recordData.IsEnabled && all.length > current.length,
    };
  }

  /**
   * Remaining lockout for the account, or null when it is not locked.
   */
  public async GetLockedUntil(userId: number): Promise<Date | null> {
    const record = await TwoFactorAuth.findOne({ where: { UserId: userId } });
    const lockedUntil = record?.get('LockedUntil') as Date | null | undefined;
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      return new Date(lockedUntil);
    }
    return null;
  }

  /**
   * Count a failed second-factor attempt. After TWO_FACTOR_MAX_FAILURES the
   * account is locked for TWO_FACTOR_LOCKOUT_MS. Returns true when this
   * failure triggered the lock.
   */
  public async RecordFailedAttempt(userId: number): Promise<boolean> {
    const record = await this.GetOrCreateRecord(userId);
    await record.increment('FailedAttempts');
    await record.reload();
    const failures = Number(record.get('FailedAttempts') ?? 0);
    if (failures >= TWO_FACTOR_MAX_FAILURES) {
      record.set('FailedAttempts', 0);
      record.set('LockedUntil', new Date(Date.now() + TWO_FACTOR_LOCKOUT_MS));
      await record.save();
      Logger.Warn('Two-factor lockout triggered', { userId });
      return true;
    }
    return false;
  }

  /** Clear the failure counter after a successful second factor. */
  public async ResetFailedAttempts(userId: number): Promise<void> {
    await TwoFactorAuth.update(
      { FailedAttempts: 0, LockedUntil: null },
      { where: { UserId: userId } }
    );
  }

  private async GetUserOrThrow(userId: number): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  private async GetOrCreateRecord(userId: number): Promise<TwoFactorAuth> {
    const [record] = await TwoFactorAuth.findOrCreate({
      where: { UserId: userId },
      defaults: { UserId: userId, IsEnabled: false } as any,
    });
    return record;
  }

  private DecryptSecret(record: TwoFactorAuth): string | null {
    const recordData = record.toJSON();
    if (!recordData.Secret || !recordData.SecretIv || !recordData.SecretAuthTag) {
      return null;
    }
    return EncryptionHelper.Decrypt({
      Encrypted: recordData.Secret,
      Iv: recordData.SecretIv,
      AuthTag: recordData.SecretAuthTag,
    });
  }

  private VerifyCode(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
  }

  /**
   * Verify login code (TOTP or backup code)
   */
  public async VerifyLoginCode(userId: number, code: string): Promise<boolean> {
    const record = await this.GetOrCreateRecord(userId);
    const secret = this.DecryptSecret(record);
    const codes = this.ParseBackupCodes(record);

    if (secret && this.VerifyCode(secret, code)) {
      await record.update({ LastUsedAt: new Date() });
      return true;
    }

    // Check backup codes and remove if used
    const index = this.FindBackupCodeIndex(codes, code);
    if (index !== -1) {
      codes.splice(index, 1);
      record.set('BackupCodes', JSON.stringify(codes));
      record.set('LastUsedAt', new Date());
      await record.save();
      return true;
    }

    return false;
  }

  /**
   * Issue BACKUP_CODE_COUNT codes of 80 random bits each, shown to the user
   * once as XXXX-XXXX-XXXX-XXXX and stored as salted SHA-256 hashes.
   */
  private GenerateBackupCodes(): { codes: string[]; hashes: string[] } {
    const codes: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
      const raw = EncodeBase32(crypto.randomBytes(BACKUP_CODE_BYTES));
      const salt = crypto.randomBytes(16);
      codes.push(raw.match(/.{1,4}/g)?.join('-') ?? raw);
      hashes.push(`${BACKUP_CODE_HASH_PREFIX}${salt.toString('hex')}$${HashBackupCode(raw, salt)}`);
    }
    return { codes, hashes };
  }

  /**
   * Index of the stored hash matching `code`, or -1. Only v3.0.1 salted
   * hashes are considered: legacy 20-bit codes are invalidated (SEC-C3).
   */
  private FindBackupCodeIndex(storedHashes: string[], code: string): number {
    const normalized = NormalizeBackupCode(code);
    if (!/^[0-9A-Z]{16}$/.test(normalized)) return -1;

    for (let i = 0; i < storedHashes.length; i += 1) {
      const entry = storedHashes[i];
      if (!entry || !entry.startsWith(BACKUP_CODE_HASH_PREFIX)) continue;
      const [saltHex, hashHex] = entry.slice(BACKUP_CODE_HASH_PREFIX.length).split('$');
      if (!saltHex || !hashHex) continue;
      const expected = Buffer.from(hashHex, 'hex');
      const actual = Buffer.from(HashBackupCode(normalized, Buffer.from(saltHex, 'hex')), 'hex');
      if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
        return i;
      }
    }
    return -1;
  }

  private ParseBackupCodes(record: TwoFactorAuth): string[] {
    const recordData = record.toJSON();
    if (!recordData.BackupCodes) return [];
    try {
      const parsed = JSON.parse(recordData.BackupCodes);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export default TwoFactorAuthService;
