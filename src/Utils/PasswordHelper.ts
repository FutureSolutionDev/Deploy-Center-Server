/**
 * Password Helper Utility
 * bcrypt password hashing and verification
 * Following SOLID principles and PascalCase naming convention
 */

import bcrypt from 'bcrypt';

export class PasswordHelper {
  private static readonly SaltRounds = 12;

  /**
   * Hash a password using bcrypt
   */
  public static async Hash(password: string): Promise<string> {
    return await bcrypt.hash(password, PasswordHelper.SaltRounds);
  }

  /**
   * Verify a password against a hash
   */
  public static async Verify(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate a random password
   */
  public static GenerateRandomPassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    return password;
  }

  /**
   * Validate password strength
   */
  public static ValidateStrength(password: string): {
    IsValid: boolean;
    Errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      IsValid: errors.length === 0,
      Errors: errors,
    };
  }
}

export default PasswordHelper;
