/**
 * Two-Factor Authentication Service
 * NOTE: Currently stubbed. Implement TOTP generation and verification in next iteration.
 */

import Logger from '@Utils/Logger';

export class TwoFactorAuthService {
  public async GenerateTOTP(
    userId: number
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    Logger.Warn('GenerateTOTP is not implemented yet', { userId });
    throw new Error('Two-factor authentication is not implemented yet');
  }

  public async Enable2FA(userId: number, _totpCode: string): Promise<{ backupCodes: string[] }> {
    Logger.Warn('Enable2FA is not implemented yet', { userId });
    throw new Error('Two-factor authentication is not implemented yet');
  }

  public async Disable2FA(userId: number, _code: string): Promise<void> {
    Logger.Warn('Disable2FA is not implemented yet', { userId });
    throw new Error('Two-factor authentication is not implemented yet');
  }

  public async VerifyTOTP(userId: number, _code: string): Promise<boolean> {
    Logger.Warn('VerifyTOTP is not implemented yet', { userId });
    return false;
  }

  public async RegenerateBackupCodes(userId: number): Promise<string[]> {
    Logger.Warn('RegenerateBackupCodes is not implemented yet', { userId });
    throw new Error('Two-factor authentication is not implemented yet');
  }

  public async VerifyBackupCode(userId: number, _code: string): Promise<boolean> {
    Logger.Warn('VerifyBackupCode is not implemented yet', { userId });
    return false;
  }
}

export default TwoFactorAuthService;
