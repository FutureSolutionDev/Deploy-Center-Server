/**
 * Parity test — F-009 (T085).
 * Asserts the server tuple and the client tuple at
 * `client/src/types/workspaceIcons.ts` are byte-identical.
 * Drift here breaks the picker's server-side validation: a key visible
 * in the UI but unknown to the server would 422 on save.
 *
 * Implemented as a text-level extraction (regex over the client file)
 * because importing MUI from a node-only suite would explode the test runtime.
 *
 * Cross-repo behavior: in this monorepo we expect the client checkout to
 * live as a sibling of the server checkout (`../client/`). CI for the
 * server-only repo does NOT have the client/ dir, so the byte-parity check
 * is downgraded to `describe.skip` in that environment. The
 * snake_case/camelCase + uniqueness invariants on the server tuple still
 * run unconditionally — those don't depend on the client copy.
 */

import path from 'path';
import fs from 'fs';
import { WORKSPACE_ICON_KEYS } from '@Types/IWorkspaceIcons';

const CLIENT_PATH = path.resolve(
  __dirname,
  '../../../../client/src/types/workspaceIcons.ts'
);
const clientFilePresent = fs.existsSync(CLIENT_PATH);

function readClientKeys(): string[] {
  const src = fs.readFileSync(CLIENT_PATH, 'utf8');
  // Find `export const WORKSPACE_ICON_KEYS = [ … ] as const;`
  const m = src.match(/export const WORKSPACE_ICON_KEYS = \[([^\]]*)\] as const;/);
  if (!m) {
    throw new Error('Could not locate WORKSPACE_ICON_KEYS literal in client mirror');
  }
  const body = m[1] as string;
  const keys = Array.from(body.matchAll(/'([^']+)'/g)).map((mm) => mm[1] as string);
  return keys;
}

describe('Workspace icon catalog — server invariants', () => {
  it('catalog has at least 20 entries (per data-model)', () => {
    expect(WORKSPACE_ICON_KEYS.length).toBeGreaterThanOrEqual(20);
  });

  it('all entries are unique', () => {
    expect(new Set(WORKSPACE_ICON_KEYS).size).toBe(WORKSPACE_ICON_KEYS.length);
  });

  it('all entries are camelCase identifiers (start lowercase, only [a-zA-Z0-9_])', () => {
    // Catalog uses camelCase (e.g. `staticSite`), NOT POSIX snake_case.
    // The regex enforces "starts with a lowercase letter, then only word
    // characters" so a typo like `Static-Site` or `static site` is caught.
    for (const k of WORKSPACE_ICON_KEYS) {
      expect(k).toMatch(/^[a-z][a-zA-Z0-9_]*$/);
    }
  });
});

const parityDescribe = clientFilePresent ? describe : describe.skip;
parityDescribe('Workspace icon catalog parity (client mirror) — F-009 FR-033b', () => {
  it('client tuple equals server tuple byte-for-byte', () => {
    const serverKeys = [...WORKSPACE_ICON_KEYS];
    const clientKeys = readClientKeys();
    expect(clientKeys).toEqual(serverKeys);
  });
});

if (!clientFilePresent) {
  // eslint-disable-next-line no-console
  console.warn(
    `[WorkspaceIconsParity] Sibling client/ checkout not found at ${CLIENT_PATH} — parity check skipped. ` +
      'This is expected in server-only CI; the parity invariant is enforced locally by the monorepo dev checkout.'
  );
}
