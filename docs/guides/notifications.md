# Notifications Setup Guide

Learn how to configure notifications to stay informed about your deployments.

## Table of Contents

- [Overview](#overview)
- [Notification Events](#notification-events)
- [Notification Channels](#notification-channels)
  - [Discord](#discord)
  - [Slack](#slack)
  - [Email](#email)
  - [Telegram](#telegram)
- [Configuration Examples](#configuration-examples)
- [Testing Notifications](#testing-notifications)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

Deploy Center can send notifications about deployment events through multiple channels:

- **Discord** - Webhooks to Discord channels
- **Slack** - Webhooks to Slack channels
- **Email** - SMTP email notifications
- **Telegram** - Telegram bot messages

You can configure notifications per project, choosing which events trigger notifications and which channels to use.

---

## Notification Events

### On Start

**When:** Deployment begins

**Use for:**

- Knowing a deployment is in progress
- Team awareness
- Audit trail

**Example message:**

```text
[STARTED] Deployment Started
Project: My Website
Branch: main
Commit: abc123d
User: admin
```

---

### On Success

**When:** Deployment completes successfully

**Use for:**

- Confirmation that deployment worked
- Success tracking
- Production deployment alerts

**Example message:**

```text
[SUCCESS] Deployment Successful
Project: My Website
Branch: main
Duration: 2m 34s
Status: SUCCESS
```

---

### On Failure

**When:** Deployment fails at any step

**Use for:**

- Immediate problem notification
- Critical alerts
- Quick response to issues

**Example message:**

```text
[FAILED] Deployment Failed
Project: My Website
Branch: main
Failed at: Build Application
Error: npm ERR! code E404
Duration: 1m 12s
```

---

## Notification Channels

### Discord

**Requirements:**

- Discord server with webhook permissions
- Webhook URL from Discord

#### Step 1: Create Discord Webhook

1. Open Discord server settings
2. Go to **Integrations** > **Webhooks**
3. Click **New Webhook**
4. Choose the channel for notifications
5. Copy the **Webhook URL**

**Example URL:**

```text
https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz
```

#### Step 2: Configure in Deploy Center

1. Edit your project
2. Go to **Notifications** section
3. Enable **Discord**
4. Paste the webhook URL
5. Select events (On Start, On Success, On Failure)
6. Save

#### Discord Message Format

Deploy Center sends rich embeds to Discord with:

- **Title:** Deployment status (Started, Success, Failed)
- **Color:** Green for success, red for failure, blue for started
- **Fields:**
  - Project name
  - Branch
  - Commit hash
  - User who triggered deployment
  - Duration (for completed deployments)
  - Error message (for failed deployments)

---

### Slack

**Requirements:**

- Slack workspace with webhook permissions
- Incoming webhook URL

#### Step 1: Create Slack Incoming Webhook

1. Go to [Slack Apps](https://api.slack.com/apps)
2. Create new app or select existing
3. Enable **Incoming Webhooks**
4. Click **Add New Webhook to Workspace**
5. Choose channel
6. Copy the **Webhook URL**

**Example URL:**

```text
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

#### Step 2: Configure in Deploy Center

1. Edit your project
2. Go to **Notifications** section
3. Enable **Slack**
4. Paste the webhook URL
5. Select events
6. Save

#### Slack Message Format

Deploy Center sends formatted messages with:

- **Status icon:** [STARTED] [SUCCESS] [FAILED]
- **Attachment with:**
  - Project details
  - Branch and commit
  - User information
  - Deployment duration
  - Error details (if failed)
- **Color coding:** Good (green), danger (red), warning (yellow)

---

### Email

**Requirements:**

- SMTP server credentials
- Email addresses for recipients

#### Step 1: Configure SMTP in Deploy Center

Add to your `.env` file:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Sender information
EMAIL_FROM=Deploy Center <noreply@example.com>
```

#### Gmail Setup (Example)

1. Enable 2FA on your Google account
2. Generate an **App Password**:
   - Go to Google Account > Security
   - 2-Step Verification > App passwords
   - Generate password for "Mail"
3. Use the generated password in `SMTP_PASSWORD`

#### Other SMTP Providers

**Outlook/Office365:**

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

**SendGrid:**

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

**Mailgun:**

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

#### Step 2: Configure in Project

1. Edit your project
2. Go to **Notifications** section
3. Enable **Email**
4. Add recipient email addresses (comma-separated)
5. Select events
6. Save

**Example:**

```text
admin@example.com, team@example.com, devops@example.com
```

#### Email Message Format

**Subject:**

```text
[Deploy Center] Deployment Success: My Website
```

**Body (HTML):**

- Deployment status badge
- Project information table
- Branch and commit details
- Duration
- Error information (if failed)
- Link to deployment logs

---

### Telegram

**Requirements:**

- Telegram bot token
- Chat ID (user, group, or channel)

#### Step 1: Create Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow instructions to create bot
4. Copy the **Bot Token**

**Example token:**

```text
123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

#### Step 2: Get Chat ID

**For personal notifications:**

1. Search for **@userinfobot** in Telegram
2. Start conversation
3. Bot will send your Chat ID

**For group notifications:**

1. Add your bot to the group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YourBotToken>/getUpdates`
4. Find `"chat":{"id":-123456789}` in response

**For channel notifications:**

1. Add bot as channel admin
2. Use channel username: `@yourchannel`
3. Or get numeric ID using getUpdates

#### Step 3: Configure in Deploy Center

Add to your `.env` file:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

Then in project settings:

1. Edit your project
2. Go to **Notifications** section
3. Enable **Telegram**
4. Enter Chat ID
5. Select events
6. Save

#### Telegram Message Format

```text
[STARTED] Deployment Started

Project: My Website
Branch: main
Commit: abc123d
User: admin

Started at: 2026-01-04 10:30:15
```

---

## Configuration Examples

### Example 1: Production Alerts Only

**Use Case:** Only notify on production failures

**Configuration:**

- **Events:** On Failure only
- **Channels:** Slack + Email
- **Slack:** #production-alerts channel
- **Email:** team-leads@example.com

**Why:** Reduce noise, focus on critical issues

---

### Example 2: Full Deployment Tracking

**Use Case:** Track all deployment activity

**Configuration:**

- **Events:** On Start, On Success, On Failure
- **Channels:** Discord
- **Discord:** #deployments channel

**Why:** Complete audit trail, team awareness

---

### Example 3: Multi-Channel Critical Alerts

**Use Case:** Ensure failures are noticed immediately

**Configuration:**

- **Events:** On Failure
- **Channels:** Discord + Slack + Email + Telegram
- **Recipients:** All team members

**Why:** Redundancy, immediate notification through multiple channels

---

### Example 4: Success Confirmations

**Use Case:** Confirm successful deployments

**Configuration:**

- **Events:** On Success only
- **Channels:** Email
- **Email:** project-manager@example.com

**Why:** Keep stakeholders informed of successful deployments

---

### Example 5: Development Environment

**Use Case:** Minimal notifications for development

**Configuration:**

- **Events:** On Failure only
- **Channels:** Discord
- **Discord:** #dev-deployments (low-priority channel)

**Why:** Only notify when something goes wrong, reduce notification fatigue

---

## Testing Notifications

### Test Your Configuration

After setting up notifications, test them:

1. **Trigger a test deployment:**
   - Make a small change to your repository
   - Push to trigger deployment
   - Or click "Deploy" manually

2. **Check notifications:**
   - Did you receive notifications on configured channels?
   - Are the messages formatted correctly?
   - Do they contain the expected information?

3. **Test failure notifications:**
   - Temporarily break a pipeline command
   - Trigger deployment
   - Verify failure notifications work
   - Fix the pipeline

### Discord Test

**Expected:**

- Message appears in configured channel
- Rich embed with project information
- Color matches status (blue/green/red)

### Slack Test

**Expected:**

- Message appears in configured channel
- Formatted attachment with details
- Proper color coding

### Email Test

**Expected:**

- Email received by all recipients
- Subject line correct
- HTML formatting works
- No spam folder issues

### Telegram Test

**Expected:**

- Message appears in chat/group/channel
- Formatted with details
- Immediate delivery

---

## Troubleshooting

### Discord Not Receiving Messages

**Check:**

1. Webhook URL is correct (no extra spaces)
2. Webhook hasn't been deleted from Discord
3. Bot has permissions to post in channel
4. Deploy Center server can reach Discord API

**Test webhook manually:**

```bash
curl -X POST https://discord.com/api/webhooks/YOUR_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

---

### Slack Not Receiving Messages

**Check:**

1. Incoming webhook is enabled
2. Webhook URL is correct
3. App hasn't been removed from workspace
4. Channel still exists

**Test webhook manually:**

```bash
curl -X POST https://hooks.slack.com/services/YOUR_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message"}'
```

---

### Email Not Being Delivered

**Check:**

1. SMTP credentials are correct
2. SMTP_PORT and SMTP_SECURE match your provider
3. Firewall allows outbound SMTP connections
4. Check spam folder
5. Email FROM address is not blacklisted

**Test SMTP connection:**

```bash
# Check if SMTP port is reachable
telnet smtp.gmail.com 587
```

**Check Deploy Center logs:**

```bash
# Look for email errors
tail -f logs/deploy-center.log | grep -i email
```

**Common SMTP errors:**

**Error:** `Authentication failed`

- Solution: Check username/password, enable app passwords

**Error:** `Connection timeout`

- Solution: Check firewall, verify SMTP_HOST and port

**Error:** `Invalid address`

- Solution: Verify email addresses are valid

---

### Telegram Not Working

**Check:**

1. Bot token is correct
2. Chat ID is correct (include `-` for groups)
3. Bot hasn't been blocked
4. Bot is admin in channel (for channels)

**Test bot manually:**

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<CHAT_ID>" \
  -d "text=Test message"
```

**Common issues:**

**Error:** `Forbidden: bot was blocked by the user`

- Solution: Unblock the bot in Telegram

**Error:** `Bad Request: chat not found`

- Solution: Verify Chat ID is correct

**Error:** `Forbidden: bot is not a member of the channel`

- Solution: Add bot as channel admin

---

### No Notifications at All

**Check:**

1. Notifications are enabled for the project
2. Events are selected (On Start, Success, Failure)
3. At least one channel is configured
4. Deploy Center logs for errors

**Debug steps:**

1. **Check project configuration:**
   - Edit project
   - Verify notifications section has channels configured
   - Ensure events are checked

2. **Check logs:**

   ```bash
   tail -f logs/deploy-center.log
   ```

   Look for notification-related errors

3. **Test individual channels:**
   - Disable all channels except one
   - Test deployment
   - Repeat for each channel

---

## Best Practices

### 1. Choose Events Wisely

**Don't over-notify:**

- Too many notifications = notification fatigue
- Team starts ignoring notifications

**Recommended:**

- Production: On Failure (always) + On Success (optional)
- Staging: On Failure only
- Development: On Failure only (or none)

---

### 2. Use Different Channels for Different Priorities

**High Priority (Failures):**

- Email to team leads
- Telegram for immediate alerts
- Slack/Discord to team channel

**Medium Priority (Success):**

- Discord/Slack team channel
- Email to stakeholders

**Low Priority (Started):**

- Discord/Slack to audit channel
- No email

---

### 3. Separate Environments

Create separate notification channels:

- `#prod-deployments` - Production only
- `#staging-deployments` - Staging only
- `#dev-deployments` - Development only

**Benefits:**

- Clear separation of concerns
- Easy to mute low-priority channels
- Better organization

---

### 4. Include Relevant Information

Make sure notifications contain:

- Project name
- Environment
- Branch
- Who triggered deployment
- Link to logs (if possible)

---

### 5. Test Regularly

- Test notifications when setting up
- Test again after changing configuration
- Verify webhooks haven't expired
- Check email deliverability periodically

---

### 6. Monitor Notification Delivery

- Check notification logs
- Verify messages are being received
- Look for patterns of failures
- Update credentials if needed

---

### 7. Rotate Secrets

- Change webhook URLs periodically
- Update SMTP passwords
- Regenerate bot tokens annually
- Document in team password manager

---

### 8. Documentation

Document for your team:

- Which channels are used
- What each notification means
- How to respond to failures
- Who to contact for issues

---

## Example Notification Workflow

### Production Deployment Notification Flow

**1. Deployment Starts:**

```text
Discord (#prod-deployments):
[STARTED] Production deployment started
Project: E-commerce Website
Branch: main
User: admin
```

**2. Deployment Succeeds:**

```text
Slack (#production):
[SUCCESS] PRODUCTION DEPLOYED
Project: E-commerce Website
Duration: 3m 45s
Deployed by: admin

Email (to: stakeholders@example.com):
Subject: Production Deployment Successful - E-commerce Website
[Detailed HTML email with deployment info and logs link]
```

**3. Deployment Fails:**

```text
Telegram (to DevOps team):
[FAILED] PRODUCTION DEPLOYMENT FAILED

Project: E-commerce Website
Failed at: Restart Application
Error: pm2 not found

[Link to logs]

Slack (#production-alerts):
@channel URGENT: Production deployment failed
[Detailed error information]

Email (to: team-leads@example.com):
Subject: [ALERT] Production Deployment Failed - E-commerce Website
[Detailed failure report]
```

---

## Advanced Configuration

### Conditional Notifications

**Future feature idea:**
Send notifications only for specific conditions:

- Only notify on production branch failures
- Only notify if deployment takes > 10 minutes
- Only notify during business hours
- Only notify specific people based on who triggered deployment

### Custom Notification Messages

**Future feature idea:**
Customize notification messages:

- Add custom fields
- Include deployment notes
- Add links to monitoring dashboards
- Include commit message

### Notification Rate Limiting

**Best practice:**

- Don't spam team with rapid notifications
- Batch similar notifications
- Implement quiet hours

---

## Integration Examples

### Integration with Monitoring Tools

**Example: Send notification + Update status page**

1. Deployment succeeds
2. Send success notification
3. Update status page (StatusPage.io, Uptime Robot)
4. Ping monitoring service

**Implementation:**

```bash
# Post-deployment pipeline step
curl -X POST https://api.statuspage.io/v1/pages/PAGE_ID/incidents \
  -H "Authorization: OAuth YOUR_TOKEN" \
  -d "status=resolved"
```

---

### Integration with Issue Tracking

**Example: Create issue on deployment failure**

1. Deployment fails
2. Send failure notification
3. Create GitHub/Jira issue automatically

**Implementation:**
Use webhooks or API calls in post-deployment pipeline

---

## Security Considerations

### Protect Webhook URLs

- Don't commit webhook URLs to Git
- Store in environment variables
- Use secret management
- Rotate regularly

### Limit Notification Content

- Don't include sensitive data
- Don't expose credentials
- Sanitize error messages
- Be careful with environment variables

### Access Control

- Only admins can configure notifications
- Limit who can trigger deployments
- Audit notification configuration changes

---

## FAQ

### Can I use multiple Discord channels?

Currently, you can configure one webhook per project. To notify multiple channels:

- Create a Discord webhook that posts to multiple channels (using Discord bots)
- Or create separate projects for each environment

### Do notifications work for manual deployments?

Yes! Notifications trigger for both automatic (webhook) and manual deployments.

### Can I disable notifications temporarily?

Yes, edit your project and uncheck the notification events. Save to disable. Re-enable anytime.

### What if my webhook expires?

Webhooks can be deleted or regenerated. Simply update the webhook URL in Deploy Center project settings.

### Can I test notifications without deploying?

Currently, you need to trigger an actual deployment. Consider:

- Creating a test project
- Making a small change to trigger deployment
- Using a dedicated test environment

---

## Need Help?

- **Documentation:** [Deploy Center Docs](../README.md)
- **FAQ:** [Frequently Asked Questions](../FAQ.md)
- **Issues:** [GitHub Issues](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues)

---

*Last updated: January 2026*
