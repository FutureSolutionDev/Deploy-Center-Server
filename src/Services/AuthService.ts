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
import { EUserRole } from '@Types/ICommon';

export interface IAuthTokens {
  AccessToken: string;
  RefreshToken: string;
}

export interface ITokenPayload {
  UserId: number;
  Username: string;
  Email: string;
  Role: EUserRole;
}

export interface ILoginCredentials {
  Username: string;
  Password: string;
}

export interface IRegisterData {
  Username: string;
  Email: string;
  Password: string;
  Role?: EUserRole;
}

export class AuthService {
  private readonly Config = AppConfig;

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
      } as any);

      Logger.Info(`User registered successfully: ${user.get('Username')}`, { userId: user.get('Id') });
      return user;
    } catch (error) {
      Logger.Error('Failed to register user', error as Error, { username: data.Username });
      throw error;
    }
  }

  /**
   * Login user with credentials
   */
  public async Login(credentials: ILoginCredentials): Promise<{
    User: User;
    Tokens: IAuthTokens;
  }> {
    try {
      // Find user
      const user = await User.findOne({
        where: { Username: credentials.Username },
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.get('IsActive')) {
        throw new Error('User account is disabled');
      }

      // Verify password
      const isPasswordValid = await PasswordHelper.Verify(
        credentials.Password,
        user.get('PasswordHash') as string
      );

      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      user.set('LastLogin', new Date());
      await user.save();

      // Generate tokens
      const tokens = this.GenerateTokens(user);

      Logger.Info(`User logged in successfully: ${user.get('Username')}`, { userId: user.get('Id') });

      return {
        User: user,
        Tokens: tokens,
      };
    } catch (error) {
      Logger.Error('Failed to login', error as Error, { username: credentials.Username });
      throw error;
    }
  }

  /**
   * Generate JWT access and refresh tokens
   */
  public GenerateTokens(user: User): IAuthTokens {
    const payload: ITokenPayload = {
      UserId: user.get('Id') as number,
      Username: user.get('Username') as string,
      Email: user.get('Email') as string,
      Role: user.get('Role') as EUserRole,
    };

    const accessToken = jwt.sign(payload, this.Config.Jwt.Secret, {
      expiresIn: this.Config.Jwt.Expiry,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { UserId: user.get('Id') },
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

      if (!user.get('IsActive')) {
        throw new Error('User account is disabled');
      }

      // Generate new tokens
      const tokens = this.GenerateTokens(user);

      Logger.Info(`Access token refreshed for user: ${user.get('Username')}`, { userId: user.get('Id') });

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

      // Verify old password
      const isOldPasswordValid = await PasswordHelper.Verify(oldPassword, user.get('PasswordHash') as string);

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
      await user.save();

      Logger.Info(`Password changed successfully for user: ${user.get('Username')}`, {
        userId: user.get('Id'),
      });
    } catch (error) {
      Logger.Error('Failed to change password', error as Error, { userId });
      throw error;
    }
  }
}

export default AuthService;
