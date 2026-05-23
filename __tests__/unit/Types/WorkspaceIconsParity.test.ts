/**
 * Parity test — F-009 (T085).
 * Asserts the server tuple and the client tuple at
 * `client/src/types/workspaceIcons.ts` are byte-identical.
 * Drift here breaks the picker's server-side validation: a key visible
 * in the UI but unknown to the server would 422 on save.
 *
 * Implemented as a text-level extraction (regex over the client file)
 * because importing MUI from a node-only suite would explode the test runtime.
 */

import path from 'path';
import fs from 'fs';
import { WORKSPACE_ICON_KEYS } from '@Types/IWorkspaceIcons';

function readClientKeys(): string[] {
  const filePath = path.resolve(
    __dirname,
    '../../../../client/src/types/workspaceIcons.ts'
  );
  const src = fs.readFileSync(filePath, 'utf8');
  // Find `export const WORKSPACE_ICON_KEYS = [ … ] as const;`
  const m = src.match(/export const WORKSPACE_ICON_KEYS = \[([^\]]*)\] as const;/);
  if (!m) {
    throw new Error('Could not locate WORKSPACE_ICON_KEYS literal in client mirror');
  }
  const body = m[1] as string;
  const keys = Array.from(body.matchAll(/'([^']+)'/g)).map((mm) => mm[1] as string);
  return keys;
}

describe('Workspace icon catalog parity — F-009 FR-033b', () => {
  it('client tuple equals server tuple byte-for-byte', () => {
    const serverKeys = [...WORKSPACE_ICON_KEYS];
    const clientKeys = readClientKeys();
    expect(clientKeys).toEqual(serverKeys);
  });

  it('catalog has at least 20 entries (per data-model)', () => {
    expect(WORKSPACE_ICON_KEYS.length).toBeGreaterThanOrEqual(20);
  });

  it('all entries are unique', () => {
    expect(new Set(WORKSPACE_ICON_KEYS).size).toBe(WORKSPACE_ICON_KEYS.length);
  });

  it('all entries are POSIX-snake_case strings', () => {
    for (const k of WORKSPACE_ICON_KEYS) {
      expect(k).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
