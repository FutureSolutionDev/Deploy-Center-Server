/**
 * Two-Factor Authentication Service
 * Implements TOTP generation, verification, and backup codes
 */

import qrcode from 'qrcode';
import speakeasy from 'speakeasy';
import { TwoFactorAuth, User } from '@Models/index';
import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';

interface ITotpSecret {
  secret: string;
  qrCodeUrl: string;
}

export class TwoFactorAuthService {
  /**
   * Generate a new TOTP secret and QR code for a user
   */
  public async GenerateTOTP(userId: number): Promise<ITotpSecret> {
    const user = await this.GetUserOrThrow(userId);
    const secret = speakeasy.generateSecret({
      name: `Deploy Center (${user.get('Email') as string})`,
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

    if (!verified && codes.length > 0) {
      const hashed = EncryptionHelper.Hash(code.trim());
      if (codes.includes(hashed)) {
        verified = true;
      }
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

    if (!record.get('IsEnabled')) {
      throw new Error('2FA must be enabled to regenerate backup codes');
    }

    const backupCodes = this.GenerateBackupCodes();
    record.set('BackupCodes', JSON.stringify(backupCodes.hashes));
    await record.save();

    Logger.Info('Backup codes regenerated', { userId });
    return backupCodes.codes;
  }

  /**
   * Get 2FA status
   */
  public async GetStatus(userId: number): Promise<{ enabled: boolean; enabledAt?: Date | null }> {
    const record = await this.GetOrCreateRecord(userId);
    return {
      enabled: record.get('IsEnabled') as boolean,
      enabledAt: (record.get('EnabledAt') as Date | null) || null,
    };
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
    const encrypted = record.get('Secret') as string | null;
    const iv = record.get('SecretIv') as string | null;
    const authTag = record.get('SecretAuthTag') as string | null;
    if (!encrypted || !iv || !authTag) {
      return null;
    }
    return EncryptionHelper.Decrypt({
      Encrypted: encrypted,
      Iv: iv,
      AuthTag: authTag,
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

  private GenerateBackupCodes(): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: 10 }).map(() =>
      EncryptionHelper.GenerateRandomString(5).substring(0, 5).toUpperCase()
    );
    const hashes = codes.map((c) => EncryptionHelper.Hash(c));
    return { codes, hashes };
  }

  private ParseBackupCodes(record: TwoFactorAuth): string[] {
    const raw = record.get('BackupCodes') as string | null;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export default TwoFactorAuthService;
