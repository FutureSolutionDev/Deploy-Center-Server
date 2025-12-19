# Deploy Center - Deployment Guide

Complete guide for safe, production-ready deployments with zero downtime.

## 📚 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Pipeline Configuration](#pipeline-configuration)
4. [Deployment Strategies](#deployment-strategies)
5. [Variables Reference](#variables-reference)
6. [Safety Features](#safety-features)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Deploy Center is a self-hosted CI/CD platform designed as a complete alternative to GitHub Actions. It provides:

- ✅ **Zero Downtime Deployments** with PM2 reload
- ✅ **Automatic Rollback** on health check failure
- ✅ **Safe File Handling** preserves uploads, logs, .env
- ✅ **Build Isolation** in temporary directories
- ✅ **Auto-Recovery** for common issues (npm permissions, disk space)
- ✅ **SSH Key Management** for private repositories
- ✅ **Pipeline-Based** fully customizable deployment process

---

## Quick Start

### 1. Create a Project

```json
{
  "Name": "My Application",
  "RepoUrl": "git@github.com:user/repo.git",
  "ProjectPath": "/www/wwwroot/my-app",
  "Branch": "main",
  "Config": {
    "AutoDeploy": true,
    "Environment": "production",
    "Variables": {
      "PM2ProcessName": "my-app",
      "BuildCommand": "npm run build",
      "BuildOutput": "dist"
    },
    "Pipeline": [
      /* See Pipeline Configuration below */
    ]
  }
}
```

### 2. Configure GitHub Webhook

- Go to Repository Settings → Webhooks → Add webhook
- **Payload URL**: `https://your-server.com/api/webhook/github`
- **Content type**: `application/json`
- **Secret**: Your project's webhook secret
- **Events**: Just the `push` event

### 3. Push to Repository

```bash
git push origin main
```

Deployment will trigger automatically!

---

## Pipeline Configuration

### Basic Node.js Backend Pipeline

```json
{
  "Pipeline": [
    {
      "Name": "Install Dependencies",
      "Run": ["cd {{WorkingDirectory}}", "npm ci --force"]
    },
    {
      "Name": "Build TypeScript",
      "Run": ["cd {{WorkingDirectory}}", "{{BuildCommand}}"]
    },
    {
      "Name": "Backup Current Release",
      "Run": [
        "[ -d {{TargetPath}}/{{BuildOutput}} ] && cp -r {{TargetPath}}/{{BuildOutput}} /tmp/backup-{{DeploymentId}} || true"
      ]
    },
    {
      "Name": "Sync Built Files",
      "Run": [
        "rsync -av --exclude='uploads' --exclude='logs' --exclude='.env' --exclude='node_modules' --delete-after {{WorkingDirectory}}/{{BuildOutput}}/ {{TargetPath}}/{{BuildOutput}}/"
      ]
    },
    {
      "Name": "Install Production Dependencies",
      "Run": ["cd {{TargetPath}}", "npm ci --production --force"]
    },
    {
      "Name": "Reload PM2",
      "Run": ["pm2 reload {{PM2ProcessName}}"]
    },
    {
      "Name": "Health Check",
      "Run": [
        "sleep 5",
        "pm2 describe {{PM2ProcessName}} | grep -q 'online' || (echo 'Rollback...' && rsync -av --delete /tmp/backup-{{DeploymentId}}/ {{TargetPath}}/{{BuildOutput}}/ && pm2 reload {{PM2ProcessName}} && exit 1)"
      ]
    },
    {
      "Name": "Cleanup",
      "Run": ["rm -rf /tmp/backup-{{DeploymentId}}"]
    }
  ]
}
```

### Step Anatomy

```json
{
  "Name": "Human-readable step name",
  "RunIf": "optional JavaScript condition",
  "Run": ["command1", "command2 && command3"]
}
```

**`RunIf` Conditions:**

```json
{
  "Name": "Run Migrations",
  "RunIf": "hasVar('MigrateCommand')",
  "Run": ["{{MigrateCommand}}"]
}
```

Available function:

- `hasVar('variableName')` - Check if variable exists

---

## Deployment Strategies

### Strategy 1: Simple Rsync (Recommended for Most Projects)

**Best for:** Small to medium Node.js applications

**Features:**

- Build in temporary directory
- Backup before deployment
- Automatic rollback on failure
- Preserves uploads, logs, .env

**See:** `examples/pipelines/nodejs-backend-safe-deployment.json`

### Strategy 2: Blue-Green Deployment

**Best for:** Enterprise applications requiring instant rollback

**Features:**

- Two complete copies (blue/green)
- Instant rollback via symlink
- Zero downtime
- Keeps last 5 releases

**Structure:**

```
/www/wwwroot/my-app/
├── current -> releases/release-42/
├── previous -> releases/release-41/
├── releases/
│   ├── release-41/
│   ├── release-42/
│   └── release-43/
├── shared/
│   ├── uploads/
│   ├── logs/
│   └── .env
```

**Rollback:**

```bash
ln -sfn previous current && pm2 reload my-app
```

---

## Variables Reference

### Automatic Variables

These are available in all pipelines without definition:

| Variable              | Value                                      | Example                                           |
| --------------------- | ------------------------------------------ | ------------------------------------------------- |
| `{{RepoName}}`        | Repository name                            | `my-backend-api`                                  |
| `{{Branch}}`          | Branch name                                | `main`                                            |
| `{{Commit}}`          | Commit hash                                | `9a544a0...`                                      |
| `{{CommitHash}}`      | Same as Commit                             | `9a544a0...`                                      |
| `{{CommitMessage}}`   | Commit message                             | `feat: Add auto-recovery`                         |
| `{{Author}}`          | Commit author                              | `John Doe`                                        |
| `{{ProjectName}}`     | Project name                               | `My Backend API`                                  |
| `{{ProjectId}}`       | Project ID                                 | `1`                                               |
| `{{DeploymentId}}`    | Deployment ID                              | `42`                                              |
| `{{Environment}}`     | Environment from config                    | `production`                                      |
| `{{WorkingDirectory}}`| Temporary deployment directory             | `/deployments/project-1/deployment-42`            |
| `{{ProjectPath}}`     | Final project path                         | `/www/wwwroot/my-app`                             |
| `{{TargetPath}}`      | Same as ProjectPath                        | `/www/wwwroot/my-app`                             |
| `{{RepoUrl}}`         | Repository URL                             | `git@github.com:user/repo.git`                    |

### Custom Variables

Define in `Config.Variables`:

```json
{
  "Variables": {
    "PM2ProcessName": "my-app-api",
    "BuildCommand": "npm run build",
    "BuildOutput": "dist",
    "MigrateCommand": "npm run migrate:up",
    "HealthCheckUrl": "http://localhost:3000/health"
  }
}
```

**Usage in Pipeline:**

```json
{
  "Run": ["{{BuildCommand}}", "pm2 reload {{PM2ProcessName}}"]
}
```

**See:** `examples/projects/VARIABLES_GUIDE.md` for complete reference

---

## Safety Features

### 1. Build Isolation

All builds happen in temporary directories:

```
/deployments/project-1/deployment-42/
├── src/
├── dist/           ← Build here
├── package.json
└── node_modules/
```

If build fails, production is **completely unaffected**.

### 2. Protected Files

`rsync --exclude` protects these files from deletion:

- `uploads/` - User uploads
- `logs/` - Application logs
- `.env` - Environment variables
- `node_modules/` - Dependencies
- `.git/` - Git repository
- `*.log` - Log files

### 3. Automatic Backup

Before each deployment:

```bash
cp -r {{TargetPath}}/dist /tmp/backup-{{DeploymentId}}
```

### 4. Health Checks

After PM2 reload, verify application is running:

```bash
pm2 describe {{PM2ProcessName}} | grep -q 'online'
```

If fails → **Automatic Rollback**

### 5. Automatic Rollback

On health check failure:

```bash
rsync -av --delete /tmp/backup-{{DeploymentId}}/ {{TargetPath}}/dist/
pm2 reload {{PM2ProcessName}}
```

### 6. Auto-Recovery

Automatically fixes common issues:

- **npm permissions** - Fixes EACCES errors
- **Disk space** - Cleans old deployments
- **Stuck processes** - Kills blocking processes
- **SSH key issues** - Retries with exponential backoff

---

## Troubleshooting

### Deployment Fails with "command not found"

**Problem:** Using undefined variable like `{{BuildCommand}}`

**Solution:** Define it in `Config.Variables`:

```json
{
  "Variables": {
    "BuildCommand": "npm run build"
  }
}
```

### Files Being Deleted (uploads, logs)

**Problem:** Pipeline not configured, using legacy `PublishDeploymentToTarget`

**Solution:** Add a complete Pipeline. System will automatically skip legacy mode.

### npm EACCES Error

**Problem:** npm cache owned by root

**Solution:** Automatic! System fixes this before each deployment. If persists:

```bash
# Manual fix on VPS
sudo chown -R $(whoami):$(whoami) $(npm config get cache)
```

### Deployment Succeeds but Application Crashes

**Problem:** Missing health check in pipeline

**Solution:** Add health check step:

```json
{
  "Name": "Health Check",
  "Run": [
    "sleep 5",
    "curl -f http://localhost:3000/health || exit 1"
  ]
}
```

### "Pipeline is empty - no steps to execute"

**Warning only.** System will use `PublishDeploymentToTarget` (not recommended).

**Solution:** Define a proper pipeline.

---

## Complete Example

See `examples/projects/Client-Enterprise-Server-FIXED.json` for a complete, production-ready configuration.

### Key Features

- ✅ TypeScript build
- ✅ Database migrations
- ✅ Zero downtime deployment
- ✅ Automatic rollback
- ✅ Health checks
- ✅ Discord notifications

---

## Best Practices

1. **Always define a Pipeline** - Don't rely on legacy `PublishDeploymentToTarget`
2. **Use health checks** - Verify application is running after deployment
3. **Backup before deploying** - Even with rollback, backups are essential
4. **Test migrations** - Run migrations in staging first
5. **Monitor deployments** - Check Discord notifications and PM2 logs
6. **Keep variables organized** - Group related variables together
7. **Document custom variables** - Add comments in your pipeline config

---

## Production Checklist

Before deploying to production:

- [ ] Pipeline defined with at least 5 steps
- [ ] Health check step included
- [ ] Backup step included
- [ ] `rsync` with `--exclude` for protected files
- [ ] PM2 process name correctly configured
- [ ] Discord webhook configured
- [ ] SSH key added (if private repository)
- [ ] Test deployment in staging environment
- [ ] Rollback tested manually
- [ ] Monitoring configured (PM2, logs)

---

## Next Steps

1. Review example pipelines in `examples/pipelines/`
2. Review example projects in `examples/projects/`
3. Read variables guide in `examples/projects/VARIABLES_GUIDE.md`
4. Configure your first project
5. Test deployment in staging
6. Deploy to production! 🚀

---

**Need Help?**

- Read the [Variables Guide](examples/projects/VARIABLES_GUIDE.md)
- Check [Example Pipelines](examples/pipelines/)
- Review [Example Projects](examples/projects/)
- Open an issue on GitHub
