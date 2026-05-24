/**
 * User Settings Service
 * Handles per-user preference settings (timezone, language, theme, etc.).
 *
 * v3.0: legacy per-user notification fields (DiscordWebhookUrl /
 * SlackWebhookUrl / NotifyOn* flags) were removed — they were never wired
 * to the deployment notification fan-out path. All notifications now flow
 * through NotificationProvider → NotificationChannel →
 * ProjectNotificationSubscription (F-006).
 */

import { UserSettings } from '@Models/index';
import Logger from '@Utils/Logger';

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
}

export default UserSettingsService;
