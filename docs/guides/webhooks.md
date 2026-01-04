# Webhook Setup - Configuring GitHub/GitLab Webhooks

This guide shows you how to set up webhooks to automatically trigger deployments when you push code to your repository.

## Table of Contents

1. [Overview](#overview)
2. [How Webhooks Work](#how-webhooks-work)
3. [GitHub Setup](#github-setup)
4. [GitLab Setup](#gitlab-setup)
5. [Webhook Security](#webhook-security)
6. [Troubleshooting](#troubleshooting)

---

## Overview

Webhooks enable **automatic deployments** when you push code to your Git repository. Instead of manually clicking "Deploy" in Deploy Center, the deployment happens automatically.

### Benefits

- ✅ **Continuous Deployment**: Code automatically deployed on push
- ✅ **Faster Releases**: No manual intervention needed
- ✅ **Reduced Errors**: Eliminates forgetting to deploy
- ✅ **Team Efficiency**: Developers push code, deployments happen automatically

### When to Use

**Enable auto-deploy for:**

- Development environments
- Staging environments
- Feature branches
- Continuous integration workflows

**Manual deployments for:**

- Production environments (more control)
- Critical applications
- Scheduled release windows
- Deployments requiring approval

---

## How Webhooks Work

### Webhook Flow

```ascii
┌──────────────┐
│  Developer   │
│  Pushes Code │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  GitHub/GitLab   │
│  Push Event      │
└──────┬───────────┘
       │
       │ HTTP POST with event payload
       │
       ▼
┌──────────────────┐
│  Deploy Center   │
│  Webhook Endpoint│
└──────┬───────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Verify      │  │  Process     │
│  Signature   │  │  Payload     │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
                ▼
       ┌────────────────┐
       │ Check Deploy   │
       │ Conditions     │
       └────────┬───────┘
                │
                ├────────────────┐
                │                │
                ▼                ▼
       ┌────────────┐   ┌────────────┐
       │   Deploy   │   │   Skip     │
       │   Queued   │   │ (ignored)  │
       └────────────┘   └────────────┘
```

### Deploy Center's Webhook Endpoint

Your webhook URL follows this format:

```txt
http://your-server.com:9090/api/webhooks/github/{projectName}
```

**Example:**

```txt
http://deploy.example.com:9090/api/webhooks/github/MyProject
```

**Finding your webhook URL:**

1. Go to your project details page
2. Scroll to "Webhook Configuration" section
3. Copy the displayed webhook URL

---

## GitHub Setup

### Step 1: Get Webhook URL and Secret

1. Open your project in Deploy Center
2. Go to project details page
3. Find "Webhook Configuration" section
4. Copy:
   - **Webhook URL**: `http://...`
   - **Webhook Secret**: `whsec_...`

### Step 2: Create Webhook on GitHub

1. Go to your repository on **GitHub**
2. Click **Settings** → **Webhooks** → **Add webhook**
3. Fill in the form:

**Payload URL:**

```
http://your-server.com:9090/api/webhooks/github/{projectName}
```

**Content type:**

- Select **`application/json`** ✅
- (Not `application/x-www-form-urlencoded`)

**Secret:**

- Paste the webhook secret from Deploy Center
- Example: `whsec_abc123def456...`

**Which events would you like to trigger this webhook?**

- Select **"Just the push event"** ✅
- (Other events are ignored by Deploy Center)

**Active:**

- Check **"Active"** ✅

4. Click **Add webhook**

### Step 3: Test the Webhook

**Option 1: Push Code**

```bash
git add .
git commit -m "Test webhook"
git push origin main
```

**Option 2: Use GitHub's Test Feature**

1. Go to **Settings** → **Webhooks**
2. Click your webhook
3. Scroll down to "Recent Deliveries"
4. Click **"Redeliver"** on a past push event

### Step 4: Verify Deployment

1. Go to Deploy Center dashboard
2. Check "Recent Deployments"
3. You should see a new deployment with:
   - **Triggered By**: webhook
   - **Branch**: main (or your branch)
   - **Commit**: Your latest commit hash

---

## GitLab Setup

### Step 1: Get Webhook URL and Token

1. Open your project in Deploy Center
2. Go to project details page
3. Find "Webhook Configuration" section
4. Copy:
   - **Webhook URL**: `http://...`
   - **Webhook Secret**: `whsec_...`

### Step 2: Create Webhook on GitLab

1. Go to your repository on **GitLab**
2. Navigate to **Settings** → **Webhooks**
3. Fill in the form:

**URL:**

```txt
http://your-server.com:9090/api/webhooks/github/{projectName}
```

**Secret token:**

- Paste the webhook secret from Deploy Center

**Trigger:**

- Check **"Push events"** ✅
- Leave other triggers unchecked

**Branch filter (optional):**

- Leave empty to trigger on all branches
- Or specify branch name (e.g., `main`)

**Enable SSL verification:**

- Uncheck if using self-signed certificates
- Check if using valid SSL

4. Click **Add webhook**

### Step 3: Test the Webhook

**Option 1: Push Code**

```bash
git add .
git commit -m "Test webhook"
git push origin main
```

**Option 2: Use GitLab's Test Feature**

1. Scroll to "Project Hooks" section
2. Find your webhook
3. Click **"Test"** → **"Push events"**

### Step 4: Verify Deployment

Check Deploy Center dashboard for new deployment (same as GitHub step 4).

---

## Webhook Security

Deploy Center uses **HMAC-SHA256 signature verification** to ensure webhooks are authentic.

### How Signature Verification Works

**GitHub/GitLab:**

1. Calculates HMAC-SHA256 of the payload using the secret
2. Sends the signature in the `X-Hub-Signature-256` header

**Deploy Center:**

1. Receives webhook request
2. Calculates HMAC-SHA256 of the payload using stored secret
3. Compares calculated signature with received signature
4. ✅ If match → Process webhook
5. ❌ If no match → Reject webhook (403 Forbidden)

### Webhook Secret

**Format:**

```
whsec_abc123def456...
```

**Purpose:**

- Prevents unauthorized deployment triggers
- Ensures webhook comes from your Git platform
- Protects against replay attacks

**Security Best Practices:**

- Never share webhook secret publicly
- Use different secrets for each project
- Regenerate secret if compromised
- Don't commit secret to Git repository

### Regenerating Webhook Secret

If your webhook secret is compromised:

1. Go to project details in Deploy Center
2. Find "Webhook Configuration" section
3. Click **"Regenerate Secret"**
4. Copy the new secret
5. Update webhook on GitHub/GitLab with new secret

**Important:** Old secret stops working immediately.

---

## Deployment Conditions

Deploy Center checks several conditions before triggering deployment:

### 1. Branch Match

Deployment only triggers if push is to the configured branch.

**Example:**

- Project configured for branch `main`
- Push to `main` → ✅ Deploy
- Push to `develop` → ❌ Skip

**How to deploy multiple branches:**
Create separate projects for each branch:

- Project 1: `main` branch → production server
- Project 2: `develop` branch → staging server

### 2. Repository Match

Webhook must be from the correct repository.

**Check:**

- Webhook repository URL must match project repository URL
- Normalized URLs are compared (removes `.git`, handles SSH vs HTTPS)

### 3. Auto-Deploy Enabled

Auto-deploy must be enabled in project configuration.

**How to enable:**

1. Go to project details
2. Click "Edit Project"
3. Check "Enable Auto Deploy"
4. Save changes

### 4. File Path Filters (Optional)

If "Deploy on Specific Paths" is configured, deployment only triggers when those files change.

**Example:**

```json
{
  "DeployOnPaths": ["src/", "public/"]
}
```

**Behavior:**

- Push changes `src/app.js` → ✅ Deploy
- Push changes `docs/README.md` → ❌ Skip
- Push changes both → ✅ Deploy

**Use Cases:**

- Monorepos (multiple projects in one repository)
- Avoid deploying on documentation changes
- Deploy only when specific components change

---

## Webhook Payload

Deploy Center extracts deployment information from the webhook payload:

### Information Extracted

| Field | Source | Example |
|-------|--------|---------|
| Branch | `ref` | `refs/heads/main` → `main` |
| Commit Hash | `after` | `abc123def456...` |
| Commit Message | `head_commit.message` | `Fix authentication bug` |
| Author | `head_commit.author.name` | `John Doe` |
| Author Email | `head_commit.author.email` | `john@example.com` |
| Repository | `repository.full_name` | `user/repository` |
| Changed Files | `commits[].added/modified/removed` | `src/app.js`, `README.md` |

### How It's Used

**In Deployment Logs:**

```
Deployment #123
Triggered by: webhook
Branch: main
Commit: abc123d (Fix authentication bug)
Author: John Doe
```

**In Pipeline Variables:**

```bash
echo "Deploying commit $COMMIT_HASH by $AUTHOR"
# Output: Deploying commit abc123d by John Doe
```

---

## Troubleshooting

### Webhook Not Triggering Deployments

**Check 1: Verify webhook is active**

- GitHub: Settings → Webhooks → Check "Active" is enabled
- GitLab: Settings → Webhooks → Check webhook exists

**Check 2: Verify recent deliveries**

- GitHub: Settings → Webhooks → Click webhook → Recent Deliveries
- Look for HTTP 200 responses (success)
- HTTP 403 → Signature verification failed (wrong secret)
- HTTP 500 → Server error (check Deploy Center logs)

**Check 3: Verify branch matches**

- Push must be to the branch configured in project
- Check project settings in Deploy Center

**Check 4: Verify auto-deploy enabled**

- Go to project settings
- Ensure "Enable Auto Deploy" is checked

**Check 5: Check Deploy Center logs**

```bash
# Check webhook processing logs
tail -f logs/webhooks.log

# Check deployment service logs
tail -f logs/deployments.log
```

### "Invalid signature" Error

**Cause:** Webhook secret mismatch.

**Solutions:**

1. **Verify secret matches:**
   - Check secret in GitHub/GitLab webhook settings
   - Check secret in Deploy Center project settings
   - They must be **exactly** the same

2. **Regenerate secret:**
   - In Deploy Center: Regenerate webhook secret
   - In GitHub/GitLab: Update webhook with new secret

3. **Check content type:**
   - Must be `application/json`
   - Not `application/x-www-form-urlencoded`

### Deployments Ignored for Some Commits

**Cause:** Deploy conditions not met.

**Check:**

1. **File path filters:**
   - If "Deploy on Specific Paths" configured
   - Changed files must match configured paths
   - Check webhook payload for changed files

2. **Branch mismatch:**
   - Verify push was to correct branch
   - Check project branch configuration

3. **Repository mismatch:**
   - Webhook from different repository
   - Check repository URLs match

### Webhook Returns 404

**Cause:** Incorrect webhook URL.

**Solutions:**

1. **Verify project name in URL:**

   ```
   /api/webhooks/github/{projectName}
                          ^^^^^^^^^ Must match your project name
   ```

2. **Check Deploy Center is running:**

   ```bash
   pm2 status
   # Or
   curl http://localhost:9090/health
   ```

3. **Verify firewall allows connections:**
   - Port 9090 must be accessible from GitHub/GitLab
   - Check firewall rules

---

## Best Practices

### ✅ Do

- **Use different secrets per project** for better security
- **Test webhooks** after setup using test push
- **Monitor webhook deliveries** in Git platform
- **Enable auto-deploy for non-production** environments
- **Use HTTPS** if Deploy Center has SSL certificate
- **Document webhook URLs** for your team
- **Regular health checks** on webhook endpoints

### ❌ Don't

- **Don't use auto-deploy for production** unless you have safeguards
- **Don't share webhook secrets** publicly
- **Don't skip signature verification** (Deploy Center does this automatically)
- **Don't ignore failed webhook deliveries**
- **Don't use same secret for multiple projects**
- **Don't expose webhook URLs** unnecessarily

---

## Related Documentation

- [Deployment Workflows](./deployment-workflows.md) - How deployments work
- [Creating Projects](./creating-projects.md) - Project setup
- [Environment Variables](./environment-variables.md) - Managing variables

---

**Need Help?** Join our [Discord community](https://discord.gg/j8edhTZy) or [open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).
