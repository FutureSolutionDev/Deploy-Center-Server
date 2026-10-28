# Deploy Center 3.0.1 — Security Hotfix: Operator Guide

**Audience:** anyone running Deploy Center 3.0.0 (or 2.1.x) in any environment.
**Urgency:** upgrade as soon as possible, then complete the rotation steps
below. The rotation steps are **mandatory** even after upgrading: the fixed
issues allowed secrets to leak, and upgrading does not un-leak them.

This guide describes what changed and what you must do. It deliberately does
not describe how the old issues could be exploited.

---

## 1. What changed

| Area | Change |
| --- | --- |
| Registration | Public sign-up is closed by default (`ALLOW_REGISTRATION=false`). The first account on an empty system becomes Admin; after that, admins create accounts. A role sent by the client is always ignored. |
| Real-time (Socket.IO) | Connections must be authenticated (the `access_token` cookie). Joining a project or deployment room requires the same access as the HTTP API. Events carry minimal data, never secrets, and are no longer broadcast to everyone. |
| Two-factor login | The 2FA step is bound to the password step through a short-lived, single-use, httpOnly cookie. Per-account lockout after repeated wrong codes. New, much stronger backup codes. |
| Pipeline conditions | `RunIf` is evaluated by a safe parser instead of being executed as code. |
| Command execution | git, rsync, chown and ssh-keygen no longer go through a shell. Branches, commits, repository URLs and rsync options are validated strictly. |
| Access control | Every project and deployment route checks project membership. Viewers only see projects they are members of. |
| Secrets in the API | Webhook secrets, SSH private keys, secret variable values, notification tokens and password hashes are never returned. The API reports only whether a value is set (`HasValue: true`). |
| Startup | In production the server refuses to start with missing, short or placeholder secrets. Real environment variables now take precedence over `.env`. |
| Install / build | A fresh install on an empty database now boots (baseline migration `000_initial_schema`). `npm run build` no longer deletes `dist/` before compiling. Vulnerable dependencies were updated. |
| Legacy webhooks | `/webhook/github/:project` (v2.1 URL) works again; it was being rejected by CSRF protection. |

---

## 2. Breaking changes

Read these before upgrading.

1. **Registration is closed.** `POST /api/auth/register` returns `403` once
   any user exists. To allow self-service sign-up again, set
   `ALLOW_REGISTRATION=true`; self-registered users are always **Viewer**.
   On a fresh install with no `DEFAULT_ADMIN_*` variables, the first account
   registered becomes Admin, so create it right after installation. The
   bundled UI has no sign-up page; use `DEFAULT_ADMIN_*`, or the API:
   ```bash
   BASE=https://deploy.example.com
   curl -s -c jar -b jar -A dc-setup "$BASE/api/auth/registration-status"   # SetupRequired: true
   TOKEN=$(awk '$6=="XSRF-TOKEN"{print $7}' jar)
   curl -s -c jar -b jar -A dc-setup -H 'Content-Type: application/json' \
     -H "X-XSRF-TOKEN: $TOKEN" \
     -d '{"Username":"admin","Email":"you@example.com","Password":"<strong password>"}' \
     "$BASE/api/auth/register"
   rm jar
   ```
   (The custom `-A` user agent is needed because the request filter rejects
   the default curl user agent.)
2. **Secrets are write-only.**
   - The webhook secret is no longer displayed. To get one, **regenerate**
     it: the new value is returned once, and the 3.0.1 UI shows it once
     (with an older UI, use the CLI in section 4.1).
   - Secret values in project variables and legacy notification settings
     come back as `********`. Saving a form that still contains `********`
     keeps the stored value; type a new value to replace it.
   - Variables named `BuildCommand`, `BuildCmd`, `BuildOutput`,
     `TargetPath`, `Target`, `Pm2Name` and `Type` stay readable. Every other
     legacy variable value is treated as secret.
   - Repository URLs are shown without embedded credentials.
   - API consumers that read `Project.WebhookSecret`, `SshKeyEncrypted` or
     secret values must switch to the `Secrets` map (`{ "<path>": { "HasValue": true } }`).
3. **Two-factor login flow.**
   - `POST /api/auth/verify-2fa` takes `{ "Code": "..." }` and requires the
     `mfa_pending` cookie set by `/api/auth/login` in the same browser
     session. A `UserId` in the body is ignored.
   - The pending step expires after 5 minutes and is burned after 5 wrong
     codes; the user must enter the password again.
   - 5 consecutive wrong codes lock the second factor for 15 minutes.
   - **Backup codes issued before 3.0.1 no longer work.** Users with 2FA
     must regenerate backup codes (Settings → Security). Their authenticator
     app keeps working. The 2FA status response reports
     `legacyBackupCodesInvalidated: true` for affected accounts.
4. **Viewers** only see projects they are members of (as documented in the
   RBAC matrix). Add Viewers as project members where needed.
5. **Managers** can now manage SSH keys, deploy and cancel on any project,
   matching the documented RBAC matrix (they were wrongly refused before).
6. **Stricter project validation** (a deploy of an invalid project fails
   with a clear error; saving one returns `400`):
   - Repository URL must be `https://…`, `ssh://…` or `user@host:path`.
     `http://`, `git://`, `file://` and local paths are rejected.
   - Branch names may only contain letters, digits and `. _ / + @ -`, and
     must be valid git branch names.
   - Commit hashes must be 7–40 lowercase hex characters.
   - `RsyncOptions` may only contain allow-listed flags (for example
     `-rv --delete --omit-dir-times --no-perms --no-owner --no-group`);
     `-e`, `--rsh` and `--rsync-path` are refused.
7. **Production refuses insecure secrets.** With `NODE_ENV=production`, boot
   fails if `JWT_SECRET`, `JWT_REFRESH_SECRET` or `ENCRYPTION_KEY` is
   missing, shorter than 32 characters or a placeholder, if the two JWT
   secrets are equal, or if `DB_PASSWORD` / `DEFAULT_ADMIN_PASSWORD` is a
   shipped placeholder.
8. **Environment precedence.** Variables from the real environment
   (systemd, Docker, PM2 `env_production`) now override `.env`. If you
   relied on `.env` overriding them, move the value.
9. **Node.js 20 or newer** is required (nodemailer 10; Node 18 is EOL).
10. **Socket.IO clients** must authenticate. Browsers do this automatically
    with the session cookie; custom clients pass a valid access token as
    `auth: { token }`.
11. **Test-webhook endpoints** (`/api/webhooks/test/:project`) now require
    login and access to the project.

### Find projects that will fail validation

```sql
SELECT Id, Name, RepoUrl, Branch
FROM Projects
WHERE RepoUrl NOT REGEXP '^(https://|ssh://|[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:)'
   OR Branch NOT REGEXP '^[A-Za-z0-9._/+@-]+$'
   OR JSON_UNQUOTE(JSON_EXTRACT(Config, '$.RsyncOptions')) REGEXP '(^|[[:space:]])(-e|--rsh|--rsync-path)';
```

---

## 3. Upgrade steps

1. **Back up** the database **and `ENCRYPTION_KEY`**. Without the key, every
   encrypted value (SSH keys, environment variables, notification provider
   credentials, 2FA secrets) is unrecoverable.
2. Install Node.js 20 or 22.
3. Make sure production secrets are strong (section 4.2 shows how to
   generate them).
4. Deploy the new version:
   ```bash
   git pull
   npm ci
   npm run build        # dist/ is replaced only if compilation succeeds
   pm2 reload ecosystem.config.js --env production
   ```
   Migrations `000_initial_schema` (no-op on existing databases),
   `022_create_mfa_challenges_and_2fa_lockout` and
   `023_backfill_creator_memberships` (adds an owner membership for each
   project creator who has no membership in that project yet; existing
   memberships are left as they are, since access is now decided by
   membership alone) run
   automatically when `DB_AUTO_MIGRATE=true`, or run `npm run migrate`.
   The 3.0.1 release archive already contains the 3.0.1 UI in `public/`.
5. Check the startup log for `Insecure configuration` warnings or a
   `Refusing to start` error.
6. Complete **all** rotation steps in section 4.

---

## 4. Mandatory secret rotation

Before 3.0.1, project data including webhook secrets and encrypted SSH keys
could be received by anyone able to reach the server. Treat all of the
following as compromised.

### 4.1 Webhook secrets (every project)

```bash
# Rotate all projects. New secrets go ONLY to a 0600 file, never to the
# terminal or the logs. The file is never overwritten.
npm run rotate:webhook-secrets -- --all --out ./webhook-secrets.json

# One project, by id or name
npm run rotate:webhook-secrets -- --only my-app --out ./my-app-secret.json

# Preview without changing anything
npm run rotate:webhook-secrets -- --all --dry-run
```

`npm run rotate:webhook-secrets` uses `ts-node` (a dev dependency). On a host
installed with `npm ci --omit=dev`, run the compiled script instead:

```bash
node -r ./tsconfig-paths-bootstrap.js dist/scripts/rotate-webhook-secrets.js --all --out ./webhook-secrets.json
```

Then, for each project, open **GitHub → Settings → Webhooks** for the
repository, paste the new secret from the file, save, and use "Redeliver"
on a recent delivery to confirm it is accepted. Delete the file when done.
Each rotation is recorded in the audit log as `webhook_secret_rotated`.

You can also rotate one project from the UI or API
(`POST /api/projects/:id/regenerate-webhook`), which returns the new secret once.

### 4.2 JWT secrets

Rotating these signs everyone out, which is the point: any session or token
minted with an old or default secret becomes invalid.

```bash
openssl rand -hex 64   # JWT_SECRET
openssl rand -hex 64   # JWT_REFRESH_SECRET (must differ)
```

Set both in the environment (or `.env`) and restart. If you ever ran with the
built-in defaults, also review the user list for accounts you do not
recognise:

```sql
SELECT Id, Username, Email, Role, CreatedAt, LastLogin FROM Users ORDER BY CreatedAt;
```

### 4.3 SSH deploy keys (every project that uses one)

For each project with an SSH key:

1. Regenerate the key: project page → SSH Key → Regenerate, or
   `PUT /api/projects/:id/ssh-key`.
2. Add the new public key as a deploy key on the repository (read-only).
3. **Delete the old deploy key** from the repository. Regenerating on the
   server does not revoke the old key on GitHub.

### 4.4 Other values that may have been exposed

- **Legacy project variables** (`Config.Variables`) and **legacy
  notification settings** (Discord/Slack webhook URLs, Telegram bot tokens,
  SMTP passwords): rotate them at the provider, then enter the new values.
- **If `ENCRYPTION_KEY` was ever a default or placeholder value**, every
  encrypted value must be considered readable. 3.0.1 does not include a
  re-encryption tool (planned for 3.1). Set a new key (`openssl rand -hex 32`),
  then re-create everything that was encrypted with the old one:
  regenerate SSH keys (4.3), re-enter environment variable values and
  notification provider credentials, and have users with 2FA disable and
  re-enrol it. Values encrypted with the old key can no longer be decrypted
  after the change.

### 4.5 Review activity

Look for deployments you did not expect, especially manual ones and ones
from unusual branches:

```sql
SELECT Id, ProjectId, TriggerType, Branch, CommitHash, Author, CreatedAt
FROM Deployments
ORDER BY CreatedAt DESC
LIMIT 200;
```

---

## 5. Known gaps

- **UI-H0 is resolved.** The v3.0 client source is back in the client
  repository with the 3.0.1 changes (authenticated sockets, the cookie-bound
  2FA flow, write-only secrets), and the UI bundled in `public/` is built from
  it. A regenerated webhook secret is shown once on the project page.
- Pipelines still run on the host as the server user. Isolated runners are
  planned for v4.0. Only give Developer access to people you trust with the
  server account.
- Sessions are still stateless JWTs without server-side revocation;
  rotating the JWT secrets (4.2) is the way to revoke all of them.
