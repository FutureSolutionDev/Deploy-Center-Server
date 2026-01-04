# Deploy Center - User Guides

Welcome to the Deploy Center user guides! These guides are designed to help you get the most out of Deploy Center, whether you're setting up your first project or configuring advanced deployment pipelines.

## 📚 Available Guides

### Getting Started

#### [Creating Projects](./creating-projects.md) ⭐ **Start Here**
A comprehensive guide to creating and configuring your first project in Deploy Center. This guide covers:
- Project basic information (name, repository, branch)
- Configuration settings (environment, auto-deploy, variables)
- Pre-deployment pipeline (build steps, tests)
- Post-deployment pipeline (service restarts, migrations)
- Notifications setup
- Webhook configuration
- Real-world examples for different project types

**Who should read this:** Everyone new to Deploy Center

**Time to complete:** 15-20 minutes

---

### Deployment Workflows

#### [Understanding Deployments](./deployment-workflows.md)
Learn how deployments work in Deploy Center:
- Deployment lifecycle and phases
- Manual vs automatic deployments
- Deployment queue and concurrency
- Viewing deployment logs
- Troubleshooting failed deployments

**Who should read this:** Users who want to understand the deployment process

**Time to complete:** 10 minutes

---

### Advanced Configuration

#### [Pipeline Configuration](./pipeline-configuration.md)
Master the art of creating powerful deployment pipelines:
- Pre-deployment vs post-deployment pipelines
- Conditional step execution
- Using environment variables in commands
- Error handling and rollback strategies
- Pipeline best practices
- Advanced examples (monorepos, microservices)

**Who should read this:** Users who need custom deployment logic

**Time to complete:** 20 minutes

---

#### [Environment Variables](./environment-variables.md)
Everything about managing environment variables:
- Adding and editing variables
- Using variables in pipelines
- Using variables in your application
- Security considerations
- Common variable patterns

**Who should read this:** Developers configuring application settings

**Time to complete:** 10 minutes

---

### Repository Integration

#### [SSH Key Management](./ssh-keys.md)
Working with private Git repositories:
- Generating SSH keys
- Adding deploy keys to GitHub/GitLab/Bitbucket
- Key rotation and security
- Troubleshooting SSH connection issues

**Who should read this:** Users deploying from private repositories

**Time to complete:** 10 minutes

---

#### [Webhook Setup](./webhooks.md)
Configure automatic deployments with webhooks:
- GitHub webhook configuration
- GitLab webhook configuration
- Bitbucket webhook configuration
- Webhook security and verification
- Testing webhooks
- Troubleshooting webhook issues

**Who should read this:** Users setting up auto-deploy

**Time to complete:** 10 minutes

---

### Notifications

#### [Notifications Setup](./notifications.md)
Get notified about your deployments:
- Discord notifications
- Slack notifications
- Email notifications
- Telegram notifications
- Customizing notification content
- Notification event types

**Who should read this:** Teams who want deployment notifications

**Time to complete:** 15 minutes

---

## 🎯 Quick Navigation by Task

### I want to...

**Deploy a static website**
1. [Creating Projects](./creating-projects.md) - Example 1: Simple Static Website
2. [Webhook Setup](./webhooks.md) - For auto-deploy

**Deploy a React application**
1. [Creating Projects](./creating-projects.md) - Example 2: React Application
2. [Pipeline Configuration](./pipeline-configuration.md) - Build optimization
3. [Environment Variables](./environment-variables.md) - API URLs, etc.

**Deploy a Node.js API**
1. [Creating Projects](./creating-projects.md) - Example 3: Node.js API with PM2
2. [SSH Key Management](./ssh-keys.md) - If private repo
3. [Pipeline Configuration](./pipeline-configuration.md) - Testing and restarts

**Deploy a PHP/Laravel application**
1. [Creating Projects](./creating-projects.md) - Example 5: PHP Laravel Application
2. [Pipeline Configuration](./pipeline-configuration.md) - Migrations and caching
3. [Environment Variables](./environment-variables.md) - Database credentials

**Deploy to multiple servers**
1. [Creating Projects](./creating-projects.md) - Example 4: Multi-Server Deployment
2. [Deployment Workflows](./deployment-workflows.md) - Understanding parallel deployments

**Set up private repository**
1. [SSH Key Management](./ssh-keys.md) - Generate and configure SSH keys
2. [Creating Projects](./creating-projects.md) - Create project with SSH

**Get deployment notifications**
1. [Notifications Setup](./notifications.md) - Configure your notification channel

---

## 📖 Learning Path

### For Beginners

1. **Week 1:** Start with [Creating Projects](./creating-projects.md)
   - Create your first simple project
   - Run your first manual deployment
   - Watch the deployment logs

2. **Week 2:** Set up automation
   - Follow [Webhook Setup](./webhooks.md)
   - Configure auto-deploy
   - Push code and watch it deploy automatically

3. **Week 3:** Add notifications
   - Follow [Notifications Setup](./notifications.md)
   - Get notified about deployments
   - Share with your team

### For Intermediate Users

1. **Understand the process:** Read [Deployment Workflows](./deployment-workflows.md)
2. **Master pipelines:** Study [Pipeline Configuration](./pipeline-configuration.md)
3. **Manage secrets:** Learn [Environment Variables](./environment-variables.md)

### For Advanced Users

1. **Complex pipelines:** Advanced examples in [Pipeline Configuration](./pipeline-configuration.md)
2. **Security hardening:** Review all security sections
3. **Multi-environment setups:** Multiple projects with different configs

---

## 🔍 Troubleshooting Guide

### Common Issues

**Deployment fails at clone step**
→ Check [SSH Key Management](./ssh-keys.md)

**Build commands not working**
→ See pipeline examples in [Creating Projects](./creating-projects.md)

**Webhook not triggering**
→ Follow [Webhook Setup](./webhooks.md) troubleshooting section

**Variables not available**
→ Review [Environment Variables](./environment-variables.md)

**Post-deployment commands fail**
→ Check permissions in [Pipeline Configuration](./pipeline-configuration.md)

---

## 💡 Tips for Success

### Best Practices

1. **Start Simple**
   - Begin with a basic project
   - Add complexity gradually
   - Test each feature before moving to the next

2. **Test Locally First**
   - Run all commands on your server manually first
   - Make sure they work before adding to pipeline
   - Verify permissions and paths

3. **Use Version Control**
   - Keep your deployment configs in Git
   - Document your pipeline steps
   - Track changes over time

4. **Monitor Your Deployments**
   - Watch the first few deployments closely
   - Set up notifications
   - Review logs for warnings

5. **Security First**
   - Use environment variables for secrets
   - Never commit credentials
   - Rotate SSH keys regularly
   - Limit deployment user permissions

---

## 📚 Additional Resources

### Documentation

- [API Reference](../api/README.md) - For programmatic access
- [Configuration Guide](../configuration.md) - Server configuration
- [Troubleshooting](../troubleshooting.md) - Common issues
- [FAQ](../FAQ.md) - Frequently asked questions

### Video Tutorials

*(Coming soon)*
- Creating Your First Project
- Setting Up Webhooks
- Advanced Pipeline Configuration
- Multi-Server Deployments

---

## 🤝 Getting Help

### Before Asking for Help

1. **Check the guides** - Your answer might be here
2. **Review deployment logs** - Error messages are helpful
3. **Test manually** - Try commands on your server directly
4. **Search existing issues** - Someone might have had the same problem

### Where to Get Help

- **Documentation:** You're here! 📖
- **GitHub Issues:** Report bugs or request features
- **GitHub Discussions:** Ask questions and share tips
- **Community Forum:** Connect with other users

---

## 🎓 Glossary

**Deployment:** The process of copying your code from Git to your server

**Pipeline:** A series of commands that run during deployment

**Pre-Deployment:** Commands that run before files are synced (build, test)

**Post-Deployment:** Commands that run after files are synced (restart, migrate)

**Webhook:** A way for Git platforms to notify Deploy Center of new commits

**SSH Key:** Encrypted key used to authenticate with Git repositories

**Environment Variable:** Configuration value available during deployment

**Rollback:** Restoring the previous version after a failed deployment

---

**Need help?** Start with [Creating Projects](./creating-projects.md) or jump to the guide that matches your needs!

---

*Last updated: January 2026*
