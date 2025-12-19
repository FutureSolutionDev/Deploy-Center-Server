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
  public async CreateSession(userId: number, deviceInfo?: IDeviceInfo): Promise<UserSession> {
    try {
      const token = EncryptionHelper.GenerateRandomString(32);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const session = await UserSession.create({
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

      Logger.Info('Session created', { userId, sessionId: session.get('Id') });
      return session;
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
   * Revoke a specific session for a user (marks as inactive)
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
   * Delete a specific session (permanent deletion)
   */
  public async DeleteSession(userId: number, sessionId: number): Promise<void> {
    try {
      const deleted = await UserSession.destroy({
        where: { Id: sessionId, UserId: userId },
      });

      if (deleted === 0) {
        throw new Error('Session not found');
      }

      Logger.Info('Session deleted', { userId, sessionId });
    } catch (error) {
      Logger.Error('Failed to delete session', error as Error, { userId, sessionId });
      throw error;
    }
  }

  /**
   * Delete session by token (for logout)
   */
  public async DeleteSessionByToken(sessionToken: string): Promise<void> {
    try {
      const deleted = await UserSession.destroy({
        where: { SessionToken: sessionToken },
      });

      if (deleted === 0) {
        Logger.Warn('Session token not found for deletion', { sessionToken });
      } else {
        Logger.Info('Session deleted by token');
      }
    } catch (error) {
      Logger.Error('Failed to delete session by token', error as Error);
      throw error;
    }
  }

  /**
   * Delete the user's most recent active session (for logout without token)
   */
  public async DeleteCurrentSession(userId: number): Promise<void> {
    try {
      // Find the most recent active session
      const session = await UserSession.findOne({
        where: {
          UserId: userId,
          IsActive: true,
        },
        order: [['LastActivityAt', 'DESC']],
      });

      if (session) {
        await session.destroy();
        Logger.Info('Current session deleted on logout', { userId, sessionId: session.get('Id') });
      } else {
        Logger.Warn('No active session found to delete on logout', { userId });
      }
    } catch (error) {
      Logger.Error('Failed to delete current session', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get session ID by session token
   */
  public async GetSessionIdByToken(sessionToken: string): Promise<number | null> {
    try {
      const session = await UserSession.findOne({
        where: { SessionToken: sessionToken },
        attributes: ['Id'],
      });

      return session ? session.get('Id') as number : null;
    } catch (error) {
      Logger.Error('Failed to get session ID by token', error as Error);
      return null;
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
