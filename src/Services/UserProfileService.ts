/**
 * User Profile Service
 * Handles profile updates and retrieval
 */

import { User, UserSettings } from '@Models/index';
import AuthService from './AuthService';
import Logger from '@Utils/Logger';

export interface IProfileUpdate {
  Username?: string;
  Email?: string;
  FullName?: string | null;
  AvatarUrl?: string | null;
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

      // Validate username uniqueness
      if (data.Username && data.Username !== user.get('Username')) {
        const existingUser = await User.findOne({
          where: { Username: data.Username },
        });

        if (existingUser) {
          throw new Error('Username already exists');
        }
      }

      // Validate email uniqueness
      if (data.Email && data.Email !== user.get('Email')) {
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
}

export default UserProfileService;
