# Examples

This directory contains example configurations for Deploy Center to help you get started quickly.

## 📁 Directory Structure

```tree
examples/
├── pipelines/          # Example pipeline configurations
├── notifications/      # Example notification setups
├── projects/          # Complete project examples
└── README.md          # This file
```

---

## 🚀 Pipeline Examples

Example pipeline configurations for different project types.

### Available Examples

| File | Description | Use Case |
|------|-------------|----------|
| **nodejs-backend.json** | Node.js/TypeScript backend | API servers, microservices |
| **react-frontend.json** | React/Vue static site | SPAs, frontend apps |

### How to Use

1. **View Example:**

   ```bash
   cat examples/pipelines/nodejs-backend.json
   ```

2. **Create Project via API:**

   ```bash
   curl -X POST http://localhost:3000/api/projects \
     -H "Content-Type: application/json" \
     -H "Cookie: access_token=YOUR_TOKEN" \
     -d @examples/pipelines/nodejs-backend.json
   ```

3. **Customize for Your Project:**
   - Change `Name` to your project name
   - Update `RepoUrl` to your GitHub repository
   - Modify `Pipeline` steps as needed
   - Configure `Notifications` with your webhooks

---

## 🔔 Notification Examples

Example configurations for different notification platforms.

### Available Examples

| File | Platform | Setup Difficulty |
|------|----------|-----------------|
| **discord-notification.json** | Discord | Easy ⭐ |
| **slack-notification.json** | Slack | Easy ⭐ |
| **email-notification.json** | Email (SMTP) | Medium ⭐⭐ |

### Quick Setup

**Discord:**

```json
{
  "Discord": {
    "Enabled": true,
    "WebhookUrl": "https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN"
  }
}
```

**Slack:**

```json
{
  "Slack": {
    "Enabled": true,
    "WebhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  }
}
```

**Email:**

```json
{
  "Email": {
    "Enabled": true,
    "Host": "smtp.gmail.com",
    "Port": 587,
    "Secure": false,
    "User": "your-email@gmail.com",
    "Password": "your-app-password",
    "From": "Deploy Center <noreply@yourapp.com>",
    "To": ["team@example.com"]
  }
}
```

---

## 📦 Complete Project Examples

Full-featured project configurations with all bells and whistles.

### Available Examples

| File | Description |
|------|-------------|
| **full-stack-project.json** | Complete full-stack app (backend + frontend) with all features |

**Includes:**

- ✅ Multi-step pipeline (18 steps)
- ✅ Multiple notification channels
- ✅ Environment-specific steps
- ✅ Health checks
- ✅ Backup & rollback
- ✅ Database migrations

---

## 💡 Tips

### Pipeline Best Practices

1. **Always include health checks:**

   ```json
   {
     "Name": "Health Check",
     "Command": "curl -f http://localhost:3000/health || exit 1",
     "Timeout": 15000
   }
   ```

2. **Use conditional steps for environment-specific tasks:**

   ```json
   {
     "Name": "Run Tests",
     "Command": "npm test",
     "RunIf": "{{Environment}} === 'staging'"
   }
   ```

3. **Set appropriate timeouts:**
   - Git operations: 30s
   - npm install: 5min
   - Build: 3-5min
   - Tests: 2min

4. **Enable continue-on-error for non-critical steps:**

   ```json
   {
     "Name": "Clear Cache",
     "Command": "npm run cache:clear",
     "ContinueOnError": true
   }
   ```

### Notification Best Practices

1. **Start with one channel** (Discord is easiest)
2. **Test webhooks** before production
3. **Use multiple channels** for critical projects
4. **Set up email** for overnight deployments

---

## 📚 Learn More

- [Pipeline Configuration Guide](../docs/PIPELINE_GUIDE.md)
- [Notification Setup Guide](../docs/NOTIFICATION_GUIDE.md)
- [API Documentation](../docs/POSTMAN_GUIDE.md)

---

## 🤝 Contributing

Have a useful example? Submit a PR!

1. Create your example file
2. Test it thoroughly
3. Add documentation
4. Submit pull request

---

**Happy deploying! 🚀**
