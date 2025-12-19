# Safe Deployment Strategies in Deploy Center

## 🎯 Goal: Complete GitHub Actions Alternative

Requirements:

- ✅ Zero downtime
- ✅ Fast and safe rollback
- ✅ Preserve existing files (uploads, logs, .env)
- ✅ Build in isolated directory
- ✅ Atomic deployment (all or nothing)

---

## 🚨 Current Problem in `PublishDeploymentToTarget`

```typescript
// In DeploymentService.ts:667-673
if (targetExisted) {
  await fs.remove(targetPath);  // 🔥 Removes everything!
}
await fs.move(sourceDir, targetPath);
```

### Issues

1. ❌ Deletes `uploads/`, `logs/`, `node_modules/`
2. ❌ No rollback mechanism
3. ❌ If `fs.move()` fails, project is dead!
4. ❌ Downtime during copy

---

## ✅ Solution #1: Pipeline-Based Deployment (Current - Enhanced)

**Concept:** Pipeline controls everything, PublishDeploymentToTarget only for emergency fallback

### Example: Node.js Backend with PM2

```json
{
  "Config": {
    "Variables": {
      "PM2ProcessName": "my-app",
      "BuildCommand": "npm run build",
      "BuildOutput": "dist"
    },
    "Pipeline": [
      {
        "Name": "Install Dependencies",
        "Run": [
          "cd {{WorkingDirectory}}",
          "npm ci --force"
        ]
      },
      {
        "Name": "Build TypeScript",
        "Run": [
          "cd {{WorkingDirectory}}",
          "{{BuildCommand}}"
        ]
      },
      {
        "Name": "Sync Built Files Only",
        "Run": [
          "rsync -av --delete {{WorkingDirectory}}/{{BuildOutput}}/ {{TargetPath}}/{{BuildOutput}}/"
        ]
      },
      {
        "Name": "Sync package files",
        "Run": [
          "rsync -av {{WorkingDirectory}}/package.json {{TargetPath}}/",
          "rsync -av {{WorkingDirectory}}/package-lock.json {{TargetPath}}/"
        ]
      },
      {
        "Name": "Install Production Dependencies",
        "Run": [
          "cd {{TargetPath}}",
          "npm ci --production --force"
        ]
      },
      {
        "Name": "Restart PM2 (Zero Downtime)",
        "Run": [
          "pm2 reload {{PM2ProcessName}} --update-env"
        ]
      },
      {
        "Name": "Health Check",
        "Run": [
          "sleep 3",
          "pm2 describe {{PM2ProcessName}} | grep -q 'online'"
        ]
      }
    ]
  }
}
```

### Advantages

- ✅ Syncs only `dist/` (preserves `uploads/`)
- ✅ `rsync` is smart (copies only changes)
- ✅ `pm2 reload` = zero downtime
- ✅ Health check for verification

### Disadvantages

- ⚠️ No automatic rollback
- ⚠️ If it fails mid-process, project may be in unstable state

---

## ✅ Solution #2: Blue-Green Deployment (Recommended for Enterprise)

**Concept:** Two versions of the project exist, activate new one only on success

### Structure

```
/www/wwwroot/my-app/
├── current -> releases/release-42/   (symlink)
├── previous -> releases/release-41/  (symlink for rollback)
├── releases/
│   ├── release-41/
│   ├── release-42/
│   └── release-43/
├── shared/
│   ├── uploads/
│   ├── logs/
│   ├── .env
│   └── node_modules/  (optional)
└── tmp/
```

### Pipeline Example

```json
{
  "Config": {
    "Variables": {
      "PM2ProcessName": "my-app",
      "BuildCommand": "npm run build",
      "BuildOutput": "dist",
      "ReleasesPath": "/www/wwwroot/my-app/releases",
      "SharedPath": "/www/wwwroot/my-app/shared",
      "CurrentLink": "/www/wwwroot/my-app/current"
    },
    "Pipeline": [
      {
        "Name": "Create Release Directory",
        "Run": [
          "mkdir -p {{ReleasesPath}}/release-{{DeploymentId}}"
        ]
      },
      {
        "Name": "Install Dependencies",
        "Run": [
          "cd {{WorkingDirectory}}",
          "npm ci --force"
        ]
      },
      {
        "Name": "Build",
        "Run": [
          "cd {{WorkingDirectory}}",
          "{{BuildCommand}}"
        ]
      },
      {
        "Name": "Copy Built Files to Release",
        "Run": [
          "rsync -av {{WorkingDirectory}}/{{BuildOutput}}/ {{ReleasesPath}}/release-{{DeploymentId}}/{{BuildOutput}}/",
          "rsync -av {{WorkingDirectory}}/package.json {{ReleasesPath}}/release-{{DeploymentId}}/",
          "rsync -av {{WorkingDirectory}}/package-lock.json {{ReleasesPath}}/release-{{DeploymentId}}/"
        ]
      },
      {
        "Name": "Create Symlinks to Shared",
        "Run": [
          "ln -sfn {{SharedPath}}/uploads {{ReleasesPath}}/release-{{DeploymentId}}/uploads",
          "ln -sfn {{SharedPath}}/logs {{ReleasesPath}}/release-{{DeploymentId}}/logs",
          "ln -sfn {{SharedPath}}/.env {{ReleasesPath}}/release-{{DeploymentId}}/.env",
          "ln -sfn {{SharedPath}}/node_modules {{ReleasesPath}}/release-{{DeploymentId}}/node_modules"
        ]
      },
      {
        "Name": "Install Production Dependencies",
        "Run": [
          "cd {{SharedPath}}",
          "npm ci --production --force"
        ]
      },
      {
        "Name": "Run Migrations",
        "RunIf": "hasVar('MigrateCommand')",
        "Run": [
          "cd {{ReleasesPath}}/release-{{DeploymentId}}",
          "{{MigrateCommand}}"
        ]
      },
      {
        "Name": "Update PM2 Config",
        "Run": [
          "cd {{ReleasesPath}}/release-{{DeploymentId}}",
          "pm2 delete {{PM2ProcessName}} || true",
          "pm2 start {{BuildOutput}}/index.js --name {{PM2ProcessName}} --cwd {{ReleasesPath}}/release-{{DeploymentId}}"
        ]
      },
      {
        "Name": "Health Check",
        "Run": [
          "sleep 5",
          "pm2 describe {{PM2ProcessName}} | grep -q 'online'"
        ]
      },
      {
        "Name": "Atomic Swap: Update current symlink",
        "Run": [
          "ln -sfn $(readlink {{CurrentLink}}) /www/wwwroot/my-app/previous",
          "ln -sfn {{ReleasesPath}}/release-{{DeploymentId}} {{CurrentLink}}"
        ]
      },
      {
        "Name": "Cleanup Old Releases (keep last 5)",
        "Run": [
          "cd {{ReleasesPath}}",
          "ls -t | tail -n +6 | xargs -r rm -rf"
        ]
      }
    ]
  }
}
```

### Advantages

- ✅ Zero downtime (atomic symlink switch)
- ✅ Fast rollback: `ln -sfn previous current && pm2 reload`
- ✅ `uploads/`, `logs/`, `.env` preserved in `shared/`
- ✅ Keeps last 5 releases for rollback

### Disadvantages

- ⚠️ More complex setup
- ⚠️ Requires more disk space

---

## ✅ Solution #3: Rsync Smart Deployment (Simplest + Safe)

**Concept:** Use `rsync` without `--delete` + exclude important files

### Pipeline Example

```json
{
  "Config": {
    "Variables": {
      "PM2ProcessName": "my-app",
      "BuildCommand": "npm run build",
      "BuildOutput": "dist"
    },
    "Pipeline": [
      {
        "Name": "Install Dependencies",
        "Run": [
          "cd {{WorkingDirectory}}",
          "npm ci --force"
        ]
      },
      {
        "Name": "Build",
        "Run": [
          "cd {{WorkingDirectory}}",
          "{{BuildCommand}}"
        ]
      },
      {
        "Name": "Backup Current Release",
        "Run": [
          "[ -d {{TargetPath}}/{{BuildOutput}} ] && cp -r {{TargetPath}}/{{BuildOutput}} {{TargetPath}}/{{BuildOutput}}.backup.{{DeploymentId}} || true"
        ]
      },
      {
        "Name": "Sync Built Files (Smart)",
        "Run": [
          "rsync -av --exclude='uploads' --exclude='logs' --exclude='.env' --exclude='node_modules' --exclude='.git' --delete-after {{WorkingDirectory}}/{{BuildOutput}}/ {{TargetPath}}/{{BuildOutput}}/"
        ]
      },
      {
        "Name": "Sync package files",
        "Run": [
          "rsync -av {{WorkingDirectory}}/package.json {{TargetPath}}/",
          "rsync -av {{WorkingDirectory}}/package-lock.json {{TargetPath}}/"
        ]
      },
      {
        "Name": "Install Production Dependencies",
        "Run": [
          "cd {{TargetPath}}",
          "npm ci --production --force"
        ]
      },
      {
        "Name": "Test New Build",
        "Run": [
          "cd {{TargetPath}}",
          "node {{BuildOutput}}/index.js --test || exit 1"
        ]
      },
      {
        "Name": "Reload PM2",
        "Run": [
          "pm2 reload {{PM2ProcessName}} --update-env"
        ]
      },
      {
        "Name": "Health Check",
        "Run": [
          "sleep 5",
          "pm2 describe {{PM2ProcessName}} | grep -q 'online' || (echo 'Rollback triggered' && cp -r {{TargetPath}}/{{BuildOutput}}.backup.{{DeploymentId}} {{TargetPath}}/{{BuildOutput}} && pm2 reload {{PM2ProcessName}} && exit 1)"
        ]
      },
      {
        "Name": "Cleanup Backup",
        "Run": [
          "rm -rf {{TargetPath}}/{{BuildOutput}}.backup.{{DeploymentId}}"
        ]
      }
    ]
  }
}
```

### Advantages

- ✅ `--exclude` protects important files
- ✅ Automatic backup before deployment
- ✅ Automatic rollback on health check failure
- ✅ Simple and straightforward

### Disadvantages

- ⚠️ Rollback in health check may be slow

---

## 🎯 Final Recommendation

**For Simple/Medium Projects:**

- Use **Solution #3** (Rsync Smart Deployment)
- With complete Pipeline as in the example

**For Enterprise Projects:**

- Use **Solution #2** (Blue-Green Deployment)
- With separate Rollback Service

---

## 🛠️ Required Code Modification

### Option A: Disable `PublishDeploymentToTarget` Completely

**In `DeploymentService.ts:311-313`:**

```typescript
// Only publish if Pipeline is empty (fallback mode)
if (deploymentSucceeded && workingDir && (!project.Config.Pipeline || project.Config.Pipeline.length === 0)) {
  await this.PublishDeploymentToTarget(projectRecord, deployment, workingDir);
}
```

**Benefit:**

- ✅ If Pipeline exists = ignores `PublishDeploymentToTarget`
- ✅ If Pipeline empty = uses `PublishDeploymentToTarget` (backward compatibility)

---

### Option B: Improve `PublishDeploymentToTarget` Itself

**Replace lines 667-673:**

```typescript
// OLD (Dangerous):
if (targetExisted) {
  await fs.remove(targetPath);  // 🔥
}
await fs.move(sourceDir, targetPath);

// NEW (Safe):
if (targetExisted) {
  // Backup current to timestamped folder
  const backupPath = `${targetPath}.backup.${Date.now()}`;
  await fs.move(targetPath, backupPath);

  try {
    await fs.move(sourceDir, targetPath);
    // Success - remove backup
    await fs.remove(backupPath);
  } catch (error) {
    // Rollback
    await fs.move(backupPath, targetPath);
    throw error;
  }
} else {
  await fs.move(sourceDir, targetPath);
}
```

---

## 📋 Implementation Plan

1. ✅ **Now:** Use complete Pipeline (Solution #3) in all projects
2. ⏭️ **Next:** Modify `PublishDeploymentToTarget` for Option A (disable when Pipeline exists)
3. 🚀 **Future:** Add separate Rollback Service in Dashboard

---

## 🎬 Final Usage Example

```json
{
  "Name": "Client-Enterprise-Server",
  "ProjectPath": "/www/wwwroot/Node/Crm/Nova/Tadween/Server",
  "Config": {
    "Variables": {
      "PM2ProcessName": "client-enterprise-server",
      "BuildCommand": "npm run build",
      "BuildOutput": "dist"
    },
    "Pipeline": [
      { "Name": "Install", "Run": ["cd {{WorkingDirectory}} && npm ci --force"] },
      { "Name": "Build", "Run": ["cd {{WorkingDirectory}} && {{BuildCommand}}"] },
      { "Name": "Backup", "Run": ["[ -d {{TargetPath}}/{{BuildOutput}} ] && cp -r {{TargetPath}}/{{BuildOutput}} /tmp/backup-{{DeploymentId}} || true"] },
      { "Name": "Sync", "Run": ["rsync -av --exclude='uploads' --exclude='logs' --exclude='.env' --exclude='node_modules' --delete-after {{WorkingDirectory}}/{{BuildOutput}}/ {{TargetPath}}/{{BuildOutput}}/"] },
      { "Name": "Deps", "Run": ["cd {{TargetPath}} && npm ci --production --force"] },
      { "Name": "Reload", "Run": ["pm2 reload {{PM2ProcessName}}"] },
      { "Name": "Health", "Run": ["sleep 5 && pm2 describe {{PM2ProcessName}} | grep -q 'online'"] }
    ]
  }
}
```

**Result:**

- ✅ Build in temporary directory
- ✅ Automatic backup
- ✅ Syncs only `dist/`
- ✅ Preserves `uploads/`, `logs/`, `.env`
- ✅ Zero downtime with `pm2 reload`
- ✅ Health check for verification
- ✅ **Complete GitHub Actions Alternative!**
