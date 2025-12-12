# GitHub Webhook Setup Guide

Complete guide for connecting GitHub repositories (public and private) with Deploy Center using webhooks.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup for Public Repositories](#setup-for-public-repositories)
3. [Setup for Private Repositories](#setup-for-private-repositories)
4. [Webhook Configuration](#webhook-configuration)
5. [Testing the Connection](#testing-the-connection)
6. [Troubleshooting](#troubleshooting)
7. [Security Best Practices](#security-best-practices)

---

## Prerequisites

Before setting up GitHub webhooks, ensure you have:

- ✅ Deploy Center installed and running
- ✅ A project created in Deploy Center
- ✅ Network access from GitHub to your Deploy Center server
- ✅ Admin access to your GitHub repository
- ✅ Your Deploy Center webhook URL (e.g., `https://deploy.example.com/api/webhooks/github/{{ProjectName}}`)

---

## Setup for Public Repositories

### Step 1: Get Webhook Secret from Deploy Center

1. **Login to Deploy Center**

   - Navigate to `Projects` page
   - Click on your project or create a new one
2. **Copy Webhook Secret**

   - In the project details page, find the **"GitHub Webhook"** section
   - Click **"Show Secret"** to reveal the webhook secret
   - Click **"Copy"** to copy the secret to clipboard
   - **⚠️ Keep this secret secure - never commit it to Git**

   ![Webhook Secret](./docs/images/webhook-secret.png)

### Step 2: Configure GitHub Webhook

1. **Go to Repository Settings**

   - Open your GitHub repository
   - Click **Settings** tab
   - Click **Webhooks** in the left sidebar
   - Click **Add webhook** button
2. **Configure Webhook Settings**

   | Field                      | Value                                           | Description                         |
   | -------------------------- | ----------------------------------------------- | ----------------------------------- |
   | **Payload URL**      | `https://your-domain.com/api/webhooks/github/{{ProjectName}}` | Your Deploy Center webhook endpoint |
   | **Content type**     | `application/json`                            | ✅ Select JSON format               |
   | **Secret**           | *Your webhook secret from Deploy Center*      | Paste the secret you copied         |
   | **SSL verification** | ✅ Enable SSL verification                      | Recommended for production          |
   | **Which events?**    | Just the `push` event                         | Only trigger on code pushes         |
   | **Active**           | ✅ Active                                       | Enable the webhook                  |
3. **Save Webhook**

   - Click **Add webhook** button
   - GitHub will send a test ping event
   - Check for a green checkmark ✅ next to the webhook

### Step 3: Verify Connection

1. **Check Webhook Delivery**

   - In GitHub webhook settings, click on your webhook
   - Go to **Recent Deliveries** tab
   - You should see a successful ping event (200 response)
2. **Test with a Push**

   - Make a small change to your repository
   - Commit and push to the branch configured in Deploy Center
   - Go to Deploy Center → **Deployments** page
   - You should see a new deployment triggered automatically

---

## Setup for Private Repositories

Private repositories require additional authentication for Deploy Center to access your code.

### Option 1: Using SSH Keys (Recommended)

SSH keys provide secure, read-only access to your private repository.

#### Step 1: Generate SSH Key in Deploy Center

1. **Navigate to Project Settings**

   - Go to **Projects** → Select your project
   - Scroll to **SSH Key Management** section
2. **Generate SSH Key**

   - Click **"Generate SSH Key"** button
   - Wait for key generation (takes ~2 seconds)
   - The public key will be displayed
3. **Copy Public Key**

   - Click **"Copy Public Key"** button
   - The SSH public key is now in your clipboard

#### Step 2: Add Deploy Key to GitHub

1. **Go to Repository Settings**

   - Open your GitHub repository
   - Click **Settings** → **Deploy keys** (in left sidebar)
2. **Add Deploy Key**

   - Click **Add deploy key** button
   - Fill in the form:
     - **Title**: `Deploy Center - [Project Name]`
     - **Key**: Paste the SSH public key from Deploy Center
     - **Allow write access**: ❌ **LEAVE UNCHECKED** (read-only is safer)
   - Click **Add key**
3. **Update Project Settings**

   - Go back to Deploy Center project settings
   - Ensure **"Use SSH Key"** toggle is **enabled**
   - The repository URL should be in SSH format:
     ```
     git@github.com:username/repository.git
     ```

#### Step 3: Configure Webhook

Follow the same steps as [Setup for Public Repositories](#setup-for-public-repositories) to configure the webhook.

---

### Option 2: Using Personal Access Token (Alternative)

**⚠️ Note:** This method is less secure than SSH keys. Use only if SSH is not available.

#### Step 1: Generate GitHub Personal Access Token

1. **Go to GitHub Settings**

   - Click your profile picture → **Settings**
   - Scroll to **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate New Token**

   - Click **Generate new token (classic)**
   - Give it a descriptive name: `Deploy Center - [Project Name]`
   - Set expiration (e.g., 90 days)
   - Select scopes:
     - ✅ `repo` (Full control of private repositories)
   - Click **Generate token**
3. **Copy Token**

   - ⚠️ **Copy the token immediately** - you won't see it again!
   - Store it securely

#### Step 2: Update Repository URL

In Deploy Center project settings, update the repository URL to include the token:

```
https://[TOKEN]@github.com/username/repository.git
```

Replace `[TOKEN]` with your personal access token.

**⚠️ Security Warning:**

- This embeds your token in the database
- Anyone with access to Deploy Center can see it
- SSH keys are much more secure

#### Step 3: Configure Webhook

Follow the same steps as [Setup for Public Repositories](#setup-for-public-repositories) to configure the webhook.

---

## Webhook Configuration

### Webhook URL Structure

Your Deploy Center webhook URL should follow this format:

```
https://[DOMAIN]/api/webhooks/github/{{ProjectName}}
```

**Examples:**

- Production: `https://deploy.example.com/api/webhooks/github/{{ProjectName}}`
- Development: `http://localhost:3000/api/webhooks/github/{{ProjectName}}`

### Supported Events

Currently, Deploy Center only listens to **push events**. Other events are ignored.

**Webhook Event Flow:**

```
GitHub Push Event
    ↓
Webhook POST → /api/webhooks/github/{{ProjectName}}
    ↓
Verify HMAC-SHA256 Signature
    ↓
Extract repository name and branch
    ↓
Match with Deploy Center project
    ↓
Trigger deployment pipeline
    ↓
Send notifications (Discord/Slack)
```

### Branch Filtering

Deploy Center only triggers deployments for branches configured in your project settings.

**Example:**

- Project configured for branch: `main`
- Push to `main` → ✅ Deployment triggered
- Push to `develop` → ❌ Ignored

---

## Testing the Connection

### Test 1: Webhook Ping

1. Go to GitHub repository → **Settings** → **Webhooks**
2. Click on your webhook
3. Scroll to **Recent Deliveries**
4. Click **Redeliver** on the ping event
5. Check response status:
   - ✅ **200 OK** - Webhook is working
   - ❌ **4xx/5xx** - See [Troubleshooting](#troubleshooting)

### Test 2: Actual Deployment

1. **Make a test commit:**

   ```bash
   echo "Test webhook" >> README.md
   git add README.md
   git commit -m "Test: Trigger deployment webhook"
   git push origin main
   ```
2. **Check Deploy Center:**

   - Go to **Deployments** page
   - You should see a new deployment within seconds
   - Click on the deployment to view logs
3. **Check GitHub:**

   - Go to repository → **Settings** → **Webhooks**
   - Click on your webhook → **Recent Deliveries**
   - The push event should show **200 OK**

---

## Troubleshooting

### Problem: Webhook Shows 401 Unauthorized

**Cause:** Webhook secret mismatch

**Solution:**

1. Copy the webhook secret from Deploy Center project settings
2. Go to GitHub webhook settings
3. Update the **Secret** field with the correct value
4. Save and test again

---

### Problem: Webhook Shows 404 Not Found

**Cause:** Incorrect webhook URL

**Solution:**

1. Verify your Deploy Center is running
2. Check the webhook URL format: `https://domain.com/api/webhooks/github/{{ProjectName}}`
3. Ensure no trailing slashes or typos
4. Test the URL in your browser (should return method not allowed if working)

---

### Problem: Webhook Shows 500 Internal Server Error

**Cause:** Server-side error in Deploy Center

**Solution:**

1. Check Deploy Center server logs:
   ```bash
   # If using PM2
   pm2 logs deploy-center

   # If using npm
   npm run dev
   ```
2. Look for error messages related to webhook handling
3. Common issues:
   - Database connection failed
   - Project not found
   - Invalid configuration

---

### Problem: Deployment Not Triggered

**Possible Causes:**

1. **Branch Mismatch**

   - Webhook works, but branch doesn't match project configuration
   - **Solution:** Update project settings to match your branch
2. **Project Not Found**

   - Repository name doesn't match any project
   - **Solution:** Verify project repository name matches GitHub repository
3. **Webhook Disabled**

   - Webhook is inactive in GitHub
   - **Solution:** Go to GitHub webhook settings and ensure it's active

---

### Problem: Private Repository - Authentication Failed

**For SSH Keys:**

1. **Verify Deploy Key is Added**

   - Go to GitHub → Settings → Deploy keys
   - Check if your Deploy Center key is listed
   - Ensure it has read access
2. **Verify SSH Key is Enabled**

   - In Deploy Center project settings
   - Check **"Use SSH Key"** is enabled
   - Verify SSH public key fingerprint matches GitHub
3. **Check Repository URL Format**

   - Should be: `git@github.com:username/repo.git`
   - NOT: `https://github.com/username/repo.git`

**For Personal Access Token:**

1. **Token Expired**

   - Regenerate token in GitHub settings
   - Update repository URL in Deploy Center
2. **Token Insufficient Permissions**

   - Token must have `repo` scope
   - Regenerate with correct permissions

---

### Problem: SSL Certificate Verification Failed

**Cause:** Self-signed certificate or invalid SSL

**Solution:**

**For Production (Recommended):**

- Use a valid SSL certificate (Let's Encrypt, etc.)
- Update your Deploy Center domain to use HTTPS

**For Development/Testing Only:**

- In GitHub webhook settings, disable **SSL verification**
- ⚠️ **NOT recommended for production**

---

## Security Best Practices

### 1. Webhook Secret Management

✅ **DO:**

- Use strong, random webhook secrets (minimum 32 characters)
- Rotate webhook secrets regularly (every 90 days)
- Store secrets securely in Deploy Center database (encrypted)
- Use different secrets for each project

❌ **DON'T:**

- Commit webhook secrets to Git
- Share secrets in plain text (email, chat)
- Reuse the same secret across multiple projects
- Use weak secrets like "password123"

---

### 2. SSH Key Security

✅ **DO:**

- Use SSH keys instead of personal access tokens
- Generate unique SSH key per project
- Use read-only deploy keys (no write access)
- Rotate SSH keys every 90 days
- Delete old SSH keys from GitHub after rotation

❌ **DON'T:**

- Share SSH private keys
- Use the same SSH key for multiple projects
- Grant write access to deploy keys
- Store SSH keys in version control

---

### 3. Network Security

✅ **DO:**

- Use HTTPS for webhook URLs (SSL enabled)
- Enable SSL verification in GitHub webhook settings
- Use firewall rules to restrict access
- Consider IP whitelisting for GitHub webhook IPs

**GitHub Webhook IP Ranges:**

```
192.30.252.0/22
185.199.108.0/22
140.82.112.0/20
143.55.64.0/20
2a0a:a440::/29
2606:50c0::/32
```

❌ **DON'T:**

- Use HTTP (unencrypted) in production
- Disable SSL verification in production
- Expose webhook endpoint to public without authentication

---

### 4. Access Control

✅ **DO:**

- Limit GitHub repository access to necessary users
- Use GitHub's branch protection rules
- Require pull request reviews before merging
- Enable two-factor authentication (2FA) on GitHub

❌ **DON'T:**

- Give admin access to everyone
- Allow direct pushes to main/master branch
- Disable 2FA for accounts with deploy access

---

### 5. Monitoring & Auditing

✅ **DO:**

- Monitor webhook delivery success rate
- Log all deployment activities
- Set up alerts for failed deployments
- Review webhook delivery logs regularly

**Where to Check:**

- **GitHub:** Repository → Settings → Webhooks → Recent Deliveries
- **Deploy Center:** Deployments page → Deployment logs

---

## Webhook Payload Example

When GitHub sends a webhook, Deploy Center receives a payload like this:

```json
{
  "ref": "refs/heads/main",
  "repository": {
    "name": "my-app",
    "full_name": "username/my-app",
    "private": false,
    "clone_url": "https://github.com/username/my-app.git",
    "ssh_url": "git@github.com:username/my-app.git"
  },
  "pusher": {
    "name": "developer",
    "email": "dev@example.com"
  },
  "commits": [
    {
      "id": "a1b2c3d4e5f6...",
      "message": "Fix: Update deployment script",
      "timestamp": "2025-12-12T10:30:00Z",
      "author": {
        "name": "Developer",
        "email": "dev@example.com"
      }
    }
  ]
}
```

Deploy Center extracts:

- **Repository name**: `my-app`
- **Branch**: `main` (from `refs/heads/main`)
- **Commit hash**: `a1b2c3d4e5f6...`
- **Commit message**: For deployment logs

---

## Advanced Configuration

### Multiple Branches

To deploy different branches to different environments:

1. **Create separate projects in Deploy Center:**

   - Project 1: "MyApp Production" → Branch: `main`
   - Project 2: "MyApp Staging" → Branch: `staging`
2. **Configure same webhook in GitHub**

   - The webhook secret can be the same
   - Both projects will receive the event
   - Each will check if the branch matches
3. **Result:**

   - Push to `main` → Deploys to production
   - Push to `staging` → Deploys to staging

---

### Webhook Signature Verification

Deploy Center verifies webhook authenticity using HMAC SHA-256:

```javascript
// How Deploy Center verifies webhooks
const signature = req.headers['x-hub-signature-256'];
const payload = JSON.stringify(req.body);
const hmac = crypto.createHmac('sha256', webhookSecret);
const digest = 'sha256=' + hmac.update(payload).digest('hex');

if (signature === digest) {
  // ✅ Webhook is authentic
} else {
  // ❌ Reject - possible attack
}
```

This ensures webhooks are actually from GitHub, not malicious actors.

---

## Quick Reference

### Webhook Setup Checklist

- [ ] Deploy Center project created
- [ ] Webhook secret copied from Deploy Center
- [ ] GitHub webhook configured
- [ ] Payload URL: `https://domain.com/api/webhooks/github/{{ProjectName}}`
- [ ] Content type: `application/json`
- [ ] Secret: pasted from Deploy Center
- [ ] SSL verification: enabled (production)
- [ ] Events: "Just the push event"
- [ ] Webhook active: ✅
- [ ] Test ping successful (200 OK)
- [ ] Test push successful (deployment triggered)

### SSH Key Setup Checklist (Private Repos)

- [ ] SSH key generated in Deploy Center
- [ ] Public key copied
- [ ] Deploy key added to GitHub
- [ ] Write access: ❌ disabled
- [ ] Repository URL: `git@github.com:user/repo.git`
- [ ] "Use SSH Key" enabled in Deploy Center
- [ ] Test deployment successful

---

## Support

If you encounter issues not covered in this guide:

1. **Check Server Logs:**

   ```bash
   pm2 logs deploy-center
   ```
2. **Check GitHub Webhook Deliveries:**

   - Repository → Settings → Webhooks → Recent Deliveries
   - Look for error messages in response
3. **Contact Support:**

   - Create an issue on GitHub
   - Include webhook delivery response
   - Include Deploy Center server logs

---

## Additional Resources

- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [GitHub Deploy Keys Guide](https://docs.github.com/en/developers/overview/managing-deploy-keys)
- [GitHub Webhook Security](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

---

**Last Updated:** December 2025
**Deploy Center Version:** 2.0.0
