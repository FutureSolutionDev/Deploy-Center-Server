# Understanding Deployment Logs

Learn how to read and interpret deployment logs to troubleshoot issues and understand what's happening during your deployments.

## Table of Contents

- [Accessing Deployment Logs](#accessing-deployment-logs)
- [Log Structure](#log-structure)
- [Deployment Phases](#deployment-phases)
- [Reading Log Messages](#reading-log-messages)
- [Common Log Patterns](#common-log-patterns)
- [Troubleshooting with Logs](#troubleshooting-with-logs)
- [Log Retention](#log-retention)

---

## Accessing Deployment Logs

### Real-Time Logs (During Deployment)

**Method 1: Deployment Details Page**
1. Go to **Deployments** page
2. Click on a running deployment
3. View live logs as they stream

**Method 2: Project Page**
1. Go to **Projects**
2. Click on your project
3. View latest deployment in the timeline
4. Click to see logs

### Historical Logs (After Deployment)

1. Go to **Deployments** page
2. Find the deployment in the list
3. Click to view complete logs
4. Logs are preserved even after deployment finishes

---

## Log Structure

Each deployment log follows this structure:

```
[Timestamp] [Level] [Phase] Message
```

### Log Levels

| Level | Color | Meaning |
|-------|-------|---------|
| **INFO** | Blue | Normal operation, informational messages |
| **SUCCESS** | Green | Successful completion of a step |
| **WARN** | Yellow | Warning, might need attention |
| **ERROR** | Red | Error occurred, deployment failed |
| **DEBUG** | Gray | Detailed debugging information |

### Example Log Lines

```
[2026-01-04 10:30:15] [INFO] [CLONE] Cloning repository from https://github.com/user/repo.git
[2026-01-04 10:30:18] [SUCCESS] [CLONE] Repository cloned successfully
[2026-01-04 10:30:18] [INFO] [PIPELINE] Starting pre-deployment pipeline
[2026-01-04 10:30:20] [INFO] [STEP] Running step: Install Dependencies
[2026-01-04 10:30:25] [SUCCESS] [STEP] Step completed successfully
```

---

## Deployment Phases

Deployments go through several phases. Understanding each phase helps you locate issues quickly.

### Phase 1: Initialization

```
[INFO] [INIT] Deployment started for project: MyApp
[INFO] [INIT] Branch: main
[INFO] [INIT] Commit: abc123def
[INFO] [INIT] User: admin
[INFO] [INIT] Deployment paths: /var/www/myapp
```

**What happens:**
- Deployment record created
- Configuration loaded
- Environment variables prepared
- Temporary directory created

**Common issues:**
- Database connection errors
- Invalid configuration

---

### Phase 2: Repository Clone

```
[INFO] [CLONE] Cloning repository from git@github.com:user/repo.git
[INFO] [CLONE] Using branch: main
[INFO] [CLONE] Clone path: /tmp/deployments/deploy-123
[SUCCESS] [CLONE] Repository cloned successfully
```

**What happens:**
- Repository is cloned to temporary directory
- SSH keys are used if configured
- Specific branch is checked out

**Common issues:**
```
[ERROR] [CLONE] Failed to clone repository: Authentication failed
[ERROR] [CLONE] Repository not found
[ERROR] [CLONE] Permission denied (publickey)
```

**Solutions:**
- Check repository URL
- Verify SSH keys are configured
- Ensure deploy key has access

---

### Phase 3: Pre-Deployment Pipeline

```
[INFO] [PIPELINE] Starting pre-deployment pipeline
[INFO] [PIPELINE] Found 3 pipeline steps
[INFO] [STEP] Running step 1/3: Install Dependencies
[DEBUG] [STEP] Command: npm ci
[INFO] [STEP] npm ci output...
[SUCCESS] [STEP] Step 1/3 completed successfully
```

**What happens:**
- Each pipeline step runs in sequence
- Commands execute in the cloned repository
- Output is captured and logged

**Common issues:**
```
[ERROR] [STEP] Step failed: Install Dependencies
[ERROR] [STEP] npm ERR! 404 Not Found
[ERROR] [STEP] Exit code: 1
```

**Indicates:**
- Build failure
- Missing dependencies
- Incorrect commands

---

### Phase 4: File Synchronization (Rsync)

```
[INFO] [SYNC] Starting file synchronization
[INFO] [SYNC] Source: /tmp/deployments/deploy-123/build
[INFO] [SYNC] Destination: /var/www/myapp
[INFO] [SYNC] Syncing files...
[DEBUG] [SYNC] rsync -av --delete /tmp/deployments/deploy-123/build/ /var/www/myapp/
[SUCCESS] [SYNC] Files synced successfully
[INFO] [SYNC] Synced 1,234 files (45.2 MB)
```

**What happens:**
- Files are copied from temporary directory to production
- Old files may be deleted (if using --delete)
- Permissions are set

**Common issues:**
```
[ERROR] [SYNC] Permission denied: /var/www/myapp
[ERROR] [SYNC] Destination path does not exist
[ERROR] [SYNC] Disk space full
```

**Solutions:**
- Check directory permissions
- Verify deployment path exists
- Free up disk space

---

### Phase 5: Post-Deployment Pipeline

```
[INFO] [POST-PIPELINE] Starting post-deployment pipeline
[INFO] [POST-PIPELINE] Backup created: /tmp/deployments/_backups/backup-123
[INFO] [STEP] Running step 1/2: Restart Application
[DEBUG] [STEP] Command: pm2 restart myapp
[INFO] [STEP] [PM2] Applying action restartProcessId on app [myapp]
[SUCCESS] [STEP] Step 1/2 completed successfully
```

**What happens:**
- Backup is created (if rollback enabled)
- Commands run in production directory
- Services are restarted

**Common issues:**
```
[ERROR] [STEP] Step failed: Restart Application
[ERROR] [STEP] pm2: command not found
[ERROR] [ROLLBACK] Rolling back to previous version
```

**Indicates:**
- Service restart failed
- Missing commands or permissions
- Automatic rollback triggered

---

### Phase 6: Cleanup

```
[INFO] [CLEANUP] Cleaning up temporary files
[INFO] [CLEANUP] Removing: /tmp/deployments/deploy-123
[INFO] [CLEANUP] Removing backup: /tmp/deployments/_backups/backup-123
[SUCCESS] [CLEANUP] Cleanup completed
```

**What happens:**
- Temporary files are deleted
- Backups are removed (if deployment succeeded)
- Resources are freed

---

### Phase 7: Completion

```
[SUCCESS] [COMPLETE] Deployment completed successfully
[INFO] [COMPLETE] Duration: 2m 34s
[INFO] [COMPLETE] Status: SUCCESS
```

**What happens:**
- Deployment status is updated
- Notifications are sent
- Deployment record is finalized

---

## Reading Log Messages

### Successful Deployment Example

```
[2026-01-04 10:30:00] [INFO] [INIT] Deployment started for project: MyApp
[2026-01-04 10:30:01] [INFO] [CLONE] Cloning repository...
[2026-01-04 10:30:05] [SUCCESS] [CLONE] Repository cloned
[2026-01-04 10:30:05] [INFO] [PIPELINE] Starting pipeline (3 steps)
[2026-01-04 10:30:06] [INFO] [STEP] Step 1/3: Install Dependencies
[2026-01-04 10:30:45] [SUCCESS] [STEP] Dependencies installed
[2026-01-04 10:30:45] [INFO] [STEP] Step 2/3: Run Tests
[2026-01-04 10:31:15] [SUCCESS] [STEP] All tests passed
[2026-01-04 10:31:15] [INFO] [STEP] Step 3/3: Build Application
[2026-01-04 10:32:00] [SUCCESS] [STEP] Build completed
[2026-01-04 10:32:00] [INFO] [SYNC] Syncing files to /var/www/myapp
[2026-01-04 10:32:15] [SUCCESS] [SYNC] Files synced (1,234 files)
[2026-01-04 10:32:15] [INFO] [POST-PIPELINE] Starting post-deployment
[2026-01-04 10:32:16] [INFO] [STEP] Step 1/1: Restart PM2
[2026-01-04 10:32:18] [SUCCESS] [STEP] Application restarted
[2026-01-04 10:32:18] [SUCCESS] [COMPLETE] Deployment successful (2m 18s)
```

**Key indicators of success:**
- ✅ All steps show `[SUCCESS]`
- ✅ No `[ERROR]` messages
- ✅ Ends with `[SUCCESS] [COMPLETE]`

---

### Failed Deployment Example

```
[2026-01-04 10:35:00] [INFO] [INIT] Deployment started for project: MyApp
[2026-01-04 10:35:01] [INFO] [CLONE] Cloning repository...
[2026-01-04 10:35:05] [SUCCESS] [CLONE] Repository cloned
[2026-01-04 10:35:05] [INFO] [PIPELINE] Starting pipeline (2 steps)
[2026-01-04 10:35:06] [INFO] [STEP] Step 1/2: Install Dependencies
[2026-01-04 10:35:10] [ERROR] [STEP] npm ERR! code E404
[2026-01-04 10:35:10] [ERROR] [STEP] npm ERR! 404 Not Found - GET https://registry.npmjs.org/invalid-package
[2026-01-04 10:35:10] [ERROR] [STEP] Exit code: 1
[2026-01-04 10:35:10] [ERROR] [PIPELINE] Pipeline failed at step 1/2
[2026-01-04 10:35:10] [ERROR] [COMPLETE] Deployment failed (10s)
```

**Key indicators of failure:**
- ❌ `[ERROR]` messages present
- ❌ Exit code non-zero
- ❌ Pipeline stopped early
- ❌ Ends with `[ERROR] [COMPLETE]`

---

## Common Log Patterns

### Pattern 1: Package Not Found

```
[ERROR] [STEP] npm ERR! 404 Not Found - GET https://registry.npmjs.org/package-name
```

**Cause:** Package doesn't exist or typo in package.json

**Solution:**
- Check package name spelling
- Verify package exists on npm
- Check package.json for typos

---

### Pattern 2: Permission Denied

```
[ERROR] [SYNC] rsync: send_files failed to open "file.txt": Permission denied (13)
[ERROR] [SYNC] rsync error: some files/attrs were not transferred
```

**Cause:** Deploy user doesn't have write permissions

**Solution:**
```bash
sudo chown -R deploy-user:deploy-user /var/www/myapp
sudo chmod -R 755 /var/www/myapp
```

---

### Pattern 3: Command Not Found

```
[ERROR] [STEP] /bin/sh: pm2: command not found
[ERROR] [STEP] Exit code: 127
```

**Cause:** Command not in PATH or not installed

**Solution:**
- Install missing command
- Use full path: `/usr/bin/pm2 restart app`
- Add to PATH: `export PATH="$PATH:/usr/local/bin"`

---

### Pattern 4: Port Already in Use

```
[ERROR] [STEP] Error: listen EADDRINUSE: address already in use :::3000
```

**Cause:** Another process is using the port

**Solution:**
- Stop the conflicting process
- Use a different port
- Check what's using the port: `lsof -i :3000`

---

### Pattern 5: Out of Memory

```
[ERROR] [STEP] FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Cause:** Build process uses too much memory

**Solution:**
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
- Add to pipeline environment variables
- Upgrade server RAM

---

### Pattern 6: Build Timeout

```
[ERROR] [STEP] Build exceeded maximum time limit (10 minutes)
[ERROR] [STEP] Process killed
```

**Cause:** Build takes too long

**Solution:**
- Optimize build process
- Increase timeout in settings
- Use build cache
- Pre-build dependencies

---

## Troubleshooting with Logs

### Step-by-Step Debugging

1. **Find the first ERROR message**
   ```
   [ERROR] [STEP] npm ERR! code E404
   ```

2. **Read surrounding context**
   - What step was running?
   - What command failed?
   - What was the exit code?

3. **Look for the root cause**
   - Often appears a few lines before the ERROR
   - Check for warnings that preceded the error

4. **Reproduce locally**
   - Run the same command on your machine
   - Use the same Node.js version
   - Check if it works locally

5. **Fix and retry**
   - Update code or configuration
   - Trigger new deployment
   - Watch logs for success

---

### Using Log Filters

**Search for specific errors:**
- Search for `[ERROR]` to find all errors
- Search for `[WARN]` to find warnings
- Search for specific command names

**Focus on specific phases:**
- Search for `[CLONE]` for repository issues
- Search for `[SYNC]` for file sync issues
- Search for `[STEP]` for pipeline issues

---

## Log Retention

### How Long Are Logs Kept?

By default, deployment logs are kept indefinitely. However, you may want to clean up old logs to save database space.

### Manual Cleanup

```sql
-- Delete deployments older than 90 days
DELETE FROM Deployments
WHERE CreatedAt < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Keep only last 100 deployments per project
DELETE d1 FROM Deployments d1
INNER JOIN (
  SELECT Id FROM (
    SELECT Id FROM Deployments
    WHERE ProjectId = 123
    ORDER BY CreatedAt DESC
    LIMIT 100, 99999999
  ) AS t
) d2 ON d1.Id = d2.Id;
```

### Best Practices

1. **Keep recent logs:** At least 30 days
2. **Archive important logs:** Before deletion
3. **Export failed deployments:** For analysis
4. **Monitor log size:** Set up alerts for large logs

---

## Pro Tips

### Tip 1: Compare Failed and Successful Deployments

Open two browser tabs:
- Tab 1: Failed deployment logs
- Tab 2: Last successful deployment logs
- Compare to find what changed

### Tip 2: Copy Logs for Support

When asking for help:
1. Copy the complete log
2. Include the error section
3. Include the few lines before the error
4. Mention your environment (Node version, OS, etc.)

### Tip 3: Monitor Build Times

Track how long each step takes:
```
[INFO] [STEP] Step 1/3: Install Dependencies
... (40 seconds)
[SUCCESS] [STEP] Step completed in 40s

[INFO] [STEP] Step 2/3: Build Application
... (2 minutes)
[SUCCESS] [STEP] Step completed in 2m 5s
```

If times increase significantly, investigate why.

### Tip 4: Use DEBUG Level for Deep Troubleshooting

Set log level to DEBUG in settings to see:
- Exact commands being run
- Environment variables (sanitized)
- File paths and operations
- Detailed rsync output

---

## Example: Full Deployment Log Analysis

```
[10:30:00] [INFO] [INIT] Deployment #456 started
[10:30:00] [INFO] [INIT] Project: MyApp (Node.js)
[10:30:00] [INFO] [INIT] Branch: main @ commit abc123
[10:30:00] [INFO] [INIT] Environment: production
[10:30:00] [INFO] [INIT] Deployment paths: /var/www/myapp

✅ Initialization successful (1s)

[10:30:01] [INFO] [CLONE] Cloning from git@github.com:user/myapp.git
[10:30:04] [SUCCESS] [CLONE] Cloned to /tmp/deployments/deploy-456

✅ Clone successful (3s)

[10:30:04] [INFO] [PIPELINE] Pre-deployment pipeline (3 steps)
[10:30:05] [INFO] [STEP] Step 1/3: Install Dependencies
[10:30:05] [DEBUG] [STEP] $ npm ci
[10:30:45] [INFO] [STEP] added 1,234 packages in 40s
[10:30:45] [SUCCESS] [STEP] Completed in 40s

✅ Dependencies installed (40s)

[10:30:45] [INFO] [STEP] Step 2/3: Run Tests
[10:30:46] [DEBUG] [STEP] $ npm test
[10:31:15] [INFO] [STEP] PASS src/app.test.ts
[10:31:15] [INFO] [STEP] Test Suites: 15 passed, 15 total
[10:31:15] [SUCCESS] [STEP] Completed in 29s

✅ Tests passed (29s)

[10:31:15] [INFO] [STEP] Step 3/3: Build Application
[10:31:16] [DEBUG] [STEP] $ npm run build
[10:32:00] [INFO] [STEP] Creating optimized production build...
[10:32:00] [INFO] [STEP] Compiled successfully.
[10:32:00] [SUCCESS] [STEP] Completed in 44s

✅ Build successful (44s)

[10:32:00] [INFO] [SYNC] Syncing /tmp/.../build → /var/www/myapp
[10:32:15] [INFO] [SYNC] Transferred: 1,234 files (45.2 MB)
[10:32:15] [SUCCESS] [SYNC] Sync completed in 15s

✅ Files synced (15s)

[10:32:15] [INFO] [POST-PIPELINE] Post-deployment pipeline (1 step)
[10:32:15] [INFO] [POST-PIPELINE] Backup created (for rollback)
[10:32:16] [INFO] [STEP] Step 1/1: Restart Application
[10:32:16] [DEBUG] [STEP] $ pm2 restart myapp
[10:32:18] [INFO] [STEP] [PM2] Applying action restartProcessId on app [myapp]
[10:32:18] [INFO] [STEP] [PM2] [myapp](0) ✓
[10:32:18] [SUCCESS] [STEP] Completed in 2s

✅ Application restarted (2s)

[10:32:18] [INFO] [CLEANUP] Removing temporary files
[10:32:18] [INFO] [CLEANUP] Removing backup (deployment succeeded)
[10:32:18] [SUCCESS] [CLEANUP] Cleanup completed

✅ Cleanup done (0s)

[10:32:18] [SUCCESS] [COMPLETE] Deployment completed successfully
[10:32:18] [INFO] [COMPLETE] Total duration: 2m 18s
```

**Summary:**
- ✅ Clone: 3s
- ✅ Install: 40s
- ✅ Test: 29s
- ✅ Build: 44s
- ✅ Sync: 15s
- ✅ Restart: 2s
- ✅ **Total: 2m 18s**

---

## Need Help?

If you're still stuck after reviewing the logs:

1. **Copy the error section** of the logs
2. **Include the few lines before** the error
3. **Check the [FAQ](../FAQ.md)** for common issues
4. **Search GitHub Issues** for similar problems
5. **Ask in Discussions** with your logs

---

**Remember:** Logs are your best friend for debugging! Always read them carefully, and don't be afraid to search for error messages online.

---

*Last updated: January 2026*
