/**
 * Authentication Service
 * Handles user authentication, JWT generation and validation
 * Following SOLID principles and PascalCase naming convention
 */

import jwt from 'jsonwebtoken';
import { User } from '@Models/index';
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
}

export interface IRegisterData {
  Username: string;
  Email: string;
  Password: string;
  Role?: EUserRole;
}

export class AuthService {
  private readonly Config = AppConfig;
  private readonly TwoFactorService = new TwoFactorAuthService();
  private readonly SessionService = new SessionService();

  /**
   * Register a new user
   */
  public async Register(data: IRegisterData): Promise<User> {
    try {
      // Validate password strength
      const passwordValidation = PasswordHelper.ValidateStrength(data.Password);
      if (!passwordValidation.IsValid) {
        throw new Error(`Password validation failed: ${passwordValidation.Errors.join(', ')}`);
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { Username: data.Username },
      });

      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Check if email already exists
      const existingEmail = await User.findOne({
        where: { Email: data.Email },
      });

      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // Hash password
      const passwordHash = await PasswordHelper.Hash(data.Password);

      // Create user
      const user = await User.create({
        Username: data.Username,
        Email: data.Email,
        PasswordHash: passwordHash,
        Role: data.Role || EUserRole.Viewer,
        IsActive: true,
        TwoFactorEnabled: false,
        AccountStatus: EAccountStatus.Active,
      } as any);

      const userData = user.toJSON();
      Logger.Info(`User registered successfully: ${userData.Username}`, { userId: userData.Id });
      return user;
    } catch (error) {
      Logger.Error('Failed to register user', error as Error, { username: data.Username });
      throw error;
    }
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

      // If 2FA is enabled, require a second step (do not issue tokens yet)
      if (userData.TwoFactorEnabled) {
        Logger.Info('Two-factor required for user login', { userId: userData.Id });
        return {
          User: user,
          TwoFactorRequired: true,
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
   * Complete login by verifying 2FA code and issuing tokens
   */
  public async CompleteTwoFactorLogin(userId: number, code: string, deviceInfo?: IDeviceInfo): Promise<{
    User: User;
    Tokens: IAuthTokens;
    SessionId: number;
  }> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const userData = user.toJSON();

      if (!userData.TwoFactorEnabled) {
        throw new Error('Two-factor authentication is not enabled for this user');
      }

      const verified = await this.TwoFactorService.VerifyLoginCode(userId, code);

      if (!verified) {
        throw new Error('Invalid two-factor code');
      }

      user.set('LastLogin', new Date());
      await user.save();

      // Create session for tracking
      const session = await this.SessionService.CreateSession(userId, deviceInfo);
      const sessionData = session.toJSON();

      const tokens = this.GenerateTokens(user);

      Logger.Info('Two-factor verification successful, tokens issued', { userId, sessionId: sessionData.Id });

      return {
        User: user,
        Tokens: tokens,
        SessionId: sessionData.Id,
      };
    } catch (error) {
      Logger.Error('Failed to complete two-factor login', error as Error, { userId });
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
