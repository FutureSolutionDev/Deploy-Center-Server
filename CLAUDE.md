# CLAUDE.md — Deploy Center (Server)

Guidance for Claude Code (claude.ai/code) when working in this repository.
**Audience:** AI agent only. Project users should read [`docs/README.md`](./docs/README.md).

**Last Updated:** 2026-05-24 (v3.0.0 GA)

---

## 📋 Project Identity

**Deploy Center** — enterprise-grade self-hosted CI/CD deployment platform.
Monorepo with `server/` (Node.js + Express + TypeScript + Sequelize) and
`client/` (React 19 + TypeScript + Material-UI + Vite).

- **Current version:** v3.0.0 (server) / v3.0.0 (client) — released 2026-05-24.
- **Release history:** [`docs/CHANGELOG.md`](./docs/CHANGELOG.md).
- **Roadmap:** [`docs/ROADMAP.md`](./docs/ROADMAP.md) — every feature has a
  stable `F-NNN` ID mapped to a target version. **Do not guess release dates;
  trust this file.**
- **Per-version specs:** [`docs/versions/`](./docs/versions/) (v3.0 → v5.0).
- **Tech stack & exact versions:** authoritative source is
  [`package.json`](./package.json) + [`client/package.json`](../client/package.json).
  Read those, don't trust restated values in any doc.

---

## 📁 Documentation Location Convention (MANDATORY)

> **⚠️ Strict rule:** every documentation file in this project lives under
> `server/docs/`. Do **not** create `.md` files in the root, in `client/`, or
> anywhere else.

### Allowed paths

| File type                              | Required location                |
|----------------------------------------|----------------------------------|
| Master Roadmap                         | `server/docs/ROADMAP.md`         |
| Changelog (release history)            | `server/docs/CHANGELOG.md`       |
| Per-version specs                      | `server/docs/versions/vX.Y-*.md` |
| User guides                            | `server/docs/guides/*.md`        |
| Architecture / API / Design docs       | `server/docs/*.md`               |
| Screenshots & assets                   | `server/docs/screenshots/`       |

### Allowed exceptions

- `CLAUDE.md` — stays in `server/CLAUDE.md` (AI-agent instructions).
- `README.md` — root entry point for GitHub.
- `LICENSE.md` — root (npm + GitHub auto-detect).
- **GitHub community files** (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `SUPPORT.md`, `AUTHORS.md`) live in `server/.github/` — the
  GitHub UI reads them from there with higher priority than the root and
  surfaces them in Insights / Security / Community tabs.

### When you create new documentation

1. **Check first:** is there an existing file to update instead of creating new?
2. **If new:** put it under `server/docs/` (or an appropriate subfolder).
3. **If you find docs in the wrong place:** move them to `server/docs/` and
   tell Sabry.

---

## 🛠️ Path Aliases (server `tsconfig.json`)

Use these in imports — never use deep relative paths like `../../../Models/`:

- `@Controllers/` → `server/src/Controllers/`
- `@Services/` → `server/src/Services/`
- `@Models/` → `server/src/Models/`
- `@Middleware/` → `server/src/Middleware/`
- `@Routes/` → `server/src/Routes/`
- `@Utils/` → `server/src/Utils/`
- `@Types/` → `server/src/Types/`
- `@Database/` → `server/src/Database/`
- `@Config/` → `server/src/Config/`
- `@Migrations/` → `server/src/Migrations/`

---

## 🎯 Coding Conventions (summary)

Full rules in [`docs/CODING_STANDARDS.md`](./docs/CODING_STANDARDS.md).

### Naming

| Construct                  | Convention                        | Example                  |
|----------------------------|-----------------------------------|--------------------------|
| Classes / Types            | PascalCase                        | `DeploymentService`      |
| Interfaces                 | `I` + PascalCase                  | `IUserAttributes`        |
| Enums                      | `E` + PascalCase                  | `EDeploymentStatus`      |
| Functions / methods / vars | camelCase                         | `getUserById`            |
| Constants                  | UPPER_SNAKE_CASE                  | `MAX_RETRIES`            |
| DB columns                 | PascalCase                        | `CreatedAt`, `ProjectId` |
| Class-method handlers      | PascalCase (`public Handle =`)    | `Authenticate`           |
| Service-class files        | PascalCase.ts                     | `QueueService.ts`        |
| Utility files              | camelCase.ts                      | `logger.ts`              |

### Hard rules

- **No `any`** — use explicit types or proper generics.
- **No `console.log`** in production code — always Winston `Logger`.
- **No raw SQL** except for complex aggregations; everything else through Sequelize.
- **All passwords:** bcrypt (10 rounds minimum).
- **All secrets at rest:** AES-256-GCM with a unique IV per record
  (reuse [`Utils/EncryptionHelper.ts`](./src/Utils/EncryptionHelper.ts)).
- **All API endpoints:** protected by `AuthMiddleware` unless explicitly public.
- **Sensitive endpoints:** also gated by `RoleMiddleware` with explicit roles.
- **All rate-limited routes:** wrap with `RateLimiterMiddleware.ApiLimiter`
  (or `AuthLimiter` / `DeploymentLimiter` as appropriate). CodeQL flags
  unrate-limited routes.
- **TypeScript:** `tsc --noEmit` must pass with zero errors before commit.
- **ESLint:** zero errors before commit.

---

## 🚫 Never Do

- **Never commit `.env`** or any file containing secrets. `.env.test` is the
  only env file that's checked in — it contains test-only fixtures.
- **Never modify a migration file after it's been deployed** — add a new one.
- **Never use `git push --force` on `master`** — use a feature branch + PR.
- **Never skip pre-commit hooks** (`--no-verify`) without explicit user instruction.
- **Never log secrets** (env vars, passwords, tokens, API keys, encrypted blobs).
  Use [`Utils/LogFormatter.ts`](./src/Utils/LogFormatter.ts)'s sanitization
  helpers when dealing with user-supplied strings.
- **Never break v2.1 API backward compatibility** — v3.0 added columns are all
  nullable; legacy `DISCORD_WEBHOOK_URL` and `Project.Config.envVars` still
  work (deprecated, removed in v3.1).

---

## 📐 Code Patterns

### Service pattern

```typescript
import Logger from '@Utils/Logger';

export class ExampleService {
  public async GetData(id: number): Promise<Data[]> {
    try {
      // Implementation — go through Sequelize models, never raw SQL.
      return await SomeModel.findAll({ where: { Id: id } });
    } catch (error) {
      Logger.Error('Failed to get data', error as Error);
      throw error;
    }
  }
}

export default ExampleService;
```

### Controller pattern

```typescript
import { Request, Response } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';

public GetData = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await this.ExampleService.GetData(Number(req.params.id));
    ResponseHelper.Success(res, 'Data retrieved', { Data: data });
  } catch (error) {
    ResponseHelper.Error(res, 'Failed to retrieve data');
  }
};
```

Use the helpers — they keep response shape consistent:

- `ResponseHelper.Success(res, msg, payload)` → 200
- `ResponseHelper.Created(res, msg, payload)` → 201
- `ResponseHelper.Accepted(res, msg, payload)` → 202
- `ResponseHelper.ValidationError(res, msg)` → 400
- `ResponseHelper.NotFound(res, msg)` → 404
- `ResponseHelper.Conflict(res, msg)` → 409 (added in v3.0)
- `ResponseHelper.UnprocessableEntity(res, msg)` → 422 (added in v3.0)
- `ResponseHelper.Error(res, msg)` → 500

### React component pattern (TanStack Query v5)

```typescript
import { useQuery } from '@tanstack/react-query';
import { CircularProgress } from '@mui/material';

export const ExampleComponent: React.FC<{ id: number }> = ({ id }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['example', id],
    queryFn: () => fetchExample(id),
  });

  if (isLoading) return <CircularProgress />;
  return <div>{data?.name}</div>;
};
```

> **Note:** the project uses `@tanstack/react-query@^5` — the object-form API.
> Do not use the v3/v4 positional form `useQuery('key', fn)` — it's removed.

---

## 🔧 v3.0 Stack-Specific Gotchas

These are non-obvious things that have bitten us. Reference them before
working in the related area.

### Queue (BullMQ)

- **Priority semantics**: BullMQ uses **lower number = higher priority**. The
  project standardizes on `QUEUE_PRIORITY` constants in
  [`Services/QueueService.ts`](./src/Services/QueueService.ts):
  `Rollback=1`, `Webhook=0`, `Manual=10`. Never hardcode literal numbers.
- **Redis unreachable**: `QueueReadyMiddleware` short-circuits new deployment
  triggers with **503** when Redis is down — server does NOT crash; it retries
  with exponential backoff and auto-recovers.
- **Bull Board** mounts at `/admin/queues` behind `AuthMiddleware` +
  `RoleMiddleware([Admin])`. Mount order in [`App.ts`](./src/App.ts) matters:
  it must be registered BEFORE the SPA catch-all.

### Database (Sequelize + MariaDB/MySQL)

- **mysql2 returns JSON columns as raw strings**, not parsed objects.
  Defensive pattern:

  ```typescript
  const events = Array.isArray(row.Events)
    ? row.Events
    : (typeof row.Events === 'string' ? JSON.parse(row.Events) : []);
  ```

- **Sequelize 6.37 + mariadb driver** has a `formatResults` bug on
  `removeColumn` / certain `INSERT` paths. The project switched the test
  dialect to `mysql` (mysql2 npm driver, wire-compatible with MariaDB) via
  `.env.test` to dodge it. In production migrations that need `removeColumn`,
  use raw `ALTER TABLE` via `sequelize.query(..., { type: QueryTypes.RAW })`
  (see [`Migrations/005_*.ts`](./src/Migrations/005_fix_deployment_paths_constraint.ts)
  for the pattern).
- **All new migrations need working `up()` AND `down()`** — the
  `MigrationRunner` won't auto-rollback otherwise.
- **Migration numbering:** v3.0 uses 009, 012, 013, 016, 017, 018, 019, 020,
  021, 999. **Numbers 010, 011, 014, 015 are RESERVED for v3.1** — do not use.

### Tests

- **`.env.test` is the source of truth** for test env. It's loaded via
  `__tests__/jest.env.setup.ts` (Jest `setupFiles`) — this runs **before any
  test module import**, which matters because TypeScript hoists `require()`
  calls and `AppConfig` reads `process.env` at import-time.
- `jest.config.js` has `restoreMocks: true` — that means `jest.spyOn` setups
  in `beforeAll` are erased after test 1. Always put spy setups in
  `beforeEach` (the Rollback / Deployments suites learned this the hard way).
- `jest.config.js` has `forceExit: true` — required because ioredis/BullMQ
  keep handles open. Do not remove without a replacement teardown.

### Frontend

- **Material-UI v7**: not v5. Some imports and prop names differ.
- **React 19**: Rules of Hooks are enforced — never put a hook after an
  early return. The Rollback button bug was a violation of this rule.
- **`@dnd-kit`** powers the workspace drag-and-drop. Don't introduce a second
  DnD library.

---

## 🔐 RBAC (4 roles)

Detailed permission matrix lives in [`docs/ROADMAP.md`](./docs/ROADMAP.md) and
the per-role middleware tests. Quick reference for what each role can do:

| Role      | Sees                 | Mutates                                 | Admin areas  |
|-----------|----------------------|-----------------------------------------|--------------|
| Admin     | Everything           | Everything                              | Everything   |
| Manager   | Everything           | Everything except System Settings       | Most         |
| Developer | Assigned projects    | Assigned-project resources only         | None         |
| Viewer    | Assigned projects    | Nothing                                 | None         |

Implementation:

- Backend: [`Middleware/RoleMiddleware.ts`](./src/Middleware/RoleMiddleware.ts),
  [`Middleware/ProjectAccessMiddleware.ts`](./src/Middleware/ProjectAccessMiddleware.ts),
  [`Middleware/DeploymentAccessMiddleware.ts`](./src/Middleware/DeploymentAccessMiddleware.ts)
- Frontend: `RoleContext` + `useRole()` hook in `client/src/contexts/`.
- DB: `Users.Role` enum + `ProjectMembers` table for project-level membership.

---

## 🧭 Where to look for…

| Question | Source of truth |
| --- | --- |
| Exact dependency versions | [`package.json`](./package.json) (server/client) |
| What ships in which release | [`docs/ROADMAP.md`](./docs/ROADMAP.md) + [`docs/versions/`](./docs/versions/) |
| Release history / what changed | [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) |
| API endpoints | [`docs/API_DOCUMENTATION.md`](./docs/API_DOCUMENTATION.md) (v2.1 surface) + [`docs/versions/v3.0-foundation.md`](./docs/versions/v3.0-foundation.md) §API (v3.0 additions) |
| Database schema | [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) + `src/Models/*.ts` |
| Migrations list | [`src/Database/MigrationRunner.ts`](./src/Database/MigrationRunner.ts) |
| How to upgrade v2.1 → v3.0 | [`docs/migration-v2-to-v3.md`](./docs/migration-v2-to-v3.md) |
| Release process / branch protection / CI ops | [`docs/RELEASE_GUIDE.md`](./docs/RELEASE_GUIDE.md) |
| Coding standards (full detail) | [`docs/CODING_STANDARDS.md`](./docs/CODING_STANDARDS.md) |
| Test coverage gates | [`docs/test-coverage-status.md`](./docs/test-coverage-status.md) + `jest.config.js` |
| How users do X (env vars, SSH, notifications…) | [`docs/guides/`](./docs/guides/) |
| Troubleshooting | [`docs/FAQ.md`](./docs/FAQ.md) |
| Contributor workflow | [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md) |

---

## 🤝 Working with Sabry

- He's the sole maintainer + reviewer; treat his time as the scarcest resource.
- Default mode: discuss / plan / propose before writing code (see global
  `CLAUDE.md` CTO+PM rule).
- When implementing: verify locally before pushing — Sabry pushed back hard on
  the "push and hope CI catches it" pattern. Run `tsc --noEmit` + `npm test`
  on the relevant suite, then push.
- Communication in Arabic; code/comments/commit messages in English.

---

**End of CLAUDE.md** — total ~260 lines; if it grows beyond ~400, move details
out to `docs/` and link.
