# 📋 Changelog

> كل التغييرات الملحوظة في **Deploy Center** تُوثّق هنا.
> الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
> المشروع يتبع [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] — 2026-05-24

**Status:** 🟢 Released
**Theme:** Foundation — wipe out the five critical v2.1 debts + add five high-value UX wins.

### Added

- **F-001 — Persistent deployment queue.** Replaced the in-memory
  `Map<projectId, Item[]>` with a BullMQ/Redis-backed queue. Deployments
  now survive server restart. Retry policy: 3 attempts, exponential
  backoff (1s → 5s → 25s). New `Deployment.QueueJobId` column for
  job↔row correlation. Bull Board admin UI mounted at
  `/admin/queues` (Admin only). 503 short-circuit via
  `QueueReadyMiddleware` when Redis is unreachable.
- **F-002 — Testing foundation.** Jest + ts-jest scaffold under
  `server/__tests__/` mirroring `src/`. Coverage gate ratcheted from
  0 % → 40 % across 4 weeks (GA gate). Vitest gate for client at 30 %.
  Unit + integration tests for Encryption, Password, SSH key gen, log
  formatter, AutoRecovery, QueueService, NotificationService dispatchers,
  AuditLogService, plus integration tests for Auth, Projects, Users,
  Deployments, EnvVars, Notifications, Rollback.
- **F-003 — Encrypted environment variables.** New
  `EnvironmentVariables` table with AES-256-GCM at rest, unique IV per
  row. API: `GET/POST/PUT/DELETE /api/projects/:id/env-vars`
  (Admin/Manager). Injected into `process.env` during pipeline
  `spawn()`; secret values redacted from logs (FR-013).
- **F-004 — Log download.** `GET /api/deployments/:id/log/download`
  returns the deployment log as a `text/plain` attachment. Frontend
  "Download Log" + "Copy to Clipboard" buttons; auto-scroll toggle for
  live logs.
- **F-005 — Local Git bare cache.** First deploy creates
  `server/deployments/cache/project-{id}.git/`; subsequent deploys
  `--reference` it for ~85 % deploy-time / ~70 % disk savings.
- **F-006 — Multi-channel notifications.** Strategy-pattern refactor
  with three new dispatchers (Discord, Slack, Email). Three new tables:
  `NotificationProviders` (credentials, encrypted), `NotificationChannels`
  (delivery targets, encrypted), `ProjectNotificationSubscriptions`
  (M:N + event filter). Fan-out via `Promise.allSettled` — one channel
  failing does not block the others (FR-025b). Test endpoint per channel
  + per provider. Settings UI tab + per-project subscription card.
- **F-007 — Rollback UI.** New `EAuditAction.DeploymentRolledBack` and
  `ETriggerType.Rollback`. `POST /api/deployments/:id/rollback` creates a
  new deployment with the project's last successful commit, queued via
  BullMQ. New `deployment:rollback-queued` socket event. UI button auto-
  hides on non-failed deployments and disables with tooltip when there's
  no prior success or commits already match.
- **F-008 — Project templates.** Migration 017 seeds 5 built-ins
  (Node.js Backend, React SPA (Vite), Next.js, Static HTML, Astro). New
  `ProjectTemplateWizard` runs as Step 0 of Create-Project. Built-ins
  are immutable (422 on Update/Delete). Custom templates editable by
  Admin/Manager.
- **F-009 — Workspaces.** Migration 016 adds `Workspaces` table +
  nullable `Project.WorkspaceId`. ProjectsPage rewritten as a
  workspace-first grid with drag-and-drop project reassignment
  (`@dnd-kit`). "Unassigned" group always present. Owner-or-admin
  RBAC for workspace mutation; open to all for viewing.
- **F-010 — GitHub Actions CI.** `.github/workflows/ci.yml` runs server
  typecheck + lint + jest --coverage AND client typecheck + lint +
  vitest + build. Coverage gates wired to the jest/vitest configs.

### Changed

- `EAuditAction` extended with `DeploymentRolledBack`.
- `ETriggerType` extended with `Rollback`.
- `ResponseHelper` gains `Conflict` (409) and `UnprocessableEntity` (422)
  helpers used by F-007 + F-008.
- `NotificationService` refactored to fan out via the new
  Provider/Channel/Subscription model while preserving the legacy
  Project.Config.Notifications path for v2.1 backward compat.

### Database

- Migrations applied (in order): 009, 012, 013, 016, 017, 018, 019, 999.
- Migration 999 is one-shot data: re-enqueues v2.1 pending/queued
  deployments into BullMQ with an audit row. Idempotent via
  `QueueJobId IS NULL` guard.
- Migration numbers 010, 011, 014, 015 are reserved for v3.1.

### Compatibility

- **No breaking changes for v2.1 API clients.** All new columns are
  nullable; all new endpoints are additive (NFR-001).
- **`DISCORD_WEBHOOK_URL` env var still honored** as the legacy
  notification path — deprecated in v3.0, will be removed in v3.1.
- **`Project.Config.envVars` JSON still honored** alongside the new
  encrypted `EnvironmentVariables` table — deprecated in v3.0, will be
  removed in v3.1.

### Operator notes

- **Redis 7+ required.** See [migration-v2-to-v3.md](./migration-v2-to-v3.md)
  §1 for the docker-compose recipe.
- Bull Board lives at `/admin/queues` and is admin-only.
- See `server/docs/migration-v2-to-v3.md` for full upgrade steps,
  including the F-003 envVars migration helper SQL.

📄 **Full feature spec:** [versions/v3.0-foundation.md](./versions/v3.0-foundation.md)
📄 **Migration guide:** [migration-v2-to-v3.md](./migration-v2-to-v3.md)

---

## [2.1.0] — 2024-12-28

### Added

- ✅ **RBAC Enhancement** — Complete project-level access control
- ✅ **Project Members System** — Add/remove team members per project
- ✅ Frontend RBAC for Projects, Deployments, Queue, Settings pages
- ✅ `ProjectMembersCard` component for member management
- ✅ Deployment filtering by project membership
- ✅ Queue filtering by project membership

### Changed

- `ProjectService.GetAllProjects()` — Added user filtering
- `DeploymentService.GetAllDeployments()` — Added user filtering
- `DeploymentController.GetQueueStatus()` — Added user filtering

### Files Changed

- `server/src/Services/ProjectService.ts`
- `server/src/Services/DeploymentService.ts`
- `server/src/Controllers/ProjectController.ts`
- `server/src/Controllers/DeploymentController.ts`
- `client/src/pages/Projects/ProjectDetailsPage.tsx`
- `client/src/pages/Projects/components/ProjectMembersCard.tsx`
- `client/src/pages/Deployments/DeploymentsPage.tsx`
- `client/src/pages/Queue/QueuePage.tsx`
- `client/src/pages/Settings/SettingsPage.tsx`

---

## [2.0.x] — 2024-12-20

### Added

- ✅ **Pipeline Enhancements** — Improved error handling
- ✅ Better log formatting via `LogFormatter` utility
- ✅ Deployment duration tracking
- ✅ Conditional step execution
- ✅ Variable substitution system

---

## [1.x] — 2024-12-15

### Added

- ✅ **Real-Time Updates** — Socket.IO integration
- ✅ Live deployment status updates
- ✅ Queue status WebSocket events

---

## [1.0.0] — 2024-11-26

### Added

- ✅ **Project Management** — CRUD + archive
- ✅ **JWT Authentication** — access + refresh tokens
- ✅ **SSH Key Management** — ED25519/RSA + AES-256-GCM
- ✅ **GitHub Webhook Integration** — signature verification
- ✅ **Discord Notifications** — webhook embeds
- ✅ **Audit Logging** — complete activity tracking
- ✅ Database migrations system

---

## Future Versions (Planned)

### [v3.1] — 2026-07-25 (Remote Targets)
**Status:** 🔵 Planned

Features: F-011 → F-021 (11 features)
📄 **تفاصيل:** [versions/v3.1-remote-targets.md](./versions/v3.1-remote-targets.md)

### [v3.2] — 2026-08-25 (Governance)
**Status:** 🔵 Planned

Features: F-022 → F-033 (12 features)
📄 **تفاصيل:** [versions/v3.2-governance.md](./versions/v3.2-governance.md)

### [v3.3] — 2026-09-30 (Smart Strategies)
**Status:** 🔵 Planned

Features: F-034 → F-047 (14 features)
📄 **تفاصيل:** [versions/v3.3-strategies.md](./versions/v3.3-strategies.md)

### [v4.0] — 2026-12-15 (Enterprise Suite)
**Status:** ⚪ Backlog

Features: F-048 → F-071 (24 features)
📄 **تفاصيل:** [versions/v4.0-enterprise.md](./versions/v4.0-enterprise.md)

### [v4.1] — 2027-03-15 (Container Era)
**Status:** ⚪ Backlog

Features: F-072 → F-085 (14 features)
📄 **تفاصيل:** [versions/v4.1-containers.md](./versions/v4.1-containers.md)

### [v4.2] — 2027-06-15 (AI Operations)
**Status:** ⚪ Backlog

Features: F-086 → F-097 (12 features)
📄 **تفاصيل:** [versions/v4.2-ai-ops.md](./versions/v4.2-ai-ops.md)

### [v5.0] — 2027-Q3+ (Cloud Native)
**Status:** ⚪ Vision

Features: F-098 → F-119 (22 features)
📄 **تفاصيل:** [versions/v5.0-cloud-native.md](./versions/v5.0-cloud-native.md)

---

## Backlog (Idea Pool)

Features F-120 → F-137 — أفكار لم تُجدول بعد.
📄 **تفاصيل:** [ROADMAP.md#-backlog--idea-pool](./ROADMAP.md#-backlog--idea-pool-18-ميزة-لم-تُجدول-بعد)

---

> **كيفية تحديث هذا الملف:**
> 1. عند بدء العمل على نسخة → ينقل من "Future" إلى "Unreleased"
> 2. عند إطلاق RC → حدّث الـ status
> 3. عند GA → ينقل من "Unreleased" إلى نسخة محددة بتاريخ ثابت
