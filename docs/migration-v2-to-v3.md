# Migration Guide: Deploy Center v2.1 → v3.0

**Status**: 🟡 Draft (started during F-003 implementation; sections completed as
each feature lands. Full sign-off at T095 / GA.)

This document is the operator-facing upgrade procedure for the v3.0 release.
It supersedes any ad-hoc upgrade notes from v2.1.

---

## 0. Before you start

```bash
# Snapshot everything (5 min, run as the deploy user)
mysqldump deploy_center > backup-pre-v3.sql
tar czf backup-pre-v3-deployments.tgz server/deployments/ server/logs/
```

Verify both backups exist and are non-zero before proceeding. **No rollback
path exists without these.**

System prerequisites (NEW in v3.0):

- **Redis 7+** reachable from the Deploy Center host. Docker Compose recipe
  bundled — see [docker-compose.yml](../../docker-compose.yml).
- **Node.js ≥ 18** (unchanged from v2.1; just confirm).

---

## 1. Bring up Redis (F-001)

v3.0 hard-requires Redis for the BullMQ-backed persistent queue. The
in-memory queue from v2.1 is **gone** — there is no fallback.

```bash
cd /opt/deploy-center
docker compose up -d redis      # default profile starts mariadb + redis only
docker compose ps redis         # expect "healthy"
redis-cli -h localhost ping     # expect PONG
```

Connection settings go in `.env` (see `server/.env.example`):

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # leave empty if docker-compose has no auth
REDIS_DB=0
```

**Failure mode (FR-005b):** if Redis is unreachable at any point after
upgrade, the server logs the error, retries with exponential backoff, and
returns **HTTP 503** with the body `Queue service unavailable, deployments
paused` on every deployment-trigger / webhook endpoint. Reads keep working.
No crash, no operator intervention required — when Redis comes back,
queueing auto-resumes.

---

## 2. Upgrade the binaries

```bash
git fetch --tags
git checkout v3.0.0           # the GA tag (or v3.0.0-rc.1 for staging)
cd server && npm install
cd ../client && npm install && npm run build
```

---

## 3. Run migrations (F-001 + F-003 + …)

```bash
cd server && npm run migrate    # or pm2 restart deploy-center if AUTO_MIGRATE=true
```

This runs the v3.0 migration set in order:

| # | Migration | What it does | Feature |
| --- | --------- | ------------ | ------- |
| 009 | `009_create_environment_variables` | Creates `EnvironmentVariables` table (encrypted per-project K/V) | F-003 |
| 012 | `012_add_queue_job_id_to_deployments` | Adds nullable `Deployment.QueueJobId VARCHAR(100)` + reverse-lookup index | F-001 |
| 013 | `013_create_notification_providers` | Creates `NotificationProviders` table | F-006 (Week 3) |
| 016 | `016_create_workspaces` | Creates `Workspaces` table + adds nullable `Project.WorkspaceId` | F-009 (Week 4) |
| 017 | `017_create_project_templates` | Creates `ProjectTemplates` table + seeds 5 built-ins | F-008 (Week 4) |
| 018 | `018_create_notification_channels` | Creates `NotificationChannels` (FK Provider, CASCADE) | F-006 (Week 3) |
| 019 | `019_create_project_notification_subscriptions` | Project↔Channel M:N + Events JSON | F-006 (Week 3) |
| 999 | `999_migrate_pending_deployments` | **One-shot** data migration — re-enqueues v2.1 `Pending`/`Queued` deployments into BullMQ; audit row written | F-001 |

All migrations are idempotent — re-running is safe. Migration 999's
`WHERE QueueJobId IS NULL` guard ensures no row is ever enqueued twice.

**Numbers 010, 011, 014, 015 are reserved for v3.1** and intentionally
skipped in v3.0.

**`down()` paths**: every migration ships a working `down()` for emergency
rollback EXCEPT migration 999 (its down() is a no-op — once jobs are in
Redis, removing them via the migration would lose work; instead, pause the
worker and drain naturally).

---

## 4. Restart and verify

```bash
pm2 restart deploy-center
pm2 logs deploy-center --lines 50
```

Look for these lines in the startup log (in this order):

```text
✅ Migration 009 / 012 / 013 / 016 / 017 / 018 / 019 / 999  completed
Redis: TCP connection established
Redis: ready to accept commands
QueueService: deployment runner registered
QueueService: worker started, queue=deployments
Deployment queue (BullMQ) initialized and worker started
Server listening on port 9090
```

Smoke check — as Admin: open `https://your-host/admin/queues` → you should
see the Bull Board UI for the `deployments` queue. As any other role: 403.

---

## 5. F-003 — Environment variables migration

v3.0 adds a dedicated `EnvironmentVariables` table that supersedes the
legacy `Project.Config.envVars` JSON blob. **Both work in v3.0** — see
research D-07 for the precedence rules:

```text
process.env (whitelist)
  → Project.Config.envVars (legacy, lower precedence)
    → EnvironmentVariables table (new, highest precedence, encrypted at rest)
```

**Legacy `Project.Config.envVars` is DEPRECATED in v3.0 and will be
REMOVED in v3.1.** Migrate at your own pace — the system warns nowhere
silently; the v3.1 release notes will list this as a hard breaking change.

**Bulk one-time migration helper SQL** (run once, then verify in UI):

```sql
-- For each project with legacy envVars, copy them into the new table as
-- IsSecret=true. Encryption is handled by the application — this script
-- only moves the row references; the application UI/API must be used to
-- re-enter values (encryption requires the live ENCRYPTION_KEY).
SELECT Id, Name, JSON_KEYS(JSON_EXTRACT(Config, '$.envVars')) AS legacy_keys
FROM Projects
WHERE JSON_LENGTH(JSON_EXTRACT(Config, '$.envVars')) > 0;
```

For each project listed, open Project → Environment Variables tab and
re-add each variable manually. **Do not script the move with raw SQL —
the new column needs AES-256-GCM ciphertext + IV + AuthTag that only the
application can produce correctly.**

After verifying all variables migrated, remove the legacy keys by editing
`Project.Config` in the UI or via the API (`PUT /api/projects/:id`).

**Encryption key**: the same `ENCRYPTION_KEY` env var that protects SSH
keys in v2.1 now also protects env-var values + (Week 3) notification
provider credentials. Do NOT rotate this key in v3.0 — a future key-rotation
epic will handle that.

---

## 6. F-004, F-005, F-006, F-007, F-008, F-009 sections

_To be completed as each feature lands. See [versions/v3.0-foundation.md](./versions/v3.0-foundation.md)._

---

## 7. Rollback to v2.1 (emergency only)

```bash
pm2 stop deploy-center

# Restore DB
mysql deploy_center < backup-pre-v3.sql

# Restore deployments folder
tar xzf backup-pre-v3-deployments.tgz

# Check out v2.1 binaries
git checkout v2.1.2
cd server && npm install
cd ../client && npm install && npm run build

pm2 start deploy-center
```

**Caveat**: any jobs that were enqueued in BullMQ but not yet executed
will be lost when you roll back to v2.1 (v2.1 cannot read the Redis
queue). Drain the BullMQ queue first if possible — wait for `/admin/queues`
to show 0 active + 0 waiting before rolling back.

---

## 8. Post-upgrade checklist

- [ ] All migrations completed (check `SELECT * FROM SequelizeMeta ORDER BY name`)
- [ ] `redis-cli ping` returns PONG
- [ ] Bull Board reachable at `/admin/queues` as Admin, 403 as Developer
- [ ] Trigger a test deployment; verify it appears in Bull Board, executes, completes
- [ ] Force-kill the server mid-deployment; restart; verify the deployment resumes (SC-001)
- [ ] Add a test env var (Admin) on a project; trigger deploy with a pipeline step that echoes `$VAR`; verify value injected AND that secret values show as `***` in the deployment log (SC-006)
