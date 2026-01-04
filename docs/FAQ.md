# Frequently Asked Questions (FAQ)

Common questions and answers about Deploy Center.

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Projects & Configuration](#projects--configuration)
- [Deployments](#deployments)
- [Webhooks](#webhooks)
- [SSH Keys](#ssh-keys)
- [Pipelines](#pipelines)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Performance](#performance)

---

## General Questions

### What is Deploy Center?

Deploy Center is a self-hosted deployment automation platform that helps you deploy your applications from Git repositories to your servers automatically or manually.

### What types of projects can I deploy?

Deploy Center supports:

- Node.js applications (Express, NestJS, etc.)
- React/Vue/Angular applications
- Next.js applications
- Static websites (HTML/CSS/JS)
- PHP applications (Laravel, WordPress, etc.)
- Docker applications
- Any other project type using custom pipelines

### Is Deploy Center free?

Yes! Deploy Center is open-source and free to use under the MIT License.

### Can I deploy to multiple servers?

Yes! You can specify multiple deployment paths, and Deploy Center will deploy to all of them simultaneously.

### Does Deploy Center support GitHub/GitLab/Bitbucket?

Yes! Deploy Center works with any Git platform that supports webhooks (GitHub, GitLab, Bitbucket, and self-hosted Git servers).

---

## Installation & Setup

### What are the system requirements?

**Minimum requirements:**

- Node.js 18.x or higher
- MySQL 8.0+ or MariaDB 10.6+
- 1GB RAM
- 10GB disk space

**Recommended:**

- 2GB+ RAM
- SSD storage
- Linux server (Ubuntu/Debian/CentOS)

### Can I run Deploy Center on Windows?

Yes! Deploy Center supports Windows, but some features work better on Linux:

- rsync is not available on Windows (uses copy instead)
- Some shell commands may need adjustment
- SSH deployment is better on Linux

**Recommendation:** Use Linux for production deployments.

### Do I need to install Git on the server?

Yes! Git must be installed on the server where Deploy Center is running to clone repositories.

```bash
# Ubuntu/Debian
sudo apt install git

# CentOS/RHEL
sudo yum install git

# Windows
Download from https://git-scm.com/
```

### Can I use PostgreSQL instead of MySQL?

Currently, Deploy Center only supports MySQL/MariaDB. PostgreSQL support may be added in the future.

### How do I update Deploy Center?

```bash
# Pull latest changes
git pull origin main

# Update dependencies
cd server && npm install
cd ../client && npm install

# Build
cd ../client && npm run build
cd ../server && npm run build

# Restart
pm2 restart deploy-center
```

---

## Projects & Configuration

### What's the difference between ProjectPath and DeploymentPaths?

- **ProjectPath:** Legacy single deployment path (still supported for backward compatibility)
- **DeploymentPaths:** Array of paths for multiple deployments (recommended)

When creating a project, use DeploymentPaths for flexibility.

### Can I deploy the same project to staging and production?

Yes! Create two separate projects:

1. **Staging Project:** Deploy from `develop` branch
2. **Production Project:** Deploy from `main` branch

Each project can have different configurations and deployment paths.

### How do I deploy only specific folders from my repository?

Use the **Build Output Directory** setting:

- Set it to `build`, `dist`, or your build folder
- Only that folder will be deployed
- Source code stays on the build server

Alternatively, use **Sync Ignore Patterns** to exclude folders.

### Can I use environment-specific configurations?

Yes! Use environment variables:

```bash
# Create different variables for each environment
# Production project
NODE_ENV=production
DATABASE_URL=production-database-url

# Staging project
NODE_ENV=staging
DATABASE_URL=staging-database-url
```

### What happens if I delete a project?

- Project configuration is removed from database
- Deployment history is deleted
- **Files on server are NOT deleted** (for safety)
- You need to manually clean up server files if needed

---

## Deployments

### What happens during a deployment?

1. **Clone:** Repository is cloned to a temporary directory
2. **Pre-Deployment Pipeline:** Build commands run (npm install, npm build, etc.)
3. **Sync:** Files are copied to production paths
4. **Post-Deployment Pipeline:** Server commands run (pm2 restart, etc.)
5. **Cleanup:** Temporary directory is removed

### Can I trigger deployments manually?

Yes! Click the "Deploy" button on the project page, even if auto-deploy is enabled.

### How long do deployments take?

Depends on:

- Repository size
- Number of dependencies
- Build time
- Network speed
- Number of deployment paths

**Typical times:**

- Small static site: 10-30 seconds
- React app: 1-3 minutes
- Large Node.js app: 3-5 minutes

### Can multiple deployments run at the same time?

Yes! Deploy Center can handle concurrent deployments for different projects. Each deployment runs in isolation.

### What if a deployment fails?

- Check the deployment logs for error messages
- Fix the issue in your code or configuration
- Trigger a new deployment
- If post-deployment fails and rollback is enabled, previous version is restored

### Can I cancel a running deployment?

Not currently. Once started, a deployment must complete or fail. This feature may be added in the future.

---

## Webhooks

### Why isn't my webhook triggering deployments?

**Common issues:**

1. **Incorrect webhook URL**
   - Check URL matches exactly
   - Include `/api/webhooks/github` or `/api/webhooks/github/ProjectName`

2. **Wrong secret**
   - Verify webhook secret matches exactly
   - Secrets are case-sensitive

3. **Wrong branch**
   - Webhook triggers only for configured branch
   - Check branch name matches

4. **Auto-deploy disabled**
   - Enable auto-deploy in project settings

5. **Webhook not configured on Git platform**
   - Verify webhook exists in repository settings

### How do I test if webhooks are working?

**Method 1:** Push to repository and check deployment logs

**Method 2:** Use webhook test feature on GitHub/GitLab

1. Go to repository → Settings → Webhooks
2. Click on your webhook
3. Click "Recent Deliveries"
4. Check response status

**Method 3:** Check Deploy Center logs for incoming webhook requests

### Can I use the same webhook for multiple projects?

Yes! Use the generic webhook endpoint:

- `https://your-domain/api/webhooks/github`
- Deploy Center will identify the project from the repository URL

Or use project-specific webhooks:

- `https://your-domain/api/webhooks/github/ProjectName`

### Do I need different webhooks for GitHub and GitLab?

No! The same webhook endpoint works for both:

- GitHub: `/api/webhooks/github`
- GitLab: `/api/webhooks/github` (works for GitLab too)

---

## SSH Keys

### When do I need SSH keys?

SSH keys are required for:

- Private repositories
- Repositories requiring authentication
- Organizations with strict access control

Public repositories can use HTTPS without SSH keys.

### How do I generate SSH keys?

Use the built-in SSH key manager:

1. Go to project details
2. Find "SSH Key Management"
3. Click "Generate SSH Key"
4. Copy the public key
5. Add to GitHub/GitLab deploy keys

### Can I use my own SSH key?

Currently, Deploy Center generates and manages SSH keys automatically. Using custom SSH keys is not supported yet.

### Do I need separate SSH keys for each project?

No! The same SSH key can be used for multiple projects, or you can generate unique keys per project for better security.

### How are SSH keys stored?

SSH keys are encrypted using AES-256-GCM and stored in the database:

- Private key: Encrypted
- Public key: Plain text
- IV and auth tag: Stored separately

---

## Pipelines

### What's the difference between pre and post-deployment pipelines?

**Pre-Deployment Pipeline:**

- Runs in **temporary directory**
- Runs **before** files are synced
- Used for: build, test, compile
- Example: `npm install`, `npm run build`

**Post-Deployment Pipeline:**

- Runs in **production directory**
- Runs **after** files are synced
- Used for: restart services, migrations, cache clearing
- Example: `pm2 restart`, `php artisan migrate`

### Can I use sudo in pipeline commands?

Yes, but the deploy user must have sudo permissions:

```bash
# Give deploy user sudo access (no password)
sudo visudo

# Add this line:
deploy-user ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/pm2, /usr/bin/nginx
```

**Security note:** Limit sudo access to only necessary commands.

### How do I run commands conditionally?

Use the **RunIf** field:

```bash
# Only in production
$ENVIRONMENT == 'production'

# Only on main branch
$BRANCH == 'main'

# When specific file changed
$CHANGED_FILES contains 'package.json'
```

### What variables are available in pipelines?

Built-in variables:

- `$ENVIRONMENT` - Environment name
- `$BRANCH` - Git branch name
- `$COMMIT` - Git commit hash
- `$PROJECT_NAME` - Project name
- `$DEPLOYMENT_PATH` - Current deployment path

Plus all your custom environment variables!

### Can I use multi-line commands?

Yes! Each command runs separately:

```bash
# Step 1
npm install
npm run test
npm run build

# All three commands run in sequence
```

---

## Environment Variables

### How do I use variables in my application?

**Node.js:**

```javascript
const apiUrl = process.env.API_URL;
const port = process.env.PORT || 3000;
```

**React (.env file):**

```env
REACT_APP_API_URL=${API_URL}
REACT_APP_ENV=${ENVIRONMENT}
```

**PHP:**

```php
$apiUrl = getenv('API_URL');
$env = getenv('ENVIRONMENT');
```

### Can I use variables in pipeline commands?

Yes!

```bash
echo "Deploying to $ENVIRONMENT"
echo "API URL: $API_URL"
curl -X POST $WEBHOOK_URL
```

### How do I manage secrets securely?

**Best practices:**

1. **Use environment variables** instead of hardcoding
2. **Don't commit secrets** to Git
3. **Rotate secrets regularly**
4. **Use different secrets** for each environment
5. **Limit access** to production secrets

**For highly sensitive data:** Consider using a dedicated secret manager (HashiCorp Vault, AWS Secrets Manager).

### Can I have different variables per environment?

Yes! Create separate projects for each environment:

- Production project with production variables
- Staging project with staging variables
- Development project with development variables

---

## Troubleshooting

### Deployment fails with "Permission denied"

**Solution:**

```bash
# Give deploy user write permissions
sudo chown -R deploy-user:deploy-user /var/www/myapp
sudo chmod -R 755 /var/www/myapp
```

### "npm: command not found" in pipeline

**Solution:** Node.js is not in PATH or not installed on the server.

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Or add to PATH in pipeline
export PATH="/usr/local/bin:$PATH"
npm install
```

### Files not updating after deployment

**Possible causes:**

1. **Browser cache**
   - Hard refresh (Ctrl+F5)
   - Clear browser cache

2. **Server cache**
   - Restart web server
   - Clear application cache

3. **Wrong deployment path**
   - Verify path in project settings
   - Check web server document root

4. **Sync ignore patterns**
   - Check if files are being excluded

### "Repository not found" or authentication failed

**For HTTPS:**

- Verify repository URL is correct
- For private repos, use SSH instead

**For SSH:**

- Generate SSH key in Deploy Center
- Add public key to repository deploy keys
- Verify key has read access

### Post-deployment rollback keeps happening

**Reasons:**

1. **Command fails:** Fix the failing command
2. **Wrong permissions:** Check sudo access
3. **Service not found:** Verify service name
4. **Path issues:** Use absolute paths

**Debug:** Run commands manually on server first.

---

## Security

### Is Deploy Center secure?

Deploy Center implements several security measures:

- JWT authentication
- Password hashing (bcrypt)
- SSH key encryption (AES-256-GCM)
- Webhook signature verification
- SQL injection protection
- XSS protection
- Rate limiting

### Should I expose Deploy Center to the internet?

**Recommended:** Use a firewall or VPN:

- Only allow webhook IPs from GitHub/GitLab
- Use VPN for admin access
- Enable 2FA (if available)
- Use strong passwords

### How do I secure webhooks?

1. **Use webhook secrets:** Always set a secret
2. **Verify signatures:** Deploy Center does this automatically
3. **Use HTTPS:** Encrypt webhook data in transit
4. **IP whitelist:** Only allow GitHub/GitLab IPs

### What user should run Deploy Center?

**Development:** Your user account is fine

**Production:** Create a dedicated user:

```bash
sudo useradd -r -s /bin/bash -m deploy-center
sudo su - deploy-center
# Install and run Deploy Center as this user
```

---

## Performance

### How can I speed up deployments?

1. **Use `npm ci`** instead of `npm install`
2. **Cache dependencies** on server
3. **Use build output only** (don't deploy source)
4. **Optimize build** process
5. **Use ignore patterns** to skip unnecessary files
6. **Parallel deployments** to multiple servers

### Can Deploy Center handle large deployments?

Yes! Deploy Center has been tested with:

- Repositories up to 5GB
- 100+ concurrent projects
- Multiple simultaneous deployments

**Tips for large repos:**

- Use shallow clones (git clone --depth=1)
- Deploy only build output
- Use rsync for faster syncs

### How many projects can I have?

There's no hard limit. Deploy Center can handle:

- 100+ projects easily
- 1000+ projects with proper server resources

**Resource requirements scale with:**

- Number of active deployments
- Repository sizes
- Build complexity

### Database getting too large?

Clean up old deployment logs:

```sql
-- Delete deployments older than 90 days
DELETE FROM Deployments WHERE CreatedAt < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Keep only last 100 deployments per project
-- (Manual cleanup script needed)
```

Consider implementing automatic cleanup in the future.

---

## Still Have Questions?

- **Documentation:** [/docs](./README.md)
- **Guides:** [/docs/guides](./guides/README.md)
- **GitHub Issues:** Report bugs or request features
- **GitHub Discussions:** Ask the community

---

*Last updated: January 2026*
