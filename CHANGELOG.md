# Changelog - Deploy Center Server

## [2.1.0] - 2024-12-18

### 🚀 Major Features

#### Safe Pipeline-Based Deployment System

- **Breaking Change:** `PublishDeploymentToTarget` now **disabled by default** when Pipeline exists
- Pipeline-based deployment is now the primary deployment method
- Legacy `PublishDeploymentToTarget` only used when Pipeline is empty (backward compatibility)

#### Auto-Recovery System

- **New:** `AutoRecovery` utility class with intelligent retry mechanism
- **Auto-fix:** npm cache permissions (EACCES errors)
- **Auto-cleanup:** Disk space management (removes old deployments)
- **Auto-kill:** Stuck processes detection and cleanup
- **Auto-retry:** Exponential backoff for transient failures

#### Complete Variable System

- Automatic variables available in all pipelines without configuration
- Custom variables support via `Config.Variables`
- Variable replacement in all pipeline commands
- Comprehensive documentation and examples

### ✅ Bug Fixes

#### Critical: PublishDeploymentToTarget Safety

**Problem:** `PublishDeploymentToTarget` was deleting entire target directory, including:

- User uploads (`uploads/`)
- Application logs (`logs/`)
- Environment variables (`.env`)
- Dependencies (`node_modules/`)
- Custom configuration files

**Solution:**

```typescript
// Now checks if Pipeline exists
const hasPipeline = projectRecord.Config.Pipeline && projectRecord.Config.Pipeline.length > 0;

if (deploymentSucceeded && workingDir && !hasPipeline) {
  // Legacy mode (backward compatibility)
  Logger.Warn('Using legacy PublishDeploymentToTarget');
  await this.PublishDeploymentToTarget(...);
} else if (deploymentSucceeded && workingDir && hasPipeline) {
  // Pipeline mode: Just cleanup temp directory
  await this.CleanupWorkingDirectory(...);
}
```

**Impact:** Prevents catastrophic data loss in production deployments

#### npm Permission Errors (EACCES)

**Problem:** npm cache owned by root causing deployment failures on VPS

**Solution:**

```typescript
// Automatically runs before each deployment
await AutoRecovery.FixNpmCachePermissions();
```

**Features:**

- Auto-detects npm cache directory
- Multi-strategy fix: chown → sudo → chmod → cache clean
- Integrated into retry logic
- No manual intervention required

### 📚 Documentation

#### New Files

- `DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `examples/projects/VARIABLES_GUIDE.md` - Variables reference
- `examples/projects/CORRECT_VS_WRONG_VARIABLES.md` - Common mistakes
- `examples/pipelines/nodejs-backend-safe-deployment.json` - Production-ready pipeline
- `examples/projects/Client-Enterprise-Server-FIXED.json` - Complete example

#### Updated Files

- `server/src/Services/DeploymentService.ts` - Pipeline safety logic
- `server/src/Utils/AutoRecovery.ts` - New utility class

### 🔧 Technical Changes

#### DeploymentService.ts

**Lines 310-367:** Pipeline safety check

```typescript
// SAFETY: Only use PublishDeploymentToTarget if Pipeline is empty
const hasPipeline = projectRecord.Config.Pipeline && projectRecord.Config.Pipeline.length > 0;
```

**Benefits:**

- ✅ With Pipeline → Safe deployment with `rsync --exclude`
- ⚠️ Without Pipeline → Legacy mode with warning

#### AutoRecovery.ts (New)

**Features:**

- `RetryOperation<T>()` - Intelligent retry with exponential backoff
- `FixNpmCachePermissions()` - Automatic npm permission fix
- `CheckAndCleanupDiskSpace()` - Disk space management
- `KillStuckProcesses()` - Process cleanup
- `RepairGitRepository()` - Git repository repair
- `ValidateSshKeyHealth()` - SSH key validation

### 📊 Improvements

#### Deployment Safety

| Feature                | Before ❌ | After ✅                        |
| ---------------------- | --------- | ------------------------------- |
| **Build Location**     | Production| Temporary directory             |
| **File Protection**    | None      | `rsync --exclude`               |
| **Rollback**           | Manual    | Automatic on health check fail  |
| **Downtime**           | Yes       | Zero with PM2 reload            |
| **Health Check**       | None      | Configurable                    |
| **npm Errors**         | Manual fix| Auto-recovery                   |
| **Disk Space**         | Ignored   | Auto-cleanup                    |

#### Developer Experience

- ✅ Clear error messages for missing variables
- ✅ Warning when using legacy mode
- ✅ Comprehensive examples for all project types
- ✅ Step-by-step deployment guide
- ✅ Troubleshooting section

### 🎯 Migration Guide

#### For Existing Projects

**If you have an empty Pipeline (`Pipeline: []`):**

1. Add a complete pipeline using examples
2. Define required variables in `Config.Variables`
3. Test in staging environment
4. Deploy to production

**Minimal Pipeline:**

```json
{
  "Variables": {
    "PM2ProcessName": "my-app",
    "BuildCommand": "npm run build",
    "BuildOutput": "dist"
  },
  "Pipeline": [
    { "Name": "Install", "Run": ["cd {{WorkingDirectory}} && npm ci"] },
    { "Name": "Build", "Run": ["{{BuildCommand}}"] },
    { "Name": "Sync", "Run": ["rsync -av --exclude='uploads' --exclude='logs' --exclude='.env' --delete-after {{WorkingDirectory}}/{{BuildOutput}}/ {{TargetPath}}/{{BuildOutput}}/"] },
    { "Name": "Deps", "Run": ["cd {{TargetPath}} && npm ci --production"] },
    { "Name": "Reload", "Run": ["pm2 reload {{PM2ProcessName}}"] }
  ]
}
```

#### For New Projects

Use complete example from `examples/projects/Client-Enterprise-Server-FIXED.json`

### ⚠️ Breaking Changes

**`PublishDeploymentToTarget` Behavior:**

- **Old:** Always runs, deletes entire target directory
- **New:** Only runs when Pipeline is empty, logs warning

**Impact:** Low - Projects with empty Pipeline will see warning but continue working

**Recommendation:** Migrate to Pipeline-based deployment

### 🐛 Known Issues

None

### 📈 Performance

- **Build Time:** No change (builds still in temporary directory)
- **Deployment Time:** Improved with `rsync` (only syncs changes)
- **Disk Usage:** Reduced with automatic cleanup
- **Memory Usage:** No change

### 🔮 Future Enhancements

- Web-based rollback UI
- Deployment history tracking
- Multi-server support
- Deployment queue visualization
- Advanced health check options
- Slack/Telegram notifications

---

## [2.0.0] - Previous Version

- Initial release with basic deployment features
- SSH key management
- Discord notifications
- Pipeline execution
- Queue system

---

## How to Update

```bash
# Pull latest changes
git pull origin main

# Install dependencies
cd server
npm install

# Build
npm run build

# Restart
pm2 restart deploy-center-server
```

---

## Support

- **Documentation:** `DEPLOYMENT_GUIDE.md`
- **Examples:** `examples/` directory
- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
