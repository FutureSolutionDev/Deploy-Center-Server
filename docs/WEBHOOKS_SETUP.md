# GitHub Webhooks Setup Guide

This guide explains how to set up GitHub webhooks for automatic deployments.

## Overview

Webhooks allow GitHub to notify Deploy Center when code is pushed, triggering automatic deployments.

```
GitHub Push → Webhook → Deploy Center → Start Deployment
```

---

## Step 1: Get Webhook URL

Your webhook URL format:

```
http://your-server-ip:3001/api/webhooks/github/{{ProjectName}}
```

**Example:**

```
http://45.123.456.789:3001/api/webhooks/github/{{ProjectName}}
```

For production, use HTTPS:

```
https://deploy.yourcompany.com/api/webhooks/github/{{ProjectName}}
```

---

## Step 2: Get Webhook Secret

The webhook secret is stored in your project's `WebhookSecret` field.

### Option A: From Database

```sql
SELECT Id, Name, WebhookSecret FROM Projects WHERE Id = YOUR_PROJECT_ID;
```

### Option B: From Deploy Center UI

1. Go to Projects → Your Project → Settings
2. Copy the Webhook Secret
3. Or click "Regenerate Webhook Secret" to get a new one

---

## Step 3: Configure Webhook on GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Webhooks** → **Add webhook**

3. Fill in the form:
   - **Payload URL**: `http://your-server:3001/api/webhooks/github/{{ProjectName}}`
   - **Content type**: `application/json`
   - **Secret**: Paste your project's `WebhookSecret`

4. Which events would you like to trigger this webhook?
   - Select: **Just the push event**

5. **Active**: ✅ (checked)

6. Click **Add webhook**

---

## Step 4: Test the Webhook

### Method 1: Manual Test from GitHub

1. Go to your webhook in GitHub Settings
2. Click on the webhook
3. Scroll down to "Recent Deliveries"
4. Click "Redeliver" on any past delivery
5. Or push a commit to trigger it naturally

### Method 2: Use Webhook Tester

```bash
# Install curl if not available
# Send test payload
curl -X POST http://your-server:3001/api/webhooks/github/{{ProjectName}} \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{
    "ref": "refs/heads/master",
    "repository": {
      "name": "your-repo"
    },
    "head_commit": {
      "id": "abc123",
      "message": "Test commit",
      "author": {
        "name": "Test User"
      }
    }
  }'
```

---

## Step 5: Verify Webhook is Working

### Check GitHub Webhook Status

1. Go to repository Settings → Webhooks
2. Click on your webhook
3. Check "Recent Deliveries"
4. You should see:
   - ✅ Green checkmark = Success (200 OK)
   - ❌ Red X = Failed

### Check Deploy Center Logs

```bash
# Check server logs
pm2 logs deploy-center

# Or check deployment logs
tail -f server/logs/app-YYYY-MM-DD.log
```

### Check Deployment Created

1. Go to Deploy Center UI
2. Navigate to Deployments page
3. You should see a new deployment with:
   - Status: `queued` or `inProgress`
   - Trigger: `webhook`
   - Branch: Your pushed branch
   - Commit: Your commit hash

---

## Webhook Payload

Deploy Center expects this payload from GitHub:

```json
{
  "ref": "refs/heads/master",
  "repository": {
    "name": "your-repo-name",
    "full_name": "username/your-repo-name",
    "html_url": "https://github.com/username/your-repo-name"
  },
  "head_commit": {
    "id": "abc123def456...",
    "message": "Commit message here",
    "author": {
      "name": "Author Name",
      "email": "author@example.com"
    }
  }
}
```

---

## Webhook Security

### HMAC Signature Verification

Deploy Center verifies webhook signatures to ensure requests are from GitHub:

1. GitHub sends `X-Hub-Signature-256` header with HMAC-SHA256 hash
2. Deploy Center computes HMAC of payload using `WebhookSecret`
3. If hashes match → webhook is authentic
4. If hashes don't match → request is rejected (403 Forbidden)

**Implementation:**

```typescript
// Server verifies signature
const signature = req.headers['x-hub-signature-256'];
const hmac = crypto.createHmac('sha256', webhookSecret);
const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
```

### Best Practices

- ✅ Always use a strong, random webhook secret
- ✅ Keep webhook secrets confidential
- ✅ Rotate secrets periodically
- ✅ Use HTTPS in production
- ✅ Monitor webhook delivery logs
- ❌ Don't commit webhook secrets to git
- ❌ Don't reuse secrets across projects

---

## Branch Filtering

Deploy Center only triggers deployments when the pushed branch matches the project's configured branch:

```typescript
// Project Config
{
  "Branch": "master"  // Only master branch triggers deployment
}
```

**Example:**

- Push to `master` → ✅ Deployment triggered
- Push to `develop` → ❌ Ignored
- Push to `feature/new-ui` → ❌ Ignored

To deploy multiple branches, create separate projects for each branch.

---

## Troubleshooting

### Webhook Returns 404

**Problem:** GitHub receives 404 Not Found

**Solutions:**

1. Check webhook URL is correct: `http://server:3001/api/webhooks/github/{{ProjectName}}`
2. Ensure server is running: `pm2 list`
3. Verify port 3001 is accessible
4. Check firewall rules

```bash
# Test if server is reachable
curl http://your-server:3001/api/health

# Check if port is open
telnet your-server 3001
```

### Webhook Returns 403 Forbidden

**Problem:** Signature verification failed

**Solutions:**

1. Webhook secret mismatch
   - Verify secret in GitHub matches `WebhookSecret` in database
2. Payload was modified in transit
3. Wrong hashing algorithm (should be SHA-256)

### Webhook Returns 500 Error

**Problem:** Server error processing webhook

**Solutions:**

1. Check server logs: `pm2 logs deploy-center`
2. Check database connection
3. Verify project exists and is active
4. Check repository name matches

### Deployment Not Created

**Problem:** Webhook succeeds but no deployment

**Solutions:**

1. Check branch matches: pushed branch must match project's `Branch` field
2. Project might be inactive: check `IsActive` = true
3. Check webhook payload repository name matches project

---

## Multiple Webhooks (Multiple Projects)

If you have multiple projects from the same repository:

### Scenario 1: Different Branches

```
Project 1: Deploy master branch to production
Project 2: Deploy develop branch to staging
```

**Setup:**

1. Create two projects with same RepoUrl but different Branch
2. Use same webhook URL for both
3. Deploy Center automatically routes to correct project based on branch

### Scenario 2: Different Repositories

```
Project 1: https://github.com/company/frontend
Project 2: https://github.com/company/backend
```

**Setup:**

1. Create two projects with different RepoUrl
2. Add webhook to each repository
3. Each webhook can use different secret

---

## Production Considerations

### 1. Use HTTPS

```nginx
# Nginx reverse proxy config
server {
    listen 443 ssl;
    server_name deploy.yourcompany.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/webhooks/github {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 2. Rate Limiting

Consider adding rate limiting to webhook endpoint:

```typescript
// Example using express-rate-limit
import rateLimit from 'express-rate-limit';

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per minute per IP
  message: 'Too many webhook requests',
});

app.post('/api/webhooks/github', webhookLimiter, webhookHandler);
```

### 3. Webhook Logging

Log all webhook attempts for security auditing:

```typescript
// Logs stored in AuditLog table
{
  Action: 'webhook_received',
  ResourceType: 'deployment',
  IpAddress: req.ip,
  Details: {
    repository: payload.repository.name,
    branch: branch,
    commit: payload.head_commit?.id,
    success: true
  }
}
```

### 4. Monitor Webhook Health

Set up monitoring:

- Track webhook delivery success rate
- Alert on repeated failures
- Monitor deployment queue length

---

## Testing Webhooks Locally

### Using ngrok

If your server is not publicly accessible:

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3001

# Use the ngrok URL in GitHub webhook
https://abc123.ngrok.io/api/webhooks/github/{{ProjectName}}
```

### Using localtunnel

Alternative to ngrok:

```bash
# Install localtunnel
npm install -g localtunnel

# Create tunnel
lt --port 3001 --subdomain mydeploycenter

# Use the URL
https://mydeploycenter.loca.lt/api/webhooks/github/{{ProjectName}}
```

---

## Webhook Events Reference

Deploy Center currently supports:

- ✅ **push** - Code pushed to repository
- ❌ **pull_request** - Not yet supported
- ❌ **release** - Not yet supported

Future events to be added:

- Pull request merged
- Tag created (release)
- Branch created/deleted

---

## Next Steps

After webhook is working:

1. ✅ Push code to your repository
2. ✅ Verify deployment is triggered automatically
3. ✅ Check deployment logs
4. ✅ Monitor webhook delivery status on GitHub
5. ✅ Set up notifications (Discord, Slack, etc.)

For notification setup, see [NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md)
