# Environment Variables — Managing Configuration

This guide explains how to manage environment variables in Deploy Center for
use in deployments and applications.

**v3.0 update** — Deploy Center v3.0 introduced (F-003) an **encrypted
environment-variables store** with a dedicated table and a CRUD API.
The legacy `Project.Config.envVars` JSON path still works for v2.1
backward compatibility but is deprecated and will be removed in v3.1.
**Use the encrypted store for anything new.**

## Table of Contents

1. [Overview](#overview)
2. [Variable Types](#variable-types)
3. [Encrypted Variables (v3.0)](#encrypted-variables-v30)
4. [Setting Variables](#setting-variables)
5. [Using Variables](#using-variables)
6. [Security Best Practices](#security-best-practices)
7. [Common Patterns](#common-patterns)

---

## Overview

Environment variables are key-value pairs that configure your application's behavior without hardcoding values in your code.

### Why Use Environment Variables?

**Benefits:**

- ✅ **Separation of Config & Code**: Keep secrets out of Git
- ✅ **Environment-Specific Settings**: Different values for dev/staging/prod
- ✅ **Security**: Sensitive data not committed to repository
- ✅ **Flexibility**: Change configuration without code changes
- ✅ **12-Factor App Compliance**: Industry best practice

**Common Use Cases:**

- Database connection strings
- API keys and tokens
- Service URLs
- Feature flags
- Application ports
- Debug settings

---

## Variable Types

Deploy Center supports three sources of variables, merged together at pipeline
spawn time:

### 1. Encrypted Project Variables (v3.0 — recommended)

Stored in the `EnvironmentVariables` table, **encrypted at rest** with
AES-256-GCM (per-row IV), and injected into `process.env` during each
deployment step's `spawn()`. See [Encrypted Variables (v3.0)](#encrypted-variables-v30)
below for the full schema and API.

### 2. Legacy Project Config Variables (v2.1 — deprecated)

Plain-text values stored in the project's `Config.envVars` JSON column.
Still honored by the deployment pipeline for backward compatibility, but
**deprecated in v3.0 and removed in v3.1**. Migrate to the encrypted store.

### 3. System Variables (auto-provided)

Automatically supplied by Deploy Center on every deployment:

| Variable | Description | Example |
| --- | --- | --- |
| `$PROJECT_NAME` | Project name | `My Website` |
| `$PROJECT_PATH` | Working directory | `/tmp/deploy/123/repo` |
| `$PROJECT_TYPE` | Project type | `node` |
| `$ENVIRONMENT` | Environment name | `production` |
| `$BRANCH` | Git branch | `main` |
| `$COMMIT_HASH` | Full commit hash | `abc123def456...` |
| `$SHORT_HASH` | Short commit hash | `abc123d` |
| `$COMMIT_MESSAGE` | Commit message | `Fix bug` |
| `$AUTHOR` | Commit author | `John Doe` |
| `$REPO_NAME` | Repository name | `my-website` |
| `$DEPLOYMENT_ID` | Deployment ID | `123` |
| `$TRIGGERED_BY` | Trigger source | `webhook` / `manual` / `rollback` |
| `$TIMESTAMP` | Deployment time | `2026-05-24T11:30:00Z` |

---

## Encrypted Variables (v3.0)

Introduced as F-003 in v3.0.0 (2026-05-24).

### Schema

`EnvironmentVariables` table — one row per `(ProjectId, KeyName)`:

| Column | Type | Notes |
| --- | --- | --- |
| `Id` | `INT UNSIGNED PK AUTO_INCREMENT` | |
| `ProjectId` | `INT UNSIGNED FK → Projects.Id` | `ON DELETE CASCADE` |
| `KeyName` | `VARCHAR(100)` | Unique per project |
| `ValueEncrypted` | `TEXT` | AES-256-GCM ciphertext (base64) |
| `Iv` | `VARCHAR(32)` | Unique IV per row (hex) |
| `AuthTag` | `VARCHAR(32)` | GCM auth tag (hex) |
| `IsSecret` | `BOOLEAN` | Hide from UI + redact from logs |
| `CreatedAt` / `UpdatedAt` | `DATETIME` | UTC |

Unique index on `(ProjectId, KeyName)` — adding the same key twice returns
**409 Conflict**.

### REST API

All routes require `AuthMiddleware` + `RoleMiddleware([Admin, Manager])`
(FR-010). Routes are rate-limited via `RateLimiterMiddleware.ApiLimiter`
(100 req / 15 min). Mounted under `/api/projects/:projectId/env-vars`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/projects/:projectId/env-vars` | List vars. Values of `IsSecret=true` rows are returned as `"***"`. |
| `POST` | `/api/projects/:projectId/env-vars` | Create. Body: `{ KeyName, Value, IsSecret? }`. |
| `PUT` | `/api/projects/:projectId/env-vars/:id` | Update. Body: `{ Value?, IsSecret? }`. Re-encrypts. |
| `DELETE` | `/api/projects/:projectId/env-vars/:id` | Remove. |

### Encryption details

- Algorithm: **AES-256-GCM** via Node's `crypto` module.
- Master key: `ENCRYPTION_KEY` from `.env` (must be 32 bytes — same key as
  the SSH-key encryption from v2.1).
- **IV is unique per row** (16 random bytes, hex-encoded).
- The `AuthTag` is verified on every decrypt — tampered ciphertext fails to
  decrypt and is logged.
- Helper: [`Utils/EncryptionHelper.ts`](../../src/Utils/EncryptionHelper.ts).

### Pipeline injection

Values are decrypted **only at deployment time**, merged with system vars
and the legacy `Project.Config.envVars`, and passed as the `env` option to
each step's `spawn()`. They are **never written to disk**. Values where
`IsSecret=true` are also redacted from streamed logs (replaced by `***`).

### Secrets vs non-secrets

`IsSecret` controls UI + log behavior, not encryption — **every row is
encrypted at rest** regardless of `IsSecret`. Use `IsSecret=true` for API
keys / tokens / passwords. Use `IsSecret=false` for non-sensitive but
project-specific values (e.g., `API_URL`) where seeing the value in the UI
is convenient.

---

## Setting Variables

### Via Web Interface (v3.0 UI)

1. Go to your project details page.
2. Open the **"Environment Variables"** tab.
3. Click **"Add Variable"**.
4. Fill in:
   - **Key**: name (e.g., `API_KEY`) — UPPER_SNAKE_CASE, must be unique per project.
   - **Value**: the actual value (e.g., `sk-abc123...`).
   - **Is Secret**: toggle on for secrets (hides value in UI + redacts from logs).
5. Click **Save**.

**Edit / Delete / Toggle Secret**: each row has inline actions.

**Changes take effect on the next deployment** — existing builds are NOT
re-triggered. To apply a new variable immediately, manually trigger a new
deployment.

### Via REST API

```bash
# List
curl -X GET http://your-server:9090/api/projects/123/env-vars \
  -H "Authorization: Bearer $TOKEN"

# Create
curl -X POST http://your-server:9090/api/projects/123/env-vars \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"KeyName": "DATABASE_URL", "Value": "postgres://...", "IsSecret": true}'

# Update
curl -X PUT http://your-server:9090/api/projects/123/env-vars/5 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"Value": "postgres://new-host/..."}'

# Delete
curl -X DELETE http://your-server:9090/api/projects/123/env-vars/5 \
  -H "Authorization: Bearer $TOKEN"
```

**Response codes**: `201` create, `200` list/update, `204` delete, `400`
validation, `404` project/var not found, `409` duplicate KeyName.

### Legacy: `Project.Config.envVars` JSON (deprecated)

```json
{
  "envVars": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com"
  }
}
```

> ⚠️ **Deprecated in v3.0 — removed in v3.1.** Values are stored in
> plaintext. Migrate to the encrypted store via the API above. If both
> sources define the same key, the **encrypted store wins**.

---

## Using Variables

### In Pipeline Commands

Variables are available in all pipeline steps:

**Pre-Deployment Example:**

```json
{
  "Name": "Build Application",
  "Commands": [
    "export REACT_APP_API_URL=$API_URL",
    "export REACT_APP_VERSION=$SHORT_HASH",
    "npm run build"
  ]
}
```

**Post-Deployment Example:**

```json
{
  "Name": "Deploy to CDN",
  "Commands": [
    "aws s3 sync ./build s3://$S3_BUCKET --region $AWS_REGION"
  ]
}
```

### In Application Code

To make variables available to your application, they must be injected during deployment.

#### Node.js Applications

**Method 1: .env File Generation**

Create a `.env` file during post-deployment:

```json
{
  "Name": "Create Environment File",
  "Commands": [
    "cat > .env << EOF",
    "NODE_ENV=$NODE_ENV",
    "API_URL=$API_URL",
    "DATABASE_HOST=$DATABASE_HOST",
    "EOF"
  ]
}
```

Access in Node.js:

```javascript
require('dotenv').config();

const apiUrl = process.env.API_URL;
const dbHost = process.env.DATABASE_HOST;
```

**Method 2: PM2 Ecosystem File**

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'myapp',
    script: './dist/index.js',
    env: {
      NODE_ENV: 'production',
      API_URL: process.env.API_URL,
      DATABASE_HOST: process.env.DATABASE_HOST
    }
  }]
};
```

Start with PM2:

```bash
pm2 start ecosystem.config.js
```

#### React Applications

**Build-time Variables:**

Variables prefixed with `REACT_APP_` are embedded during build:

```json
{
  "Name": "Build React App",
  "Commands": [
    "export REACT_APP_API_URL=$API_URL",
    "export REACT_APP_VERSION=$SHORT_HASH",
    "npm run build"
  ]
}
```

Access in React:

```javascript
const apiUrl = process.env.REACT_APP_API_URL;
const version = process.env.REACT_APP_VERSION;
```

**⚠️ Security Warning:**

- `REACT_APP_*` variables are embedded in JavaScript bundle
- Never put secrets in `REACT_APP_*` variables
- They are visible to anyone inspecting your frontend code

#### Next.js Applications

**Server-side Variables:**

```javascript
// .env.production (generated during deployment)
DATABASE_URL=postgresql://...
API_SECRET_KEY=sk-abc123...
```

```javascript
// Access in server components
const dbUrl = process.env.DATABASE_URL;
```

**Public Variables:**

```javascript
// .env.production
NEXT_PUBLIC_API_URL=https://api.example.com
```

```javascript
// Access in client components
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

#### PHP Applications

**Method 1: .env File (Laravel)**

```json
{
  "Name": "Create Environment File",
  "Commands": [
    "cat > .env << EOF",
    "APP_ENV=$ENVIRONMENT",
    "APP_URL=$APP_URL",
    "DB_HOST=$DATABASE_HOST",
    "DB_DATABASE=$DATABASE_NAME",
    "EOF"
  ]
}
```

Access in Laravel:

```php
$apiUrl = env('APP_URL');
$dbHost = env('DB_HOST');
```

**Method 2: php.ini or web.config**

For traditional PHP apps, set environment in server configuration.

---

## Security Best Practices

### ✅ Do

**1. Use Variables for Sensitive Data**

```bash
# Good
DATABASE_PASSWORD=$DB_PASSWORD

# Bad (hardcoded in code)
const password = "super_secret_password";
```

**2. Use Different Values per Environment**

```bash
# Development
API_URL=https://api-dev.example.com

# Production
API_URL=https://api.example.com
```

**3. Rotate Secrets Regularly**

- Update API keys monthly
- Regenerate tokens after team changes
- Change passwords on schedule

**4. Limit Variable Visibility**

- Only admins/managers can view variables in UI
- Developers see variable names, not values
- Variables not logged in deployment logs

**5. Use Descriptive Names**

```bash
# Good
DATABASE_CONNECTION_STRING
AWS_S3_BUCKET_NAME

# Bad
DB
BUCKET
```

### ❌ Don't

**1. Don't Commit Secrets to Git**

```bash
# Bad - this will be in Git history forever
git add .env
git commit -m "Add production secrets"
```

**2. Don't Use Variables for Non-Sensitive Data**

```bash
# Overkill - just hardcode this
APP_NAME=$APP_NAME

# Better in code
const APP_NAME = "My Application";
```

**3. Don't Put Secrets in Frontend Variables**

```bash
# Bad - visible in browser
REACT_APP_API_SECRET_KEY=sk-abc123...

# Good - only use public values
REACT_APP_API_URL=https://api.example.com
```

**4. Don't Share Variables Between Projects**

- Each project should have its own variables
- Reduces blast radius if compromised

**5. Don't Hardcode Production Values in Development**

```javascript
// Bad
const apiUrl = process.env.API_URL || "https://api.example.com";

// Good
const apiUrl = process.env.API_URL || "http://localhost:3000";
```

---

## Common Patterns

### Node.js API Server

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost/db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
API_KEY=sk-abc123...
LOG_LEVEL=info
```

### React Frontend

```bash
REACT_APP_API_URL=https://api.example.com
REACT_APP_GA_TRACKING_ID=UA-123456789-1
REACT_APP_SENTRY_DSN=https://...@sentry.io/123
REACT_APP_VERSION=$SHORT_HASH
```

### Next.js Application

```bash
# Server-side only
DATABASE_URL=postgresql://...
SECRET_KEY=abc123...

# Public (client-side)
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_STRIPE_KEY=pk_live_...
```

### Laravel PHP

```bash
APP_NAME=MyApp
APP_ENV=production
APP_URL=https://example.com
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=myapp
DB_USERNAME=dbuser
DB_PASSWORD=dbpass
REDIS_HOST=127.0.0.1
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
```

### Docker Application

```bash
DOCKER_IMAGE=myapp:latest
DOCKER_TAG=$SHORT_HASH
DOCKER_REGISTRY=registry.example.com
CONTAINER_NAME=myapp-prod
HOST_PORT=80
CONTAINER_PORT=3000
```

---

## Variable Validation

Deploy Center validates variable names:

**Valid:**

```bash
NODE_ENV          ✅
API_URL           ✅
DATABASE_HOST     ✅
S3_BUCKET_NAME    ✅
```

**Invalid:**

```bash
node-env          ❌ (hyphens not allowed)
api url           ❌ (spaces not allowed)
123_VAR           ❌ (starts with number)
```

**Naming Convention:**

- Use UPPERCASE letters
- Use underscores `_` for separation
- Start with a letter
- Only alphanumeric and underscores

---

## Troubleshooting

### Variable Not Available in Application

**Check 1: Variable exported in pipeline**

```bash
# In pre-deployment or post-deployment pipeline
export API_URL=$API_URL
```

**Check 2: Application reads from correct source**

```javascript
// Node.js - requires dotenv
require('dotenv').config();
console.log(process.env.API_URL);
```

**Check 3: .env file created correctly**

```bash
# Check if file exists
ls -la .env

# Check file contents
cat .env
```

### Variable Shows as Empty

**Cause:** Variable not defined in project.

**Solution:**

1. Go to project settings
2. Check "Environment Variables" section
3. Add missing variable

### Variable Not Replaced in Pipeline

**Cause:** Syntax error or variable doesn't exist.

**Check:**

```bash
# Correct
echo $API_URL

# Incorrect
echo API_URL  # Missing $
echo ${API_URL  # Missing }
```

---

## Related Documentation

- [Pipeline Configuration](./pipeline-configuration.md) - Using variables in pipelines
- [Creating Projects](./creating-projects.md) - Setting up projects
- [Deployment Workflows](./deployment-workflows.md) - How deployments work

---

**Need Help?** Join our [Discord community](https://discord.gg/j8edhTZy) or [open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).
