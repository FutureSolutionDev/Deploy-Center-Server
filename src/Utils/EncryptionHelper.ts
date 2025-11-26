/**
 * Encryption Helper Utility
 * AES-256-GCM encryption for sensitive data
 * Following SOLID principles and PascalCase naming convention
 */

import crypto from 'crypto';
import AppConfig from '@Config/AppConfig';

export interface IEncryptedData {
  Encrypted: string;
  Iv: string;
  AuthTag: string;
}

export class EncryptionHelper {
  private static readonly Algorithm = 'aes-256-gcm';
  private static Key: Buffer;

  /**
   * Initialize encryption key
   */
  private static InitializeKey(): void {
    if (!EncryptionHelper.Key) {
      const config = AppConfig;
      EncryptionHelper.Key = Buffer.from(config.EncryptionKey, 'utf8').slice(0, 32);
    }
  }

  /**
   * Encrypt a string value
   */
  public static Encrypt(value: string): IEncryptedData {
    EncryptionHelper.InitializeKey();

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      EncryptionHelper.Algorithm,
      EncryptionHelper.Key,
      iv
    );

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      Encrypted: encrypted,
      Iv: iv.toString('hex'),
      AuthTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt an encrypted value
   */
  public static Decrypt(encryptedData: IEncryptedData): string {
    EncryptionHelper.InitializeKey();

    const decipher = crypto.createDecipheriv(
      EncryptionHelper.Algorithm,
      EncryptionHelper.Key,
      Buffer.from(encryptedData.Iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.AuthTag, 'hex'));

    let decrypted = decipher.update(encryptedData.Encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate random string (for secrets, tokens, etc.)
   */
  public static GenerateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a string using SHA-256
   */
  public static Hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Create HMAC signature
   */
  public static CreateHmacSignature(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature (timing-safe comparison)
   */
  public static VerifyHmacSignature(
    data: string,
    secret: string,
    signature: string
  ): boolean {
    const expectedSignature = EncryptionHelper.CreateHmacSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

export default EncryptionHelper;
