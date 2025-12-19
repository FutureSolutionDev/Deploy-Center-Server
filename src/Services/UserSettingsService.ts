/**
 * User Settings Service
 * Handles notification and preference settings for users
 */

import axios from 'axios';
import { UserSettings } from '@Models/index';
import Logger from '@Utils/Logger';

export interface INotificationSettingsUpdate {
  EmailNotifications?: boolean;
  DiscordWebhookUrl?: string | null;
  SlackWebhookUrl?: string | null;
  NotifyOnSuccess?: boolean;
  NotifyOnFailure?: boolean;
  NotifyOnProjectUpdate?: boolean;
  NotifyOnSystemAlert?: boolean;
}

export interface IUserPreferencesUpdate {
  Timezone?: string;
  DateFormat?: string;
  TimeFormat?: '12h' | '24h';
  Language?: string;
  Theme?: string;
  ColorTheme?: string;
}

export class UserSettingsService {
  /**
   * Get user settings or create defaults if none exist
   */
  public async GetUserSettings(userId: number): Promise<UserSettings> {
    try {
      let settings = await UserSettings.findOne({ where: { UserId: userId } });

      if (!settings) {
        settings = await UserSettings.create({
          UserId: userId,
        } as any);

        Logger.Info('Created default user settings', { userId });
      }

      return settings;
    } catch (error) {
      Logger.Error('Failed to get user settings', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Update notification settings
   */
  public async UpdateNotificationSettings(
    userId: number,
    settings: INotificationSettingsUpdate
  ): Promise<UserSettings> {
    try {
      const existingSettings = await this.GetUserSettings(userId);

      Object.entries(settings).forEach(([key, value]) => {
        if (value !== undefined) {
          existingSettings.set({ [key]: value } as any);
        }
      });

      await existingSettings.save();
      Logger.Info('Updated notification settings', { userId });

      return existingSettings;
    } catch (error) {
      Logger.Error('Failed to update notification settings', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  public async UpdatePreferences(
    userId: number,
    preferences: IUserPreferencesUpdate
  ): Promise<UserSettings> {
    try {
      const existingSettings = await this.GetUserSettings(userId);

      Object.entries(preferences).forEach(([key, value]) => {
        if (value !== undefined) {
          existingSettings.set({ [key]: value } as any);
        }
      });

      await existingSettings.save();
      Logger.Info('Updated user preferences', { userId });

      return existingSettings;
    } catch (error) {
      Logger.Error('Failed to update user preferences', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Send a test notification to Discord or Slack
   */
  public async TestNotification(userId: number, type: 'discord' | 'slack'): Promise<void> {
    try {
      const settings = await this.GetUserSettings(userId);
      const now = new Date().toISOString();

      const settingsData = settings.toJSON();

      if (type === 'discord') {
        if (!settingsData.DiscordWebhookUrl) {
          throw new Error('Discord webhook URL is not configured');
        }

        await axios.post(settingsData.DiscordWebhookUrl, {
          username: 'Deploy Center',
          content: `Deploy Center test notification - ${now}`,
        });
        return;
      }

      if (!settingsData.SlackWebhookUrl) {
        throw new Error('Slack webhook URL is not configured');
      }

      await axios.post(settingsData.SlackWebhookUrl, {
        username: 'Deploy Center',
        text: `Deploy Center test notification - ${now}`,
      });
    } catch (error) {
      Logger.Error('Failed to send test notification', error as Error, { userId, type });
      throw error;
    }
  }
}

export default UserSettingsService;
