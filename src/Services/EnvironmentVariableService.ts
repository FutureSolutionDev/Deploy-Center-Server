/**
 * EnvironmentVariableService — Deploy Center v3.0 / F-003.
 * CRUD + AES-256-GCM encrypt/decrypt + pipeline injection helper.
 * Values are NEVER returned in plaintext to controllers — list responses
 * redact secrets to "***"; the only consumer that sees plaintext is
 * PipelineService.spawn() via InjectIntoEnv (server-internal).
 */

import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';
import { EnvironmentVariable } from '@Models/EnvironmentVariable';

export interface IEnvVarInput {
  KeyName: string;
  Value: string;
  IsSecret?: boolean;
}

export interface IEnvVarPatch {
  KeyName?: string;
  Value?: string;
  IsSecret?: boolean;
}

export interface IEnvVarListItem {
  Id: number;
  KeyName: string;
  Value: string;        // "***" if IsSecret
  IsSecret: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export class EnvironmentVariableService {
  /**
   * List variables for a project. Secret values redacted to "***";
   * non-secret values returned in plaintext.
   */
  public async ListByProject(projectId: number): Promise<IEnvVarListItem[]> {
    try {
      const rows = await EnvironmentVariable.findAll({
        where: { ProjectId: projectId, IsActive: true },
        order: [['KeyName', 'ASC']],
      });
      return rows.map((row) => ({
        Id: row.Id,
        KeyName: row.KeyName,
        Value: row.IsSecret
          ? '***'
          : EncryptionHelper.Decrypt({
              Encrypted: row.ValueEncrypted,
              Iv: row.Iv,
              AuthTag: row.AuthTag,
            }),
        IsSecret: row.IsSecret,
        CreatedAt: row.CreatedAt,
        UpdatedAt: row.UpdatedAt,
      }));
    } catch (error) {
      Logger.Error('EnvVarService.ListByProject failed', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Create a new variable. Throws if (ProjectId, KeyName) already exists
   * (controller maps to HTTP 409).
   */
  public async Create(projectId: number, input: IEnvVarInput): Promise<EnvironmentVariable> {
    try {
      const existing = await EnvironmentVariable.findOne({
        where: { ProjectId: projectId, KeyName: input.KeyName },
      });
      if (existing) {
        throw new Error(`EnvVar ${input.KeyName} already exists for project ${projectId}`);
      }
      const enc = EncryptionHelper.Encrypt(input.Value);
      const row = await EnvironmentVariable.create({
        ProjectId: projectId,
        KeyName: input.KeyName,
        ValueEncrypted: enc.Encrypted,
        Iv: enc.Iv,
        AuthTag: enc.AuthTag,
        IsSecret: input.IsSecret ?? true,
        IsActive: true,
      });
      Logger.Info('EnvVar created', {
        projectId,
        keyName: input.KeyName,
        isSecret: row.IsSecret,
      });
      return row;
    } catch (error) {
      Logger.Error('EnvVarService.Create failed', error as Error, {
        projectId,
        keyName: input.KeyName,
      });
      throw error;
    }
  }

  /**
   * Patch an existing variable. KeyName uniqueness re-checked if renamed.
   * Value re-encrypted with a fresh IV when provided.
   */
  public async Update(
    projectId: number,
    id: number,
    patch: IEnvVarPatch
  ): Promise<EnvironmentVariable | null> {
    try {
      const row = await EnvironmentVariable.findOne({ where: { Id: id, ProjectId: projectId } });
      if (!row) return null;

      if (patch.KeyName && patch.KeyName !== row.KeyName) {
        const clash = await EnvironmentVariable.findOne({
          where: { ProjectId: projectId, KeyName: patch.KeyName },
        });
        if (clash) {
          throw new Error(`EnvVar ${patch.KeyName} already exists for project ${projectId}`);
        }
        row.KeyName = patch.KeyName;
      }
      if (patch.Value !== undefined) {
        const enc = EncryptionHelper.Encrypt(patch.Value);
        row.ValueEncrypted = enc.Encrypted;
        row.Iv = enc.Iv;
        row.AuthTag = enc.AuthTag;
      }
      if (patch.IsSecret !== undefined) {
        row.IsSecret = patch.IsSecret;
      }
      await row.save();
      Logger.Info('EnvVar updated', { projectId, id, keyName: row.KeyName });
      return row;
    } catch (error) {
      Logger.Error('EnvVarService.Update failed', error as Error, { projectId, id });
      throw error;
    }
  }

  /**
   * Hard delete (cascade-safe — values are scoped to project only).
   */
  public async Delete(projectId: number, id: number): Promise<boolean> {
    try {
      const deleted = await EnvironmentVariable.destroy({
        where: { Id: id, ProjectId: projectId },
      });
      if (deleted > 0) {
        Logger.Info('EnvVar deleted', { projectId, id });
      }
      return deleted > 0;
    } catch (error) {
      Logger.Error('EnvVarService.Delete failed', error as Error, { projectId, id });
      throw error;
    }
  }

  /**
   * Inject all of a project's variables into a Record<string,string>
   * for use as child-process env (PipelineService.spawn — T028).
   * Returns plaintext for every active row, including secrets.
   * Caller MUST not log these values directly — pipe through LogFormatter
   * redaction (T027) instead.
   */
  public async InjectIntoEnv(projectId: number): Promise<Record<string, string>> {
    const rows = await EnvironmentVariable.findAll({
      where: { ProjectId: projectId, IsActive: true },
    });
    const merged: Record<string, string> = {};
    for (const row of rows) {
      merged[row.KeyName] = EncryptionHelper.Decrypt({
        Encrypted: row.ValueEncrypted,
        Iv: row.Iv,
        AuthTag: row.AuthTag,
      });
    }
    return merged;
  }

  /**
   * Return the plaintext SECRET values for a project — used by LogFormatter
   * (T027) to redact them from deployment logs. Non-secret variables
   * excluded because they don't need redaction.
   */
  public async GetSecretValues(projectId: number): Promise<string[]> {
    const rows = await EnvironmentVariable.findAll({
      where: { ProjectId: projectId, IsActive: true, IsSecret: true },
    });
    return rows.map((row) =>
      EncryptionHelper.Decrypt({
        Encrypted: row.ValueEncrypted,
        Iv: row.Iv,
        AuthTag: row.AuthTag,
      })
    );
  }
}

export default EnvironmentVariableService;
