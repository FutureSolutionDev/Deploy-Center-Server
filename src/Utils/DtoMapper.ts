/**
 * DtoMapper — explicit allow-list projections for data that leaves the
 * server (Socket.IO events, REST responses). v3.0.1, SEC-C2 / SEC-H3.
 *
 * Never send Sequelize instances or raw rows to clients: a model's toJSON()
 * includes every column, which is how webhook secrets and encrypted SSH keys
 * leaked. Every field that goes out must be named here.
 */

import type { Model } from 'sequelize';

type TRow = Record<string, unknown>;

function ToPlain(value: unknown): TRow | null {
  if (!value || typeof value !== 'object') return null;
  const maybeModel = value as Partial<Model> & { toJSON?: () => unknown };
  if (typeof maybeModel.toJSON === 'function') {
    const json = maybeModel.toJSON();
    return json && typeof json === 'object' ? (json as TRow) : null;
  }
  return value as TRow;
}

function Pick(row: TRow, keys: readonly string[]): TRow {
  const out: TRow = {};
  for (const key of keys) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

/**
 * Strip `user:password@` credentials from a repository URL so tokens embedded
 * in https clone URLs are never echoed back. scp-style `git@host:path` URLs
 * have no secret component and pass through unchanged.
 */
export function SanitizeRepoUrl(repoUrl: unknown): unknown {
  if (typeof repoUrl !== 'string') return repoUrl;
  try {
    const parsed = new URL(repoUrl);
    if (parsed.password || (parsed.username && parsed.protocol.startsWith('http'))) {
      parsed.username = '';
      parsed.password = '';
      return parsed.toString();
    }
    return repoUrl;
  } catch {
    return repoUrl;
  }
}

export const PROJECT_SUMMARY_FIELDS = [
  'Id',
  'Name',
  'Description',
  'RepoUrl',
  'Branch',
  'ProjectType',
  'IsActive',
  'WorkspaceId',
] as const;

/** Minimal project shape embedded in deployment events and lists. */
export function ToProjectSummaryDto(project: unknown): TRow | null {
  const row = ToPlain(project);
  if (!row) return null;
  const dto = Pick(row, PROJECT_SUMMARY_FIELDS);
  if ('RepoUrl' in dto) dto.RepoUrl = SanitizeRepoUrl(dto.RepoUrl);
  return dto;
}

export const DEPLOYMENT_FIELDS = [
  'Id',
  'ProjectId',
  'CommitHash',
  'Branch',
  'Status',
  'TriggerType',
  'TriggeredBy',
  'StartedAt',
  'CompletedAt',
  'Duration',
  'ErrorMessage',
  'CommitMessage',
  'CommitAuthor',
  'Author',
  'QueueJobId',
  'CreatedAt',
  'UpdatedAt',
] as const;

/** Deployment as sent over Socket.IO: no log paths, no full project row. */
export function ToDeploymentDto(deployment: unknown): TRow | null {
  const row = ToPlain(deployment);
  if (!row) return null;
  const dto = Pick(row, DEPLOYMENT_FIELDS);
  if (row.Project) {
    dto.Project = ToProjectSummaryDto(row.Project);
  }
  return dto;
}

export default { ToDeploymentDto, ToProjectSummaryDto, SanitizeRepoUrl };
