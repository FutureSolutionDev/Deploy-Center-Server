# Deployment Workflows - Understanding the Process

This guide explains how deployments work in Deploy Center from start to finish, including the queuing system, execution pipeline, and result handling.

## Table of Contents

1. [Overview](#overview)
2. [Deployment Triggers](#deployment-triggers)
3. [Queue System](#queue-system)
4. [Deployment Lifecycle](#deployment-lifecycle)
5. [Monitoring Deployments](#monitoring-deployments)
6. [Troubleshooting](#troubleshooting)

---

## Overview

Deploy Center uses a sophisticated deployment workflow that ensures reliable, traceable, and conflict-free deployments. Every deployment goes through a structured pipeline from trigger to completion.

### Key Features

- **Queue Management**: Per-project queues prevent deployment conflicts
- **Real-Time Updates**: Live status via WebSocket connections
- **Automated Recovery**: Built-in rollback and error handling
- **Detailed Logging**: Step-by-step execution logs
- **Multi-Path Support**: Deploy to multiple locations simultaneously

---

## Deployment Triggers

There are two ways to trigger a deployment:

### 1. Manual Deployment

Triggered by a user through the UI or API.

**When to use:**

- Production deployments requiring approval
- Testing specific commits
- Off-hours deployments
- Emergency hotfixes

**How it works:**

1. User clicks "Deploy" button in the project dashboard
2. Selects branch and optional commit hash
3. Adds deployment notes (optional)
4. Deployment is created and queued

**Permissions:**

- Admin/Manager: Can deploy any project
- Developer: Can deploy assigned projects only
- Viewer: Cannot trigger deployments

### 2. GitHub Webhook (Auto Deploy)

Triggered automatically when code is pushed to the repository.

**When to use:**

- Continuous deployment workflows
- Development/staging environments
- Automated testing pipelines

**How it works:**

1. Developer pushes code to GitHub
2. GitHub sends webhook to Deploy Center
3. Webhook is verified using HMAC-SHA256 signature
4. Payload is processed and validated
5. Deployment conditions are checked
6. If all conditions pass, deployment is queued

**Deployment Conditions:**

- Branch must match project configuration
- Repository URL must match
- Auto-deploy must be enabled
- Optional: Specific file paths must be changed (if configured)

---

## Queue System

Deploy Center uses a **per-project queue** system to manage deployment execution.

### Why Queuing?

- **Prevents Conflicts**: Only one deployment runs per project at a time
- **Maintains Order**: Deployments execute in the order they were triggered
- **Resource Management**: Prevents server overload
- **Cancellation Support**: Queue items can be cancelled before execution

### Queue Lifecycle

```
┌─────────────┐
│   Trigger   │ (Manual/Webhook)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Queued    │ (Status: Queued)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Executing  │ (Status: InProgress)
└──────┬──────┘
       │
       ├──────────┐
       ▼          ▼
┌──────────┐  ┌──────┐
│ Success  │  │Failed│
└──────────┘  └──────┘
```

### Queue Priority

- All deployments in a project queue have equal priority
- Execution order is **FIFO (First In, First Out)**
- Cancelling a queued deployment removes it from the queue
- Failed deployments don't block the queue

---

## Deployment Lifecycle

A deployment goes through several stages:

### Stage 1: Preparation

**Duration:** ~5-10 seconds

**What happens:**

1. Working directory is created (`deployments/{projectId}/{deploymentId}`)
2. Deployment status set to "InProgress"
3. "Deployment Started" notification sent (if enabled)
4. SSH key context prepared (for private repositories)

**File Structure:**

```
deployments/
  └── {projectId}/
      └── {deploymentId}/
          └── {repositoryName}/  ← Working directory
```

### Stage 2: Repository Preparation

**Duration:** Depends on repository size

**What happens:**

**For First Deployment:**

- Full Git clone of the repository
- Uses HTTPS or SSH based on configuration
- Checks out the specified branch

**For Subsequent Deployments:**

- Git pull to update existing repository
- Faster than cloning
- Preserves Git history

**SSH Key Security:**

- Private key decrypted from database
- Temporary key file created with strict permissions (0600)
- Key file deleted immediately after use
- Uses `GIT_SSH_COMMAND` environment variable

### Stage 3: Pre-Deployment Pipeline

**Duration:** Depends on pipeline steps

**What happens:**

1. Each pipeline step executes sequentially
2. Commands run in the working directory
3. Step logs are captured in real-time
4. Environment variables are injected
5. Variables are replaced (e.g., `$BRANCH`, `$COMMIT_HASH`)
6. Conditional steps evaluated (using `runIf` expressions)

**Common Tasks:**

- Installing dependencies (`npm install`, `composer install`)
- Building application (`npm run build`, `mvn package`)
- Running tests (`npm test`, `pytest`)
- Compiling assets

**Failure Handling:**

- If any step fails (exit code ≠ 0), pipeline stops
- Deployment marked as failed
- Working directory cleaned up
- No files synced to production

### Stage 4: File Synchronization

**Duration:** Depends on file count and size

**What happens:**

**Smart Sync Logic:**

- Only changed files are copied (not full sync)
- Respects `SyncIgnorePatterns` (like `.gitignore`)
- Handles `BuildOutputPath` if specified
- Supports multiple deployment paths
- Preserves system files (`.env`, `.htaccess`, `web.config`, etc.)

**Sync Methods:**

- **Windows:** PowerShell-based copy with progress
- **Linux/Mac:** rsync with custom options

**Multi-Path Deployment:**
If multiple deployment paths are configured, files are synced to each path sequentially.

**Example:**

```json
DeploymentPaths: [
  "/var/www/production",
  "/var/www/backup",
  "/mnt/cdn/public"
]
```

### Stage 5: Post-Deployment Pipeline

**Duration:** Depends on pipeline steps

**What happens:**

1. Each step executes in the **production directory**
2. Commands run sequentially
3. Environment variables available
4. Real-time logging

**Common Tasks:**

- Restarting services (`pm2 restart app`, `systemctl restart nginx`)
- Running migrations (`php artisan migrate`, `npm run migrate`)
- Clearing caches
- Warming up application
- Health checks

**Rollback Support:**
If "Enable Automatic Rollback" is configured:

- Previous version backed up before sync
- If post-deployment fails, backup is restored
- Deployment marked as failed

### Stage 6: Completion

**Duration:** < 1 second

**What happens:**

1. Deployment metadata written to `.deploy-center` files
2. Deployment status updated (Success/Failed)
3. Duration calculated
4. Completion notification sent
5. Working directory cleaned up
6. SSH key context destroyed
7. Next queued deployment starts (if any)

**Metadata File (`.deploy-center`):**

```json
{
  "deploymentId": 123,
  "projectId": 45,
  "deployedAt": "2026-01-04T11:30:00.000Z",
  "branch": "main",
  "commitHash": "abc123",
  "triggeredBy": "webhook",
  "duration": 180000
}
```

---

## Monitoring Deployments

### Real-Time Updates

Deploy Center provides live deployment monitoring via WebSocket:

**Available in UI:**

- Current deployment status
- Step-by-step progress
- Live command output
- Estimated completion time
- Queue position (for queued deployments)

**Status Values:**

- `Queued` - Waiting in queue
- `InProgress` - Currently executing
- `Success` - Completed successfully
- `Failed` - Failed during execution
- `Cancelled` - Cancelled by user

### Deployment Logs

Each deployment captures:

- **Preparation Logs**: Repository cloning/pulling
- **Step Logs**: Output from each pipeline step
- **Sync Logs**: File synchronization progress
- **Error Logs**: Failures and stack traces
- **Timing Information**: Duration for each phase

**Log Retention:**

- Logs stored in database (`DeploymentSteps` table)
- Available via API and UI
- No automatic cleanup (manual purge if needed)

### Notifications

Deployment notifications can be sent to:

**Discord:**

- Rich embeds with color-coded status
- Deployment details (branch, commit, author)
- Direct link to deployment logs
- Error messages (if failed)

**Other Channels (Coming Soon):**

- Slack
- Email
- Telegram

---

## Troubleshooting

### Common Issues

#### Deployment Stuck in Queue

**Symptoms:** Deployment shows "Queued" but never starts

**Causes:**

- Another deployment is running for the same project
- Server service stopped/crashed

**Solutions:**

1. Check if another deployment is running
2. Cancel stuck deployment
3. Restart Deploy Center service

#### Git Clone Fails

**Symptoms:** "Failed to clone repository" error

**Causes:**

- Invalid repository URL
- Private repository without SSH key
- Network connectivity issues
- Invalid credentials

**Solutions:**

1. Verify repository URL is correct
2. For private repos, generate and add SSH key
3. Check server network connectivity
4. Test manual git clone on server

#### Build Step Fails

**Symptoms:** Pipeline fails during build step

**Causes:**

- Missing dependencies
- Incorrect build command
- Out of memory
- Environment variable missing

**Solutions:**

1. Check step logs for specific error
2. Verify build command is correct
3. Ensure all dependencies are installed
4. Check available server resources
5. Verify environment variables

#### Post-Deployment Fails

**Symptoms:** Files deployed but post-deployment step fails

**Causes:**

- Service restart requires sudo
- Command not found in PATH
- Application won't start
- Port already in use

**Solutions:**

1. Check command permissions
2. Use absolute paths for binaries
3. Verify service configuration
4. Check application logs
5. Enable automatic rollback for safety

### Best Practices

✅ **Do:**

- Test pipelines manually before deploying
- Use conditional steps for environment-specific tasks
- Enable notifications for production deployments
- Keep build steps fast and focused
- Use `npm ci` instead of `npm install` for faster builds
- Test rollback procedure in staging

❌ **Don't:**

- Run deployments as root user
- Use long-running commands in pipelines
- Deploy directly to production without testing
- Ignore failed deployments
- Skip testing webhook integration
- Store secrets in pipeline commands (use environment variables)

---

## Related Documentation

- [Pipeline Configuration](./pipeline-configuration.md) - Advanced pipeline setup
- [SSH Key Management](./ssh-keys.md) - Working with private repositories
- [Webhook Setup](./webhooks.md) - Configuring GitHub webhooks
- [Notifications Setup](./notifications.md) - Configuring notification channels

---

**Need Help?** Join our [Discord community](https://discord.gg/j8edhTZy) or [open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).
