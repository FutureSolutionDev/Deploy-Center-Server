---
name: Bug Report
about: Report a bug to help us improve Deploy Center
title: '[BUG] '
labels: 'bug'
assignees: ''
---

## 🐛 **Bug Description**

A clear and concise description of what the bug is.

---

## 📝 **Steps to Reproduce**

Steps to reproduce the behavior:

1. Go to '...'
2. Click on '...'
3. Execute command '...'
4. See error

---

## ✅ **Expected Behavior**

A clear and concise description of what you expected to happen.

---

## ❌ **Actual Behavior**

A clear and concise description of what actually happened.

---

## 📸 **Screenshots**

If applicable, add screenshots to help explain your problem.

---

## 🖥️ **Environment**

**Server Environment:**
- **OS:** [e.g., Ubuntu 22.04 LTS, Windows 11, macOS Ventura]
- **Node.js Version:** [e.g., v18.17.0] (Run: `node --version`)
- **npm Version:** [e.g., 9.8.1] (Run: `npm --version`)
- **Deploy Center Version:** [e.g., v2.0.0] (Check package.json)
- **Database:** [e.g., MariaDB 10.11.2] (Run: `mysql --version`)

**Client Environment (if applicable):**
- **Browser:** [e.g., Chrome 120, Firefox 121]
- **OS:** [e.g., Windows 11]

---

## 📋 **Configuration**

**Relevant configuration (remove sensitive data):**

```env
# Example from .env (REMOVE SECRETS!)
NODE_ENV=production
PORT=3000
DB_DIALECT=mariadb
# ... other non-sensitive config
```

**Project Configuration (if relevant):**

```json
{
  "Branch": "main",
  "AutoDeploy": true,
  "Pipeline": [
    // Your pipeline config
  ]
}
```

---

## 📊 **Logs**

**Error Logs:**

```
Paste relevant error logs here from:
- logs/error-*.log
- logs/combined-*.log
- logs/deployment-*.log
- PM2 logs (if using PM2)
- Browser console (if frontend issue)
```

**Stack Trace (if available):**

```
Paste full stack trace here
```

---

## 🔄 **Reproducibility**

- [ ] This bug happens **every time**
- [ ] This bug happens **sometimes**
- [ ] This bug happened **only once**

**Frequency:** [e.g., Every deployment, Only on production, Randomly]

---

## 💡 **Possible Solution**

If you have any ideas on how to solve this issue, please share them here.

---

## 🔗 **Related Issues**

Are there any related issues or pull requests? Link them here.

- Fixes #
- Related to #

---

## ✅ **Checklist**

Before submitting, please check:

- [ ] I have searched for similar issues and found none
- [ ] I have included all the information requested above
- [ ] I have removed any sensitive data (passwords, API keys, secrets)
- [ ] I am using a supported version of Deploy Center
- [ ] I have reviewed the [troubleshooting guide](../docs/INSTALLATION.md#troubleshooting)

---

## 📧 **Additional Context**

Add any other context about the problem here.

---

**Thank you for helping improve Deploy Center!** 🚀
