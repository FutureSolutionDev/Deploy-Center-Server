# Notifications Setup - Stay Informed About Deployments

This guide explains how to configure deployment notifications in Deploy Center to keep your team informed about deployment status.

## Table of Contents

1. [Overview](#overview)
2. [Discord Setup](#discord-setup)
3. [Slack Setup](#slack-setup)
4. [Email Setup](#email-setup)
5. [Telegram Setup](#telegram-setup)
6. [Notification Events](#notification-events)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Deploy Center sends notifications to Discord, Slack, Email, and Telegram about deployment events.

### Supported Channels

All four notification channels are **fully implemented and available**:

| Channel | Status | Setup | Best For |
|---------|--------|-------|----------|
| Discord | ✅ Available | Easy | Dev teams |
| Slack | ✅ Available | Easy | Enterprise |
| Email | ✅ Available | Medium | Stakeholders |
| Telegram | ✅ Available | Easy | Mobile teams |

---

## Discord Setup

### Create Webhook

11. Open Discord server
12. Right-click channel → Edit Channel → Integrations
13. Create Webhook
14. Copy Webhook URL

### Configure

**Global (`.env`):**

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

**Per-Project:**

```json
{
  "Notifications": {
    "Discord": {
      "Enabled": true,
      "WebhookUrl": "https://discord.com/api/webhooks/..."
    }
  }
}
```

---

## Slack Setup

### Create Webhook

1. Slack Apps → Incoming Webhooks
2. Add to Slack
3. Select channel
4. Copy Webhook URL

### Configure

```json
{
  "Notifications": {
    "Slack": {
      "Enabled": true,
      "WebhookUrl": "https://hooks.slack.com/services/..."
    }
  }
}
```

---

## Email Setup

### SMTP Providers

**Gmail:** Host `smtp.gmail.com`, Port `587` (requires App Password)  
**Microsoft 365:** Host `smtp.office365.com`, Port `587`  
**SendGrid:** Host `smtp.sendgrid.net`, Port `587`

### Configure

```json
{
  "Notifications": {
    "Email": {
      "Enabled": true,
      "Host": "smtp.gmail.com",
      "Port": 587,
      "Secure": true,
      "User": "your-email@gmail.com",
      "Password": "app-password",
      "From": "Deploy Center <noreply@company.com>",
      "To": ["team@company.com"]
    }
  }
}
```

**Security:** Use environment variables for passwords!

---

## Telegram Setup

### Create Bot

1. Telegram → @BotFather
2. `/newbot`
3. Choose name and username
4. Copy Bot Token

### Get Chat ID

**Personal:**

1. Start chat with bot
2. Send message
3. Visit: `https://api.telegram.org/bot<TOKEN HERE>/getUpdates`

```bash
curl "https://api.telegram.org/bot<TOKEN HERE>/getUpdates"
# Example:
# curl "https://api.telegram.org/bot123456789:ABC.../getUpdates"
```

4. Find `chat.id`

**Group:**

1. Add bot to group
2. Send message
3. Use getUpdates (chat ID will be negative)

### Configure

```json
{
  "Notifications": {
    "Telegram": {
      "Enabled": true,
      "BotToken": "123456789:ABC...",
      "ChatId": "123456789"
    }
  }
}
```

---

## Notification Events

```json
{
  "NotifyOnStart": false,     // Queued + In Progress
  "NotifyOnSuccess": true,    // Success
  "NotifyOnFailure": true     // Failed
}
```

### Recommendations

**Production:** Success + Failure  
**Staging:** Failure only  
**Development:** Failure only

---

## Best Practices

### ✅ Do

- Use different channels per environment
- Configure appropriate events (avoid noise)
- Limit email recipients
- Test after setup
- Use environment variables for secrets
- Monitor delivery logs

### ❌ Don't

- Send too many notifications (fatigue)
- Share webhooks/tokens publicly
- Use same channel for all environments
- Ignore rate limits
- Forget to test

---

## Troubleshooting

### Discord

**Test:**

```bash
curl -X POST "https://discord.com/api/webhooks/..." \
  -H "Content-Type: application/json" \
  -d '{"content": "Test"}'
```

**Errors:**

- 401: Webhook invalid
- 404: Webhook deleted
- 429: Rate limited (30/min)

### Slack

**Test:**

```bash
curl -X POST "https://hooks.slack.com/services/..." \
  -H "Content-Type: application/json" \
  -d '{"text": "Test"}'
```

### Email

**Gmail Issues:**

- Must use App Password (not regular password)
- 2FA must be enabled

**Check:**

```bash
telnet smtp.gmail.com 587
```

### Telegram

**Test:**

```bash
curl "https://api.telegram.org/bot<TOKEN HERE>/getMe"
# Example:
# curl "https://api.telegram.org/bot123456789:ABC.../getMe"
```

**No messages:**

- Send `/start` to bot (personal)
- Ensure bot in group (groups)

---

## Multi-Channel Strategy

Enable multiple channels:

```json
{
  "Notifications": {
    "Discord": { "Enabled": true, ... },
    "Slack": { "Enabled": true, ... },
    "Email": { "Enabled": true, ... },
    "Telegram": { "Enabled": true, ... }
  }
}
```

**Use Cases:**

- Team (Discord) + Management (Email)
- Primary (Slack) + Backup (Email)
- Multi-region (Telegram + Slack)

---

## Related Documentation

- [Creating Projects](./creating-projects.md)
- [Deployment Workflows](./deployment-workflows.md)
- [Webhook Setup](./webhooks.md)

---

**Need Help?** Join our [Discord community](https://discord.gg/j8edhTZy) or [open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).
