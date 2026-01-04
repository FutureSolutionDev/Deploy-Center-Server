# Creating a New Project - Complete Guide

This guide will walk you through creating and configuring a new project in Deploy Center step by step.

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Step 1: Basic Information](#step-1-basic-information)
3. [Step 2: Configuration](#step-2-configuration)
4. [Step 3: Pre-Deployment Pipeline](#step-3-pre-deployment-pipeline)
5. [Step 4: Post-Deployment Pipeline](#step-4-post-deployment-pipeline)
6. [Step 5: Notifications](#step-5-notifications)
6. [After Creating the Project](#after-creating-the-project)
7. [Common Examples](#common-examples)

---

## Before You Start

Before creating a project, make sure you have:

- ✅ Access to your Git repository (GitHub, GitLab, etc.)
- ✅ Repository URL (HTTPS or SSH)
- ✅ The branch you want to deploy (e.g., `main`, `master`, `production`)
- ✅ Server path where you want to deploy your files
- ✅ SSH access to your deployment server (if deploying remotely)

---

## Step 1: Basic Information

### Project Name

**What it is:** A friendly name to identify your project.

**Example:** `My Website`, `API Server`, `Blog`

**Tips:**

- Use a descriptive name that's easy to remember
- Avoid special characters
- This name will appear in the dashboard and deployment logs

---

### Description (Optional)

**What it is:** A brief explanation of what this project does.

**Example:** `Company website with blog and contact form`

**Tips:**

- Help your team understand what this project is for
- Mention important details like the tech stack if useful

---

### Repository URL

**What it is:** The URL of your Git repository.

**Examples:**

- HTTPS: `https://github.com/username/repository.git`
- SSH: `git@github.com:username/repository.git`

**Tips:**

- For **public repositories**, use HTTPS URL
- For **private repositories**, you'll need to set up SSH keys (see SSH Key Management section)
- Make sure the URL is correct - test it by cloning manually first

---

### Branch

**What it is:** The Git branch you want to deploy.

**Common branches:**

- `main` or `master` - Main production code
- `production` - Production-ready code
- `develop` - Development version
- `staging` - Pre-production testing

**Tips:**

- Most projects use `main` or `master`
- Use different branches for different environments (e.g., `staging` branch for staging server)

---

### Deployment Paths

**What it is:** One or more server paths where your files will be deployed.

**Examples:**

- `/var/www/html` - Standard web server path
- `/home/user/apps/myapp` - Custom application path
- `C:\inetpub\wwwroot` - Windows IIS path

**Multiple Deployment Paths:**
You can deploy to multiple locations at once! This is useful when:

- You have load-balanced servers (deploy to Server 1, Server 2, Server 3)
- You want to deploy to both production and backup servers
- You need to sync files to multiple locations

**Example with multiple paths:**

```
/var/www/website
/backup/website
/mnt/cdn/website
```

**Tips:**

- Make sure the path exists on your server
- The deploy user must have write permissions to this path
- Use absolute paths (start with `/` on Linux or `C:\` on Windows)

---

### Project Type

**What it is:** The type of application you're deploying.

**Available types:**

#### Node.js

- For Node.js applications (Express, NestJS, etc.)
- Requires `package.json` in your repository
- Deploy Center will run `npm install` for you

#### React

- For React applications (Create React App, Vite, etc.)
- Deploy Center will build your app automatically
- Only the build output will be deployed

#### Next.js

- For Next.js applications
- Deploy Center handles the build process
- Supports both static export and server-side rendering

#### Static

- For static websites (HTML, CSS, JavaScript)
- No build process needed
- Files are copied directly to the deployment path

#### Docker

- For Dockerized applications
- Requires `Dockerfile` in your repository
- Deploy Center will build and run the Docker container

#### Other

- For any other type of application
- You have full control via the pipeline

**Tips:**

- Choose the type that matches your technology
- If unsure, choose "Other" and use the pipeline to customize

---

## Step 2: Configuration

### Environment

**What it is:** The deployment environment name.

**Common values:**

- `production` - Live production server
- `staging` - Testing environment before production
- `development` - Development environment

**How it's used:**

- Available as `$ENVIRONMENT` variable in your pipeline
- Helps you identify which environment you're deploying to
- Can be used in conditional pipeline steps

---

### Auto Deploy

**What it is:** Automatically trigger deployment when code is pushed to the repository.

**When enabled:**

- Every push to the specified branch will trigger a deployment
- Uses webhooks (you'll set this up later)
- Great for continuous deployment

**When disabled:**

- Deployments are manual only
- You click "Deploy" button when ready
- Better for production environments where you want control

**Tips:**

- Enable for `staging` or `development` branches
- Disable for `production` if you prefer manual control
- You can always trigger manual deployments even with auto-deploy enabled

---

### Environment Variables

**What it is:** Key-value pairs that will be available during deployment and in your application.

**Common examples:**

```
NODE_ENV=production
API_URL=https://api.example.com
DATABASE_HOST=localhost
PORT=3000
SECRET_KEY=your-secret-key
```

**How to use them:**

- Add variable name (e.g., `NODE_ENV`)
- Add variable value (e.g., `production`)
- Click "Add Variable" to add more

**In your code:**

```javascript
// Node.js
const apiUrl = process.env.API_URL;

// React (.env file)
REACT_APP_API_URL=${API_URL}
```

**In pipeline commands:**

```bash
echo "Deploying to $ENVIRONMENT"
echo "API URL is $API_URL"
```

**Tips:**

- Use UPPERCASE_WITH_UNDERSCORES for variable names
- Don't include sensitive data like passwords here - use secret management instead
- Variables are available in both pre and post-deployment pipelines

---

### Deploy on Specific Paths

**What it is:** Only trigger deployment when specific files or folders change.

**Examples:**

- `src/` - Only deploy when source code changes
- `public/` - Only deploy when public assets change
- `api/` - Only deploy when API code changes

**How it works:**

- Deploy Center checks which files changed in the commit
- If any changed file matches your paths, deployment triggers
- If no matches, deployment is skipped

**Leave empty to deploy on any change.**

**Tips:**

- Useful for monorepos (multiple projects in one repository)
- Saves server resources by skipping unnecessary deployments
- Use `/` at the end for directories (e.g., `src/`)

---

### Build Output Directory

**What it is:** The folder containing your build files after the build process.

**Common values:**

- `build` - Create React App default
- `dist` - Vite, Vue CLI, many others
- `out` - Next.js static export
- `.next` - Next.js server build

**How it works:**

- Your pipeline builds the application
- Deploy Center syncs **only** the build folder to the server
- Source code is not deployed

**Example:**
Your repository has:

```
src/
public/
build/          ← This folder is deployed
package.json
```

**Tips:**

- For React/Vue apps, find this in your build tool's config
- Leave empty if you want to deploy all files
- Only applies to projects with a build step

---

### Sync Ignore Patterns

**What it is:** Files or folders to **exclude** from deployment.

**Common patterns:**

```
node_modules
.git
.env
*.log
.DS_Store
tests/
docs/
```

**How it works:**

- Uses glob patterns (like `.gitignore`)
- Matching files won't be copied to the server
- Helps keep deployment clean and fast

**Already ignored by default:**

- `node_modules`
- `.git`
- `.env` and `.env.*`
- Log files
- OS files (`.DS_Store`, `Thumbs.db`)

**Tips:**

- Add development files you don't need in production
- Add test folders (`__tests__`, `tests/`)
- Add documentation (`docs/`, `README.md`)

---

### Rsync Options

**What it is:** Advanced options for the file sync process (Linux/Mac only).

**Common options:**

```
--no-perms --no-owner --no-group
--exclude=*.tmp
--delete-after
```

**What these mean:**

- `--no-perms` - Don't sync file permissions
- `--no-owner` - Don't sync file owner
- `--delete-after` - Delete files on server that don't exist in repository

**Tips:**

- Leave empty unless you have specific requirements
- Only for advanced users familiar with rsync
- Windows deployments use a different sync method

---

## Step 3: Pre-Deployment Pipeline

**What it is:** Commands that run **before** deploying files to the server.

**When it runs:** In a temporary directory after cloning your repository, **before** files are synced.

**Common uses:**

- Installing dependencies (`npm install`)
- Building your application (`npm run build`)
- Running tests (`npm test`)
- Compiling code
- Generating assets

---

### Adding Pipeline Steps

Each step has:

#### Step Name

A friendly name for this step.

**Examples:**

- "Install Dependencies"
- "Build Application"
- "Run Tests"

#### Commands

One or more commands to run for this step.

**Examples:**

**Install Dependencies:**

```bash
npm install
```

**Build React App:**

```bash
npm run build
```

**Run Tests:**

```bash
npm test
```

**Multiple commands in one step:**

```bash
npm install
npm run lint
npm test
npm run build
```

#### Run If (Condition) - Optional

Run this step only when a condition is true.

**Examples:**

Only in production:

```bash
$ENVIRONMENT == 'production'
```

Only when package.json changed:

```bash
$CHANGED_FILES contains 'package.json'
```

**Tips:**

- Leave empty to always run
- Use `$ENVIRONMENT` to check environment
- Use `$BRANCH` to check branch name

---

### Example Pre-Deployment Pipelines

#### Node.js API

```
Step 1: Install Dependencies
  npm install

Step 2: Run Tests
  npm test

Step 3: Build TypeScript
  npm run build
```

#### React Application

```
Step 1: Install Dependencies
  npm ci

Step 2: Build Production
  npm run build

Step 3: Optimize Images
  npm run optimize-images
```

#### Static Website

```
Step 1: Install Tools
  npm install -g html-minifier

Step 2: Minify HTML
  html-minifier --input-dir . --output-dir dist
```

---

## Step 4: Post-Deployment Pipeline

**What it is:** Commands that run **after** files are deployed to the server.

**When it runs:** In the **production directory** after all files have been synced.

**Common uses:**

- Restarting services (`pm2 restart`, `systemctl restart`)
- Clearing caches
- Running database migrations
- Warming up caches
- Notifying monitoring services

---

### Key Differences from Pre-Deployment Pipeline

| Pre-Deployment | Post-Deployment |
|---------------|-----------------|
| Runs in temporary directory | Runs in production directory |
| Before files are synced | After files are synced |
| For build tasks | For server tasks |
| Example: `npm build` | Example: `pm2 restart` |

---

### Automatic Rollback

**What it is:** If any post-deployment command fails, automatically restore the previous version.

**How it works:**

1. Deploy Center creates a backup before syncing files
2. Files are synced to production
3. Post-deployment commands run
4. ✅ **Success:** Backup is deleted
5. ❌ **Failure:** Previous version is restored from backup

**Enable rollback:**

- Check "Enable Automatic Rollback"
- Recommended for production environments
- Gives you safety net if something goes wrong

---

### Adding Post-Deployment Steps

Same format as pre-deployment steps:

#### Step Name

Example: "Restart Application"

#### Commands

Example: `pm2 restart myapp`

#### Run If (Condition)

Example: `$ENVIRONMENT == 'production'`

---

### Example Post-Deployment Pipelines

#### Node.js with PM2

```
Step 1: Restart Application
  pm2 restart myapp

Step 2: Clear Cache
  pm2 flush myapp
```

#### PHP Application

```
Step 1: Clear Cache
  php artisan cache:clear

Step 2: Run Migrations
  php artisan migrate --force

Step 3: Restart PHP-FPM
  sudo systemctl restart php8.1-fpm
```

#### Nginx Static Site

```
Step 1: Reload Nginx
  sudo nginx -s reload

Step 2: Clear CDN Cache
  curl -X POST https://api.cdn.com/purge
```

#### Next.js Application

```
Step 1: Install Production Dependencies
  npm ci --production

Step 2: Restart Next.js
  pm2 restart nextjs-app
```

---

### Important Notes

⚠️ **Be Careful With:**

- Commands that require sudo (make sure deploy user has permission)
- Commands that restart the entire server
- Long-running commands (keep them quick)

✅ **Best Practices:**

- Test commands on your server first
- Use absolute paths for binaries
- Check exit codes (`pm2 restart || exit 1`)
- Keep steps simple and focused

---

## Step 5: Notifications

**What it is:** Get notified about deployment status.

### Notification Events

#### On Start

Notified when deployment begins.

**Good for:** Knowing deployment is in progress.

#### On Success

Notified when deployment completes successfully.

**Good for:** Confirming deployment worked.

#### On Failure

Notified when deployment fails.

**Good for:** Immediately knowing something went wrong.

---

### Notification Channels

Notifications can be configured later in project settings. Supported channels:

- **Discord** - Webhook to Discord channel
- **Slack** - Webhook to Slack channel
- **Email** - Email notifications
- **Telegram** - Telegram bot messages

---

## After Creating the Project

### 1. Set Up Webhook (For Auto Deploy)

If you enabled auto-deploy, you need to configure a webhook in your Git platform:

**GitHub:**

1. Go to your repository settings
2. Click "Webhooks" → "Add webhook"
3. Copy the webhook URL from Deploy Center project page
4. Copy the webhook secret
5. Set Content Type to `application/json`
6. Select "Just the push event"
7. Save

**GitLab:**

1. Go to Settings → Webhooks
2. Paste the webhook URL
3. Paste the secret token
4. Select "Push events"
5. Save

---

### 2. SSH Key Setup (For Private Repositories)

If your repository is private:

1. Go to project details page
2. Find "SSH Key Management" section
3. Click "Generate SSH Key"
4. Copy the public key
5. Add to your Git platform:
   - **GitHub:** Settings → Deploy Keys → Add deploy key
   - **GitLab:** Settings → Repository → Deploy Keys → Add key

---

### 3. Test Manual Deployment

Before relying on auto-deploy:

1. Click "Deploy" button
2. Select the branch
3. Add deployment notes (optional)
4. Click "Start Deployment"
5. Watch the live logs
6. Verify deployment succeeded

---

### 4. Manage Environment Variables

You can add/edit/delete variables anytime:

1. Go to project details page
2. Find "Environment Variables" section
3. Click "Edit"
4. Add/modify/delete variables
5. Click "Save"
6. Variables take effect on next deployment

---

## Common Examples

### Example 1: Simple Static Website

**Use Case:** HTML/CSS/JS website with no build process.

**Configuration:**

- **Project Type:** Static
- **Branch:** `main`
- **Deployment Path:** `/var/www/html`
- **Pre-Deployment Pipeline:** None
- **Post-Deployment Pipeline:**

  ```
  Step: Reload Nginx
    sudo nginx -s reload
  ```

---

### Example 2: React Application

**Use Case:** Create React App that needs to be built.

**Configuration:**

- **Project Type:** React
- **Branch:** `main`
- **Deployment Path:** `/var/www/myapp`
- **Build Output:** `build`
- **Environment Variables:**

  ```
  REACT_APP_API_URL=https://api.example.com
  ```

- **Pre-Deployment Pipeline:**

  ```
  Step 1: Install Dependencies
    npm ci

  Step 2: Build Application
    npm run build
  ```

- **Post-Deployment Pipeline:**

  ```
  Step: Reload Nginx
    sudo nginx -s reload
  ```

---

### Example 3: Node.js API with PM2

**Use Case:** Express.js API running with PM2.

**Configuration:**

- **Project Type:** Node.js
- **Branch:** `production`
- **Deployment Path:** `/home/user/api`
- **Environment Variables:**

  ```
  NODE_ENV=production
  PORT=3000
  DATABASE_URL=mongodb://localhost:27017/mydb
  ```

- **Pre-Deployment Pipeline:**

  ```
  Step 1: Install Dependencies
    npm ci --production

  Step 2: Run Tests
    npm test
  ```

- **Post-Deployment Pipeline:**

  ```
  Step 1: Restart API
    pm2 restart api

  Step 2: Save PM2 Config
    pm2 save
  ```

- **Rollback:** Enabled

---

### Example 4: Multi-Server Deployment

**Use Case:** Deploy to 3 load-balanced servers simultaneously.

**Configuration:**

- **Deployment Paths:**

  ```
  /var/www/app
  user@server2.com:/var/www/app
  user@server3.com:/var/www/app
  ```

- **Pre-Deployment Pipeline:**

  ```
  Step: Build Application
    npm install
    npm run build
  ```

- **Post-Deployment Pipeline:**

  ```
  Step: Restart All Servers
    pm2 restart app
  ```

---

### Example 5: PHP Laravel Application

**Use Case:** Laravel application with database migrations.

**Configuration:**

- **Project Type:** Other
- **Branch:** `main`
- **Deployment Path:** `/var/www/laravel`
- **Sync Ignore Patterns:**

  ```
  tests/
  .env.example
  phpunit.xml
  ```

- **Pre-Deployment Pipeline:**

  ```
  Step: Install Dependencies
    composer install --no-dev --optimize-autoloader
  ```

- **Post-Deployment Pipeline:**

  ```
  Step 1: Run Migrations
    php artisan migrate --force

  Step 2: Clear Cache
    php artisan cache:clear
    php artisan config:clear
    php artisan route:clear

  Step 3: Optimize
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache

  Step 4: Restart PHP-FPM
    sudo systemctl restart php8.1-fpm
  ```

- **Rollback:** Enabled

---

## Tips and Best Practices

### 🎯 General Tips

1. **Start Simple:** Begin with basic configuration, add complexity later
2. **Test Locally First:** Test build commands on your machine before adding to pipeline
3. **Use Descriptive Names:** Clear step names help understand deployment logs
4. **Enable Rollback:** Especially important for production deployments
5. **Monitor First Deployment:** Watch the logs carefully on first deployment

### 🔒 Security Tips

1. **Use SSH Keys:** For private repositories instead of passwords
2. **Don't Commit Secrets:** Use environment variables for sensitive data
3. **Limit Permissions:** Deploy user should have minimal necessary permissions
4. **Use HTTPS:** For public repositories when possible

### ⚡ Performance Tips

1. **Use `npm ci`:** Faster and more reliable than `npm install`
2. **Cache Dependencies:** Configure your server to cache node_modules between deployments
3. **Optimize Build Output:** Only deploy what's necessary
4. **Use Ignore Patterns:** Reduce deployment size and time

### 🐛 Troubleshooting

**Deployment fails at install step:**

- Check node/npm version on server
- Verify package.json is valid
- Check for platform-specific dependencies

**Files not updating on server:**

- Check deployment path is correct
- Verify user has write permissions
- Check sync ignore patterns aren't excluding needed files

**Post-deployment commands fail:**

- Test commands directly on server first
- Check user has necessary permissions (sudo, pm2, etc.)
- Verify service names are correct

**Webhook not triggering:**

- Verify webhook URL is correct
- Check webhook secret matches
- Look for webhook delivery errors in Git platform

---

## Need Help?

- Check deployment logs for detailed error messages
- Review the [Deployment Logs Guide](./deployment-logs.md)
- Contact your system administrator
- Check the [FAQ](../FAQ.md)

---

**Congratulations!** You now know how to create and configure projects in Deploy Center. Start with a simple project and gradually add more features as you become comfortable with the system.
