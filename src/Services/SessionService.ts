/**
 * Session Service
 * Manages user sessions for account security
 */

import { Op } from 'sequelize';
import { UserSession } from '@Models/index';
import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';

export interface IDeviceInfo {
  Browser?: string;
  Os?: string;
  Device?: string;
  IpAddress?: string;
  UserAgent?: string;
}

export class SessionService {
  /**
   * Create a new session token for a user
   */
  public async CreateSession(userId: number, deviceInfo?: IDeviceInfo): Promise<string> {
    try {
      const token = EncryptionHelper.GenerateRandomString(32);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await UserSession.create({
        UserId: userId,
        SessionToken: token,
        DeviceInfo: deviceInfo || null,
        IpAddress: deviceInfo?.IpAddress || null,
        UserAgent: deviceInfo?.UserAgent || null,
        IsActive: true,
        ExpiresAt: expiresAt,
        CreatedAt: now,
        LastActivityAt: now,
      } as any);

      Logger.Info('Session created', { userId });
      return token;
    } catch (error) {
      Logger.Error('Failed to create session', error as Error, { userId });
      throw error;
    }
  }

  /**
   * List active sessions for a user
   */
  public async ListActiveSessions(userId: number): Promise<UserSession[]> {
    try {
      const now = new Date();
      const sessions = await UserSession.findAll({
        where: {
          UserId: userId,
          IsActive: true,
          ExpiresAt: { [Op.gt]: now },
        },
        order: [['CreatedAt', 'DESC']],
      });

      return sessions;
    } catch (error) {
      Logger.Error('Failed to list active sessions', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Revoke a specific session for a user
   */
  public async RevokeSession(userId: number, sessionId: number): Promise<void> {
    try {
      const session = await UserSession.findOne({
        where: { Id: sessionId, UserId: userId },
      });

      if (!session) {
        throw new Error('Session not found');
      }

      session.set('IsActive', false);
      await session.save();
      Logger.Info('Session revoked', { userId, sessionId });
    } catch (error) {
      Logger.Error('Failed to revoke session', error as Error, { userId, sessionId });
      throw error;
    }
  }

  /**
   * Revoke all sessions except the current one
   */
  public async RevokeAllOtherSessions(userId: number, currentSessionId: number): Promise<void> {
    try {
      await UserSession.update(
        { IsActive: false },
        {
          where: {
            UserId: userId,
            Id: { [Op.ne]: currentSessionId },
          },
        }
      );

      Logger.Info('Revoked all other sessions', { userId, currentSessionId });
    } catch (error) {
      Logger.Error('Failed to revoke other sessions', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Verify a session token
   */
  public async VerifySession(sessionToken: string): Promise<UserSession | null> {
    try {
      const session = await UserSession.findOne({
        where: {
          SessionToken: sessionToken,
          IsActive: true,
          ExpiresAt: { [Op.gt]: new Date() },
        },
      });

      return session;
    } catch (error) {
      Logger.Error('Failed to verify session', error as Error);
      throw error;
    }
  }

  /**
   * Update last activity timestamp
   */
  public async UpdateActivity(sessionId: number): Promise<void> {
    try {
      await UserSession.update(
        { LastActivityAt: new Date() },
        {
          where: { Id: sessionId },
        }
      );
    } catch (error) {
      Logger.Error('Failed to update session activity', error as Error, { sessionId });
      throw error;
    }
  }
}

export default SessionService;
