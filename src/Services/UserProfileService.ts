/**
 * User Profile Service
 * Handles profile updates and retrieval
 */

import { User, UserSettings } from '@Models/index';
import AuthService from './AuthService';
import Logger from '@Utils/Logger';
import PasswordHelper from '@Utils/PasswordHelper';
import { EAccountStatus } from '@Types/ICommon';
import { Op } from 'sequelize';

export interface IProfileUpdate {
  Username?: string;
  Email?: string;
  FullName?: string | null;
  AvatarUrl?: string | null;
}

export interface IUserFilters {
  role?: string;
  isActive?: boolean;
  search?: string;
}

export interface ICreateUserData {
  username: string;
  email: string;
  password: string;
  role: string;
  fullName?: string;
}

export class UserProfileService {
  private readonly AuthService: AuthService;

  constructor() {
    this.AuthService = new AuthService();
  }

  /**
   * Update user profile fields
   */
  public async UpdateProfile(userId: number, data: IProfileUpdate): Promise<User> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const userData = user.toJSON();

      // Validate username uniqueness
      if (data.Username && data.Username !== userData.Username) {
        const existingUser = await User.findOne({
          where: { Username: data.Username },
        });

        if (existingUser) {
          throw new Error('Username already exists');
        }
      }

      // Validate email uniqueness
      if (data.Email && data.Email !== userData.Email) {
        const existingEmail = await User.findOne({
          where: { Email: data.Email },
        });

        if (existingEmail) {
          throw new Error('Email already exists');
        }
      }

      // Apply updates
      if (data.Username !== undefined) {
        user.set('Username', data.Username);
      }

      if (data.Email !== undefined) {
        user.set('Email', data.Email);
      }

      if (data.FullName !== undefined) {
        user.set('FullName', data.FullName);
      }

      if (data.AvatarUrl !== undefined) {
        user.set('AvatarUrl', data.AvatarUrl);
      }

      await user.save();
      Logger.Info('User profile updated', { userId });

      return user;
    } catch (error) {
      Logger.Error('Failed to update user profile', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Upload avatar - stub until file storage pipeline is defined
   */
  public async UploadAvatar(userId: number, _file: any): Promise<string> {
    Logger.Warn('Avatar upload called but not implemented', { userId });
    throw new Error('Avatar upload is not implemented yet');
  }

  /**
   * Change password (delegates to AuthService)
   */
  public async ChangePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await this.AuthService.ChangePassword(userId, currentPassword, newPassword);
  }

  /**
   * Get user profile with settings
   */
  public async GetFullProfile(userId: number): Promise<User | null> {
    try {
      const user = await User.findByPk(userId, {
        include: [
          {
            model: UserSettings,
            as: 'Settings',
          },
        ],
      });

      return user;
    } catch (error) {
      Logger.Error('Failed to get full profile', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get all users with optional filters (Admin/Manager only)
   */
  public async GetAllUsers(filters: IUserFilters): Promise<User[]> {
    try {
      const where: any = {};

      if (filters.role) {
        where.Role = filters.role;
      }

      if (filters.isActive !== undefined) {
        where.IsActive = filters.isActive;
      }

      if (filters.search) {
        where[Op.or] = [
          { Username: { [Op.like]: `%${filters.search}%` } },
          { Email: { [Op.like]: `%${filters.search}%` } },
          { FullName: { [Op.like]: `%${filters.search}%` } },
        ];
      }

      const users = await User.findAll({
        where,
        attributes: { exclude: ['PasswordHash'] },
        order: [['CreatedAt', 'DESC']],
      });

      Logger.Info('Users retrieved', { count: users.length, filters });
      return users;
    } catch (error) {
      Logger.Error('Failed to get all users', error as Error);
      throw error;
    }
  }

  /**
   * Get user by ID (Admin/Manager only)
   */
  public async GetUserById(userId: number): Promise<User> {
    try {
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['PasswordHash'] },
        include: [
          {
            model: UserSettings,
            as: 'Settings',
          },
        ],
      });

      if (!user) {
        throw new Error('User not found');
      }

      Logger.Info('User retrieved by ID', { userId });
      return user;
    } catch (error) {
      Logger.Error('Failed to get user by ID', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Create new user (Admin only)
   */
  public async CreateUser(data: ICreateUserData): Promise<User> {
    try {
      // Check if username exists
      const existingUsername = await User.findOne({
        where: { Username: data.username },
      });

      if (existingUsername) {
        throw new Error('Username already exists');
      }

      // Check if email exists
      const existingEmail = await User.findOne({
        where: { Email: data.email },
      });

      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // Validate password strength
      const passwordValidation = PasswordHelper.ValidateStrength(data.password);
      if (!passwordValidation.IsValid) {
        throw new Error(`Password validation failed: ${passwordValidation.Errors.join(', ')}`);
      }

      // Hash password
      const passwordHash = await PasswordHelper.Hash(data.password);

      // Create user
      const user = await User.create({
        Username: data.username,
        Email: data.email,
        PasswordHash: passwordHash,
        Role: data.role as any,
        FullName: data.fullName || null,
        IsActive: true,
        TwoFactorEnabled: false,
        AccountStatus: EAccountStatus.Active,
      } as any);

      Logger.Info('User created by admin', {
        userId: user.Id,
        username: user.Username,
        role: user.Role,
      });

      // Remove password hash from response
      const userJson = user.toJSON();
      delete (userJson as any).PasswordHash;

      return user;
    } catch (error) {
      Logger.Error('Failed to create user', error as Error);
      throw error;
    }
  }

  /**
   * Update user (Admin/Manager only)
   */
  public async UpdateUser(
    userId: number,
    data: { username?: string; email?: string; fullName?: string }
  ): Promise<User> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const userData = user.toJSON();

      // Validate username uniqueness
      if (data.username && data.username !== userData.Username) {
        const existingUser = await User.findOne({
          where: { Username: data.username },
        });

        if (existingUser) {
          throw new Error('Username already exists');
        }
      }

      // Validate email uniqueness
      if (data.email && data.email !== userData.Email) {
        const existingEmail = await User.findOne({
          where: { Email: data.email },
        });

        if (existingEmail) {
          throw new Error('Email already exists');
        }
      }

      // Apply updates
      if (data.username !== undefined) {
        user.set('Username', data.username);
      }

      if (data.email !== undefined) {
        user.set('Email', data.email);
      }

      if (data.fullName !== undefined) {
        user.set('FullName', data.fullName);
      }

      await user.save();
      Logger.Info('User updated by admin/manager', { userId });

      return user;
    } catch (error) {
      Logger.Error('Failed to update user', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Change user role (Admin only)
   */
  public async ChangeUserRole(userId: number, role: string): Promise<User> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const oldRole = user.Role;
      user.set('Role', role as any);
      await user.save();

      Logger.Info('User role changed', {
        userId,
        oldRole,
        newRole: role,
      });

      return user;
    } catch (error) {
      Logger.Error('Failed to change user role', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Delete user (Admin only)
   */
  public async DeleteUser(userId: number): Promise<void> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      await user.destroy();

      Logger.Info('User deleted', { userId, username: user.Username });
    } catch (error) {
      Logger.Error('Failed to delete user', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Activate user (Admin/Manager only)
   */
  public async ActivateUser(userId: number): Promise<User> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      user.set('IsActive', true);
      await user.save();

      Logger.Info('User activated', { userId });

      return user;
    } catch (error) {
      Logger.Error('Failed to activate user', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Deactivate user (Admin/Manager only)
   */
  public async DeactivateUser(userId: number): Promise<User> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      user.set('IsActive', false);
      await user.save();

      Logger.Info('User deactivated', { userId });

      return user;
    } catch (error) {
      Logger.Error('Failed to deactivate user', error as Error, { userId });
      throw error;
    }
  }
}

export default UserProfileService;
