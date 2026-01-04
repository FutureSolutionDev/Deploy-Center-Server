# Notifications Setup - Stay Informed About Deployments

This guide explains how to configure deployment notifications in Deploy Center to keep your team informed about deployment status.

## Table of Contents

1. [Overview](#overview)
2. [Notification Channels](#notification-channels)
3. [Discord Setup](#discord-setup)
4. [Notification Events](#notification-events)
5. [Customization](#customization)
6. [Troubleshooting](#troubleshooting)

---

## Overview

Deploy Center can send real-time notifications about deployment events to keep your team informed without constantly checking the dashboard.

### Benefits

- ✅ **Instant Alerts**: Know immediately when deployments succeed or fail
- ✅ **Team Visibility**: Everyone on the team stays informed
- ✅ **Quick Response**: Faster reaction to failed deployments
- ✅ **Rich Information**: Detailed deployment data in notifications
- ✅ **Multiple Channels**: Discord, Slack, Email, Telegram support

### Supported Channels

| Channel | Status | Setup Difficulty |
|---------|--------|-----------------|
| Discord | ✅ Available | Easy |
| Slack | 🔄 Coming Soon | - |
| Email | 🔄 Coming Soon | - |
| Telegram | 🔄 Coming Soon | - |

---

## Notification Channels

### Discord (Available Now)

Discord notifications use webhooks to send rich embeds to your Discord server.

**Features:**

- Color-coded status (green = success, red = failed, blue = queued, yellow = in progress)
- Deployment details (branch, commit, author)
- Direct link to deployment logs
- Error messages for failed deployments
- Timestamps

**Best for:**

- Development teams using Discord
- Real-time deployment monitoring
- Quick team notifications

### Slack (Coming Soon)

Slack notifications will provide similar functionality to Discord.

**Planned Features:**

- Rich message blocks
- Thread support
- Channel mentions
- Custom message templates

### Email (Coming Soon)

Email notifications for teams preferring traditional communication.

**Planned Features:**

- HTML-formatted emails
- Attachment support for logs
- Configurable recipients
- Email templates

### Telegram (Coming Soon)

Telegram bot notifications for mobile-first teams.

**Planned Features:**

- Instant messages
- Bot commands
- Group chat support
- Inline buttons

---

## Discord Setup

### Step 1: Create Discord Webhook

1. Open your Discord server
2. Right-click the channel where you want notifications
3. Select **"Edit Channel"**
4. Go to **"Integrations"** tab
5. Click **"Create Webhook"** (or "View Webhooks" if you have existing ones)
6. Click **"New Webhook"**
7. Configure webhook:
   - **Name**: `Deploy Center` (or your preferred name)
   - **Channel**: Select target channel
   - **Avatar**: Upload Deploy Center logo (optional)
8. Click **"Copy Webhook URL"**

**Webhook URL format:**

```
https://discord.com/api/webhooks/{webhookId}/{webhookToken}
```

### Step 2: Configure in Deploy Center

#### Global Discord Configuration (All Projects)

Set up Discord for all projects in your server's `.env` file:

```bash
# Discord webhook URL for global notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdef...
```

**How it works:**

- All projects send notifications to this webhook
- Quick setup for new projects
- Centralized notification management

#### Project-Specific Discord Configuration

Configure Discord per project for more granular control:

1. Go to your project details page
2. Click **"Edit Project"**
3. Scroll to **"Notification Configuration"**
4. Fill in Discord settings:

```json
{
  "Discord": {
    "Enabled": true,
    "WebhookUrl": "https://discord.com/api/webhooks/..."
  }
}
```

5. Click **"Save"**

**How it works:**

- Project-specific webhook overrides global webhook
- Different channels for different projects
- Ideal for team-based notifications

### Step 3: Test Notifications

Trigger a deployment to test notifications:

1. Go to project dashboard
2. Click **"Deploy"** (manual deployment)
3. Wait for deployment to complete
4. Check your Discord channel for notifications

**Expected Discord messages:**

**1. Deployment Queued (Blue):**

```
🔵 Deployment Queued
Project: My Website
Branch: main
Commit: abc123d - Fix authentication bug
Author: John Doe
Triggered by: manual
```

**2. Deployment In Progress (Yellow):**

```
🟡 Deployment In Progress
Project: My Website
Branch: main
Commit: abc123d - Fix authentication bug
Author: John Doe
```

**3. Deployment Success (Green):**

```
✅ Deployment Successful
Project: My Website
Branch: main
Commit: abc123d - Fix authentication bug
Author: John Doe
Duration: 3m 15s
View Logs: [Click here]
```

**4. Deployment Failed (Red):**

```
❌ Deployment Failed
Project: My Website
Branch: main
Commit: abc123d - Fix authentication bug
Author: John Doe
Duration: 1m 45s
Error: Build step failed: npm run build exited with code 1
View Logs: [Click here]
```

---

## Notification Events

Deploy Center can notify on different deployment events:

### Event Types

#### 1. Queued

**When:** Deployment is created and added to queue

**Use cases:**

- Know deployment is scheduled
- Track queue position
- Monitor pending deployments

**Recommendation:** Disable for high-frequency deployments (too noisy)

#### 2. In Progress

**When:** Deployment execution starts

**Use cases:**

- Know deployment is actively running
- Real-time monitoring
- Coordinate with team during deployment

**Recommendation:** Disable unless you need real-time updates

#### 3. Success

**When:** Deployment completes successfully

**Use cases:**

- Confirm successful deployment
- Team notification of new version live
- Deployment timestamp tracking

**Recommendation:** ✅ Enable (most important notification)

#### 4. Failed

**When:** Deployment fails at any stage

**Use cases:**

- Immediate failure alerts
- Quick response to issues
- Error tracking

**Recommendation:** ✅ Enable (critical for monitoring)

### Configuring Events

**In Project Configuration:**

```json
{
  "NotifyOnStart": false,     // Queued + In Progress
  "NotifyOnSuccess": true,    // Success
  "NotifyOnFailure": true     // Failed
}
```

**Recommended Settings:**

**Production Projects:**

```json
{
  "NotifyOnStart": false,
  "NotifyOnSuccess": true,
  "NotifyOnFailure": true
}
```

**Development/Staging Projects:**

```json
{
  "NotifyOnStart": false,
  "NotifyOnSuccess": false,   // Too frequent
  "NotifyOnFailure": true     // Only failures
}
```

---

## Customization

### Notification Content

Notifications include the following information:

**Always included:**

- Project name
- Deployment status
- Branch name
- Commit hash (short)
- Commit message
- Author name
- Trigger source (webhook/manual)

**Conditionally included:**

- Duration (for completed deployments)
- Error message (for failed deployments)
- Link to deployment logs
- Timestamp

### Discord Embed Colors

| Status | Color | Hex Code |
|--------|-------|----------|
| Queued | Blue | `#3498db` |
| In Progress | Yellow | `#f39c12` |
| Success | Green | `#2ecc71` |
| Failed | Red | `#e74c3c` |

### Future Customization (Coming Soon)

- Custom message templates
- Mention specific users/roles
- Conditional notifications based on branch
- Include deployment metadata
- Attach deployment artifacts

---

## Best Practices

### ✅ Do

**1. Use Different Channels per Environment**

```
#deployments-prod     → Production deployments
#deployments-staging  → Staging deployments
#deployments-dev      → Development deployments
```

**2. Configure Appropriate Events**

- Production: Only success + failure
- Staging: Only failure
- Development: Disable or only failure

**3. Test Webhooks After Setup**

- Trigger manual deployment
- Verify notifications received
- Check message formatting

**4. Monitor Webhook Health**

- Check Discord webhook logs
- Review delivery failures
- Update webhook if needed

**5. Document Webhook URLs**

- Store webhook URLs securely
- Keep backup of configuration
- Share with team leads only

### ❌ Don't

**1. Don't Send Too Many Notifications**

- Avoid "Queued" for frequent deployments
- Disable "In Progress" unless needed
- Team will ignore if too noisy

**2. Don't Share Webhook URLs Publicly**

- Anyone with URL can send messages
- Keep in project settings only
- Regenerate if compromised

**3. Don't Use Same Webhook for Everything**

- Separate webhooks per environment
- Or per team/project
- Makes filtering easier

**4. Don't Forget to Test**

- Always test after configuration
- Verify all event types
- Check message formatting

---

## Troubleshooting

### Notifications Not Appearing

**Check 1: Discord webhook valid**

1. Copy webhook URL
2. Test with curl:

   ```bash
   curl -X POST "https://discord.com/api/webhooks/..." \
     -H "Content-Type: application/json" \
     -d '{"content": "Test message"}'
   ```

3. Check Discord channel for test message

**Check 2: Notifications enabled in project**

```json
{
  "Discord": {
    "Enabled": true,  // Must be true
    "WebhookUrl": "..."
  },
  "NotifyOnSuccess": true,  // Enable at least one event
  "NotifyOnFailure": true
}
```

**Check 3: Check Deploy Center logs**

```bash
tail -f logs/notifications.log
```

Look for:

- `Sending Discord notification...`
- `Discord notification sent successfully`
- Error messages

### Webhook Returns Error

**Error: 401 Unauthorized**

- Webhook URL invalid or expired
- Webhook deleted from Discord
- Regenerate webhook in Discord

**Error: 404 Not Found**

- Webhook URL incorrect
- Channel deleted
- Webhook deleted

**Error: 429 Rate Limited**

- Too many notifications sent
- Discord rate limit hit (30 messages per 60 seconds)
- Reduce notification frequency

**Error: 400 Bad Request**

- Invalid message format
- Check Deploy Center version
- Report bug if persists

### Messages Show Wrong Information

**Check 1: Verify deployment data correct**

- Check deployment details in UI
- Verify Git commit information
- Ensure webhook payload valid

**Check 2: Update Deploy Center**

- May be bug in older version
- Check for updates
- Review changelog

---

## Future Enhancements

Planned notification improvements:

### Advanced Filtering

```json
{
  "Notifications": {
    "Discord": {
      "Enabled": true,
      "WebhookUrl": "...",
      "OnlyBranches": ["main", "production"],
      "OnlyTriggeredBy": ["webhook"],
      "IncludeChangedFiles": true
    }
  }
}
```

### Custom Templates

```json
{
  "Notifications": {
    "Discord": {
      "Template": {
        "Success": "✅ {{project}} deployed to {{environment}}!",
        "Failed": "❌ {{project}} deployment failed: {{error}}"
      }
    }
  }
}
```

### Mentions & Roles

```json
{
  "Notifications": {
    "Discord": {
      "MentionOnFailure": "@devops-team",
      "MentionUsers": ["<@123456789>"]
    }
  }
}
```

---

## Related Documentation

- [Creating Projects](./creating-projects.md) - Project setup
- [Deployment Workflows](./deployment-workflows.md) - Understanding deployments
- [Webhook Setup](./webhooks.md) - Auto-deploy configuration

---

**Need Help?** Join our [Discord community](https://discord.gg/j8edhTZy) or [open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).
