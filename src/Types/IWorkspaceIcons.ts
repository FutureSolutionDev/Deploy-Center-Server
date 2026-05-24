/**
 * Workspace icon allow-list — Deploy Center v3.0 / F-009 (T085, FR-033b).
 * Single source of truth: server validates against this tuple, the client
 * picker reads the mirrored copy at `client/src/types/workspaceIcons.ts`,
 * and `WorkspaceIconsParity.test.ts` enforces the two stay byte-identical.
 *
 * Adding an icon: edit BOTH files in the same PR, then re-run the parity test.
 */

export const WORKSPACE_ICON_KEYS = [
  'folder',
  'rocket',
  'cloud',
  'web',
  'mobile',
  'database',
  'terminal',
  'api',
  'staticSite',
  'cms',
  'commerce',
  'auth',
  'analytics',
  'payments',
  'messaging',
  'monitoring',
  'storage',
  'cdn',
  'search',
  'default',
] as const;

export type TWorkspaceIcon = (typeof WORKSPACE_ICON_KEYS)[number];

/** Default icon for a workspace whose Icon column is omitted on create. */
export const DEFAULT_WORKSPACE_ICON: TWorkspaceIcon = 'folder';

/** Type-safe check used by Joi validator + service guard. */
export function isWorkspaceIcon(value: unknown): value is TWorkspaceIcon {
  return typeof value === 'string' && (WORKSPACE_ICON_KEYS as readonly string[]).includes(value);
}
