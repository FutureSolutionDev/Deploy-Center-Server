/**
 * API Keys Service
 * Handles generation, verification, and lifecycle of personal API keys
 */

import { Op } from 'sequelize';
import { ApiKey } from '@Models/index';
import EncryptionHelper from '@Utils/EncryptionHelper';
import Logger from '@Utils/Logger';
import { EApiKeyScope } from '@Types/ICommon';

export interface IApiKeyUpdate {
  Name?: string;
  Description?: string | null;
  Scopes?: EApiKeyScope[] | string[];
  ExpiresAt?: Date | null;
  IsActive?: boolean;
}

export interface IApiKeyVerification {
  ApiKey: ApiKey;
  IsExpired: boolean;
}

export class ApiKeysService {
  private static readonly KeyPrefix = 'dc_';

  /**
   * Generate a new API key and persist its hash
   */
  public async GenerateApiKey(
    userId: number,
    name: string,
    scopes: (EApiKeyScope | string)[],
    expiresAt?: Date
  ): Promise<{ keyId: number; key: string; prefix: string }> {
    try {
      const rawKey = `${ApiKeysService.KeyPrefix}${EncryptionHelper.GenerateRandomString(32)}`;
      const keyHash = EncryptionHelper.Hash(rawKey);
      const keyPrefix = rawKey.substring(0, 12);

      const apiKey = await ApiKey.create({
        UserId: userId,
        Name: name,
        Description: null,
        KeyHash: keyHash,
        KeyPrefix: keyPrefix,
        Scopes: scopes && scopes.length > 0 ? scopes : [EApiKeyScope.DeploymentsRead],
        IsActive: true,
        ExpiresAt: expiresAt || null,
      } as any);

      Logger.Info('API key generated', { userId, apiKeyId: apiKey.get('Id') });

      return {
        keyId: apiKey.get('Id') as number,
        key: rawKey,
        prefix: keyPrefix,
      };
    } catch (error) {
      Logger.Error('Failed to generate API key', error as Error, { userId });
      throw error;
    }
  }

  /**
   * List API keys for a user (hash is not returned to caller)
   */
  public async ListApiKeys(userId: number): Promise<ApiKey[]> {
    try {
      const apiKeys = await ApiKey.findAll({
        where: { UserId: userId },
        order: [['CreatedAt', 'DESC']],
      });
      return apiKeys;
    } catch (error) {
      Logger.Error('Failed to list API keys', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Revoke (disable) an API key
   */
  public async RevokeApiKey(userId: number, keyId: number): Promise<void> {
    try {
      const apiKey = await ApiKey.findOne({
        where: { Id: keyId, UserId: userId },
      });

      if (!apiKey) {
        throw new Error('API key not found');
      }

      apiKey.set('IsActive', false);
      await apiKey.save();

      Logger.Info('API key revoked', { userId, keyId });
    } catch (error) {
      Logger.Error('Failed to revoke API key', error as Error, { userId, keyId });
      throw error;
    }
  }

  /**
   * Update API key metadata
   */
  public async UpdateApiKey(userId: number, keyId: number, updates: IApiKeyUpdate): Promise<void> {
    try {
      const apiKey = await ApiKey.findOne({
        where: { Id: keyId, UserId: userId },
      });

      if (!apiKey) {
        throw new Error('API key not found');
      }

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          apiKey.set({ [key]: value } as any);
        }
      });

      await apiKey.save();
      Logger.Info('API key updated', { userId, keyId });
    } catch (error) {
      Logger.Error('Failed to update API key', error as Error, { userId, keyId });
      throw error;
    }
  }

  /**
   * Verify provided API key string
   */
  public async VerifyApiKey(key: string): Promise<IApiKeyVerification | null> {
    try {
      if (!key || !key.startsWith(ApiKeysService.KeyPrefix)) {
        return null;
      }

      const keyHash = EncryptionHelper.Hash(key);
      const apiKey = await ApiKey.findOne({
        where: {
          KeyHash: keyHash,
          IsActive: true,
          [Op.or]: [{ ExpiresAt: null }, { ExpiresAt: { [Op.gt]: new Date() } }],
        },
      });

      if (!apiKey) {
        return null;
      }

      const expiresAt = apiKey.get('ExpiresAt') as Date | null;
      const isExpired = !!expiresAt && expiresAt.getTime() < Date.now();

      return { ApiKey: apiKey, IsExpired: isExpired };
    } catch (error) {
      Logger.Error('Failed to verify API key', error as Error);
      throw error;
    }
  }

  /**
   * Track API key usage metrics
   */
  public async TrackUsage(keyId: number): Promise<void> {
    try {
      const apiKey = await ApiKey.findByPk(keyId);
      if (!apiKey) {
        return;
      }

      apiKey.set('UsageCount', (apiKey.get('UsageCount') as number) + 1);
      apiKey.set('LastUsedAt', new Date());
      await apiKey.save();
    } catch (error) {
      Logger.Error('Failed to track API key usage', error as Error, { keyId });
      throw error;
    }
  }

  /**
   * Reactivate a revoked API key
   */
  public async ReactivateApiKey(userId: number, keyId: number): Promise<void> {
    try {
      const apiKey = await ApiKey.findOne({
        where: { Id: keyId, UserId: userId },
      });

      if (!apiKey) {
        throw new Error('API key not found');
      }

      if (apiKey.get('IsActive')) {
        throw new Error('API key is already active');
      }

      // Check if key has expired
      const expiresAt = apiKey.get('ExpiresAt') as Date | null;
      if (expiresAt && expiresAt.getTime() < Date.now()) {
        throw new Error('Cannot reactivate expired API key. Please regenerate instead.');
      }

      apiKey.set('IsActive', true);
      await apiKey.save();

      Logger.Info('API key reactivated', { userId, keyId });
    } catch (error) {
      Logger.Error('Failed to reactivate API key', error as Error, { userId, keyId });
      throw error;
    }
  }

  /**
   * Regenerate an API key (creates new key but keeps metadata)
   */
  public async RegenerateApiKey(
    userId: number,
    keyId: number
  ): Promise<{ key: string; prefix: string }> {
    try {
      const apiKey = await ApiKey.findOne({
        where: { Id: keyId, UserId: userId },
      });

      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Generate new key
      const rawKey = `${ApiKeysService.KeyPrefix}${EncryptionHelper.GenerateRandomString(32)}`;
      const keyHash = EncryptionHelper.Hash(rawKey);
      const keyPrefix = rawKey.substring(0, 12);

      // Update existing record with new key
      apiKey.set('KeyHash', keyHash);
      apiKey.set('KeyPrefix', keyPrefix);
      apiKey.set('IsActive', true);
      apiKey.set('UsageCount', 0);
      apiKey.set('LastUsedAt', null);
      await apiKey.save();

      Logger.Info('API key regenerated', { userId, keyId });

      return {
        key: rawKey,
        prefix: keyPrefix,
      };
    } catch (error) {
      Logger.Error('Failed to regenerate API key', error as Error, { userId, keyId });
      throw error;
    }
  }
}

export default ApiKeysService;
