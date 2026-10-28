/**
 * Authentication Service
 * Handles user authentication, JWT generation and validation
 * Following SOLID principles and PascalCase naming convention
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Op, Transaction } from 'sequelize';
import { MfaChallenge, User } from '@Models/index';
import PasswordHelper from '@Utils/PasswordHelper';
import AppConfig from '@Config/AppConfig';
import Logger from '@Utils/Logger';
import { EAccountStatus, EUserRole } from '@Types/ICommon';
import TwoFactorAuthService from './TwoFactorAuthService';
import { SessionService, type IDeviceInfo } from './SessionService';

export interface IAuthTokens {
  AccessToken: string;
  RefreshToken: string;
}

export interface ITokenPayload {
  UserId: number;
  Username: string;
  FullName: string;
  Email: string;
  Role: EUserRole;
}

export interface ILoginCredentials {
  Username: string;
  Password: string;
}

export interface ILoginResult {
  User: User;
  Tokens?: IAuthTokens;
  SessionId?: number;
  TwoFactorRequired: boolean;
  /** Raw single-use token for the `mfa_pending` cookie (2FA accounts only). */
  MfaToken?: string;
}

/** Lifetime of the password-step proof used by /verify-2fa (SEC-C3). */
export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** Wrong codes accepted against one challenge before it is burned. */
export const MFA_CHALLENGE_MAX_ATTEMPTS = 5;

/** The mfa_pending token is missing, unknown, expired or already used. */
export class MfaChallengeError extends Error {
  constructor(message: string = 'Two-factor session expired. Please sign in again.') {
    super(message);
    this.name = 'MfaChallengeError';
  }
}

/** Too many failed second-factor attempts on this account. */
export class TwoFactorLockedError extends Error {
  public readonly LockedUntil: Date;
  constructor(lockedUntil: Date) {
    super('Too many failed two-factor attempts. Try again later.');
    this.name = 'TwoFactorLockedError';
    this.LockedUntil = lockedUntil;
  }
}

function HashMfaToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Self-registration input. `Role` is intentionally absent: the server decides
 * the role (SEC-C1). Callers must never forward a client-supplied role here.
 */
export interface IRegisterData {
  Username: string;
  Email: string;
  Password: string;
}

/** Thrown when public registration is closed and the system already has users. */
export class RegistrationClosedError extends Error {
  constructor() {
    super('Registration is disabled. Ask an administrator to create your account.');
    this.name = 'RegistrationClosedError';
  }
}

export class AuthService {
  private readonly Config = AppConfig;
  private readonly TwoFactorService = new TwoFactorAuthService();
  private readonly SessionService = new SessionService();

  /**
   * Register a new user (SEC-C1).
   *
   * Policy:
   *   - The very first account on an empty system is always allowed and
   *     becomes Admin (bootstrap path for fresh installs).
   *   - Every later self-registration requires ALLOW_REGISTRATION=true and
   *     always creates a Viewer. A client-supplied role is never honoured.
   *
   * The user-count check and the insert run in one SERIALIZABLE transaction so
   * two concurrent "first user" requests cannot both become Admin.
   */
  public async Register(data: IRegisterData): Promise<User> {
    try {
      const passwordValidation = PasswordHelper.ValidateStrength(data.Password);
      if (!passwordValidation.IsValid) {
        throw new Error(`Password validation failed: ${passwordValidation.Errors.join(', ')}`);
      }

      const passwordHash = await PasswordHelper.Hash(data.Password);
      const sequelize = User.sequelize;
      if (!sequelize) {
        throw new Error('Database is not initialized');
      }

      const user = await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
        async (transaction) => {
          const userCount = await User.count({ transaction });
          const isFirstUser = userCount === 0;

          if (!isFirstUser && !this.Config.AllowRegistration) {
            throw new RegistrationClosedError();
          }

          const existingUser = await User.findOne({
            where: { Username: data.Username },
            transaction,
          });
          if (existingUser) {
            throw new Error('Username already exists');
          }

          const existingEmail = await User.findOne({
            where: { Email: data.Email },
            transaction,
          });
          if (existingEmail) {
            throw new Error('Email already exists');
          }

          return User.create(
            {
              Username: data.Username,
              Email: data.Email,
              PasswordHash: passwordHash,
              Role: isFirstUser ? EUserRole.Admin : EUserRole.Viewer,
              IsActive: true,
              TwoFactorEnabled: false,
              AccountStatus: EAccountStatus.Active,
            } as never,
            { transaction }
          );
        }
      );

      const userData = user.toJSON();
      Logger.Info(`User registered successfully: ${userData.Username}`, {
        userId: userData.Id,
        role: userData.Role,
      });
      return user;
    } catch (error) {
      if (error instanceof RegistrationClosedError) {
        Logger.Warn('Registration attempt rejected: registration is closed');
      } else {
        Logger.Error('Failed to register user', error as Error, { username: data.Username });
      }
      throw error;
    }
  }

  /**
   * True when the system has no user accounts yet (fresh install). The first
   * registration on such a system creates the initial Admin.
   */
  public async IsSetupRequired(): Promise<boolean> {
    const userCount = await User.count();
    return userCount === 0;
  }

  /**
   * Login user with credentials
   */
  public async Login(credentials: ILoginCredentials, deviceInfo?: IDeviceInfo): Promise<ILoginResult> {
    try {
      // Find user
      const user = await User.findOne({
        where: { Username: credentials.Username },
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      const userData = user.toJSON();

      // Check if user is active
      if (!userData.IsActive) {
        throw new Error('User account is disabled');
      }

      if (userData.AccountStatus === EAccountStatus.Suspended) {
        throw new Error('User account is suspended');
      }

      if (userData.AccountStatus === EAccountStatus.Deleted) {
        throw new Error('User account is deleted');
      }

      // Verify password
      const isPasswordValid = await PasswordHelper.Verify(
        credentials.Password,
        userData.PasswordHash
      );

      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // If 2FA is enabled, require a second step (do not issue tokens yet).
      // The password step is proven by a short-lived single-use token bound
      // to this user, delivered as an httpOnly cookie (SEC-C3).
      if (userData.TwoFactorEnabled) {
        const mfaToken = await this.CreateMfaChallenge(userData.Id, deviceInfo?.IpAddress);
        Logger.Info('Two-factor required for user login', { userId: userData.Id });
        return {
          User: user,
          TwoFactorRequired: true,
          MfaToken: mfaToken,
        };
      }

      // Update last login
      user.set('LastLogin', new Date());
      await user.save();

      // Create session for tracking
      const session = await this.SessionService.CreateSession(userData.Id, deviceInfo);
      const sessionData = session.toJSON();

      // Generate tokens
      const tokens = this.GenerateTokens(user);

      Logger.Info(`User logged in successfully: ${userData.Username}`, { userId: userData.Id, sessionId: sessionData.Id });

      return {
        User: user,
        Tokens: tokens,
        SessionId: sessionData.Id,
        TwoFactorRequired: false,
      };
    } catch (error) {
      Logger.Error('Failed to login', error as Error, { username: credentials.Username });
      throw error;
    }
  }

  /**
   * Persist a new MFA challenge and return the raw token (only its hash is
   * stored). Expired challenges older than a day are pruned opportunistically.
   */
  private async CreateMfaChallenge(userId: number, ipAddress?: string): Promise<string> {
    await MfaChallenge.destroy({
      where: { ExpiresAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    const token = crypto.randomBytes(32).toString('base64url');
    await MfaChallenge.create({
      UserId: userId,
      TokenHash: HashMfaToken(token),
      ExpiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS),
      IpAddress: ipAddress ? ipAddress.slice(0, 64) : null,
    });
    return token;
  }

  /**
   * Complete login by verifying the 2FA code against the challenge issued by
   * the password step (SEC-C3). The user is derived from the challenge, never
   * from the request body.
   *
   * Concurrency: the challenge is claimed atomically (ConsumedAt set while
   * still NULL) before the code is checked, so only one guess per challenge
   * can be in flight. A wrong code releases the claim until
   * MFA_CHALLENGE_MAX_ATTEMPTS is reached; a correct one keeps it consumed.
   */
  public async CompleteTwoFactorLogin(
    mfaToken: unknown,
    code: string,
    deviceInfo?: IDeviceInfo
  ): Promise<{
    User: User;
    Tokens: IAuthTokens;
    SessionId: number;
  }> {
    let userId: number | undefined;
    try {
      // A missing or malformed cookie hashes to a value no challenge has, so
      // the lookup below is the only decision.
      const token = typeof mfaToken === 'string' ? mfaToken : '';
      const challenge = await MfaChallenge.findOne({
        where: { TokenHash: HashMfaToken(token) },
      });
      if (!challenge || challenge.ConsumedAt || new Date(challenge.ExpiresAt) <= new Date()) {
        throw new MfaChallengeError();
      }

      const [claimed] = await MfaChallenge.update(
        { ConsumedAt: new Date() },
        { where: { Id: challenge.Id, ConsumedAt: null } }
      );
      if (claimed !== 1) {
        throw new MfaChallengeError();
      }

      userId = challenge.UserId;
      const user = await User.findByPk(userId);
      if (
        !user ||
        !user.IsActive ||
        (user.AccountStatus && user.AccountStatus !== EAccountStatus.Active) ||
        !user.TwoFactorEnabled
      ) {
        throw new MfaChallengeError('Two-factor verification is not available for this account');
      }

      const lockedUntil = await this.TwoFactorService.GetLockedUntil(userId);
      if (lockedUntil) {
        throw new TwoFactorLockedError(lockedUntil);
      }

      const verified = await this.TwoFactorService.VerifyLoginCode(userId, code);
      if (!verified) {
        const attempts = challenge.Attempts + 1;
        const exhausted = attempts >= MFA_CHALLENGE_MAX_ATTEMPTS;
        await MfaChallenge.update(
          { Attempts: attempts, ConsumedAt: exhausted ? new Date() : null },
          { where: { Id: challenge.Id } }
        );
        const locked = await this.TwoFactorService.RecordFailedAttempt(userId);
        if (locked) {
          const until = await this.TwoFactorService.GetLockedUntil(userId);
          throw new TwoFactorLockedError(until ?? new Date());
        }
        if (exhausted) {
          throw new MfaChallengeError('Too many invalid codes. Please sign in again.');
        }
        throw new Error('Invalid two-factor code');
      }

      await this.TwoFactorService.ResetFailedAttempts(userId);

      user.set('LastLogin', new Date());
      await user.save();

      const session = await this.SessionService.CreateSession(userId, deviceInfo);
      const sessionData = session.toJSON();

      const tokens = this.GenerateTokens(user);

      Logger.Info('Two-factor verification successful, tokens issued', {
        userId,
        sessionId: sessionData.Id,
      });

      return {
        User: user,
        Tokens: tokens,
        SessionId: sessionData.Id,
      };
    } catch (error) {
      Logger.Warn('Failed to complete two-factor login', {
        userId,
        reason: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate JWT access and refresh tokens
   */
  public GenerateTokens(user: User): IAuthTokens {
    const userData = user.toJSON();

    const payload: ITokenPayload = {
      UserId: userData.Id,
      Username: userData.Username,
      FullName: userData.FullName || '',
      Email: userData.Email,
      Role: userData.Role,
    };

    const accessToken = jwt.sign(payload, this.Config.Jwt.Secret, {
      expiresIn: this.Config.Jwt.Expiry,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { UserId: userData.Id },
      this.Config.Jwt.RefreshSecret,
      {
        expiresIn: this.Config.Jwt.RefreshExpiry,
      } as jwt.SignOptions
    );

    return {
      AccessToken: accessToken,
      RefreshToken: refreshToken,
    };
  }

  /**
   * Verify JWT access token
   */
  public VerifyAccessToken(token: string): ITokenPayload {
    try {
      const decoded = jwt.verify(token, this.Config.Jwt.Secret) as ITokenPayload;
      return decoded;
    } catch (error) {
      Logger.Warn('Invalid or expired access token', { error: (error as Error).message });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Verify JWT refresh token
   */
  public VerifyRefreshToken(token: string): { UserId: number } {
    try {
      const decoded = jwt.verify(token, this.Config.Jwt.RefreshSecret) as {
        UserId: number;
      };
      return decoded;
    } catch (error) {
      Logger.Warn('Invalid or expired refresh token', { error: (error as Error).message });
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async RefreshAccessToken(refreshToken: string): Promise<IAuthTokens> {
    try {
      // Verify refresh token
      const decoded = this.VerifyRefreshToken(refreshToken);

      // Get user
      const user = await User.findByPk(decoded.UserId);

      if (!user) {
        throw new Error('User not found');
      }

      const userData = user.toJSON();

      if (!userData.IsActive) {
        throw new Error('User account is disabled');
      }

      // Generate new tokens
      const tokens = this.GenerateTokens(user);

      Logger.Info(`Access token refreshed for user: ${userData.Username}`, { userId: userData.Id });

      return tokens;
    } catch (error) {
      Logger.Error('Failed to refresh access token', error as Error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  public async GetUserById(userId: number): Promise<User | null> {
    try {
      const user = await User.findByPk(userId);
      return user;
    } catch (error) {
      Logger.Error('Failed to get user by ID', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Change user password
   */
  public async ChangePassword(
    userId: number,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const userData = user.toJSON();

      // Verify old password
      const isOldPasswordValid = await PasswordHelper.Verify(oldPassword, userData.PasswordHash);

      if (!isOldPasswordValid) {
        throw new Error('Invalid old password');
      }

      // Validate new password strength
      const passwordValidation = PasswordHelper.ValidateStrength(newPassword);
      if (!passwordValidation.IsValid) {
        throw new Error(`Password validation failed: ${passwordValidation.Errors.join(', ')}`);
      }

      // Hash new password
      const newPasswordHash = await PasswordHelper.Hash(newPassword);

      // Update password
      user.set('PasswordHash', newPasswordHash);
      user.set('LastPasswordChangeAt', new Date());
      await user.save();

      Logger.Info(`Password changed successfully for user: ${userData.Username}`, {
        userId: userData.Id,
      });
    } catch (error) {
      Logger.Error('Failed to change password', error as Error, { userId });
      throw error;
    }
  }
}

export default AuthService;
