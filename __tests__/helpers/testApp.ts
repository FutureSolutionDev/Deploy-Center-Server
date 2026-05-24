/**
 * Minimal Express app for integration tests — F-002.
 * Mounts the user-supplied router under /api WITHOUT CSRF / rate-limiter /
 * security middleware that's irrelevant to RBAC + payload validation tests.
 *
 * Auth + Role middleware are still applied (they're attached inside the
 * route files themselves) so RBAC checks remain authentic.
 */

import express, { Application, Router } from 'express';
import cookieParser from 'cookie-parser';

export function buildTestApp(mounts: Array<{ path: string; router: Router }>): Application {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  for (const { path, router } of mounts) {
    app.use(path, router);
  }
  return app;
}
