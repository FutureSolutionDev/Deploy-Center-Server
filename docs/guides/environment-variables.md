# Environment Variables - Managing Configuration

This guide explains how to manage environment variables in Deploy Center for use in deployments and applications.

## Table of Contents

1. [Overview](#overview)
2. [Variable Types](#variable-types)
3. [Setting Variables](#setting-variables)
4. [Using Variables](#using-variables)
5. [Security Best Practices](#security-best-practices)
6. [Common Patterns](#common-patterns)

---

## Overview

Environment variables are key-value pairs that configure your application's behavior without hardcoding values in your code.

### Why Use Environment Variables?

**Benefits:**

- ✅ **Separation of Config & Code**: Keep secrets out of Git
- ✅ **Environment-Specific Settings**: Different values for dev/staging/prod
- ✅ **Security**: Sensitive data not committed to repository
- ✅ **Flexibility**: Change configuration without code changes
- ✅ **12-Factor App Compliance**: Industry best practice

**Common Use Cases:**

- Database connection strings
- API keys and tokens
- Service URLs
- Feature flags
- Application ports
- Debug settings

---

## Variable Types

Deploy Center supports two types of variables:

### 1. Project Variables

Defined in project configuration, available during deployments.

**Where to set:**

- Project details page → "Environment Variables" section

**Scope:**

- Available in pre-deployment pipeline
- Available in post-deployment pipeline
- Available in your application (if configured)

**Examples:**

```bash
NODE_ENV=production
API_URL=https://api.example.com
PORT=3000
```

### 2. System Variables

Automatically provided by Deploy Center.

**Available variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `$PROJECT_NAME` | Project name | `My Website` |
| `$PROJECT_PATH` | Working directory | `/tmp/deploy/123/repo` |
| `$PROJECT_TYPE` | Project type | `nodejs` |
| `$ENVIRONMENT` | Environment name | `production` |
| `$BRANCH` | Git branch | `main` |
| `$COMMIT_HASH` | Full commit hash | `abc123def456...` |
| `$SHORT_HASH` | Short commit hash | `abc123d` |
| `$COMMIT_MESSAGE` | Commit message | `Fix bug` |
| `$AUTHOR` | Commit author | `John Doe` |
| `$REPO_NAME` | Repository name | `my-website` |
| `$DEPLOYMENT_ID` | Deployment ID | `123` |
| `$TRIGGERED_BY` | Trigger source | `webhook` |
| `$TIMESTAMP` | Deployment time | `2026-01-04T11:30:00Z` |

---

## Setting Variables

### Via Web Interface

1. Go to your project details page
2. Find "Environment Variables" section
3. Click "Add Variable"
4. Enter:
   - **Name**: Variable name (e.g., `API_KEY`)
   - **Value**: Variable value (e.g., `sk-abc123...`)
5. Click "Save"

**Editing Variables:**

1. Click "Edit" next to the variable
2. Change value
3. Click "Update"

**Deleting Variables:**

1. Click "Delete" next to the variable
2. Confirm deletion

**Changes take effect:**

- Next deployment (not retroactive)

### Via Project Configuration JSON

Variables are stored in the project's `Config` JSON field:

```json
{
  "Variables": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com",
    "DATABASE_HOST": "localhost",
    "DATABASE_PORT": "3306",
    "REDIS_URL": "redis://localhost:6379"
  }
}
```

---

## Using Variables

### In Pipeline Commands

Variables are available in all pipeline steps:

**Pre-Deployment Example:**

```json
{
  "Name": "Build Application",
  "Commands": [
    "export REACT_APP_API_URL=$API_URL",
    "export REACT_APP_VERSION=$SHORT_HASH",
    "npm run build"
  ]
}
```

**Post-Deployment Example:**

```json
{
  "Name": "Deploy to CDN",
  "Commands": [
    "aws s3 sync ./build s3://$S3_BUCKET --region $AWS_REGION"
  ]
}
```

### In Application Code

To make variables available to your application, they must be injected during deployment.

#### Node.js Applications

**Method 1: .env File Generation**

Create a `.env` file during post-deployment:

```json
{
  "Name": "Create Environment File",
  "Commands": [
    "cat > .env << EOF",
    "NODE_ENV=$NODE_ENV",
    "API_URL=$API_URL",
    "DATABASE_HOST=$DATABASE_HOST",
    "EOF"
  ]
}
```

Access in Node.js:

```javascript
require('dotenv').config();

const apiUrl = process.env.API_URL;
const dbHost = process.env.DATABASE_HOST;
```

**Method 2: PM2 Ecosystem File**

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'myapp',
    script: './dist/index.js',
    env: {
      NODE_ENV: 'production',
      API_URL: process.env.API_URL,
      DATABASE_HOST: process.env.DATABASE_HOST
    }
  }]
};
```

Start with PM2:

```bash
pm2 start ecosystem.config.js
```

#### React Applications

**Build-time Variables:**

Variables prefixed with `REACT_APP_` are embedded during build:

```json
{
  "Name": "Build React App",
  "Commands": [
    "export REACT_APP_API_URL=$API_URL",
    "export REACT_APP_VERSION=$SHORT_HASH",
    "npm run build"
  ]
}
```

Access in React:

```javascript
const apiUrl = process.env.REACT_APP_API_URL;
const version = process.env.REACT_APP_VERSION;
```

**⚠️ Security Warning:**

- `REACT_APP_*` variables are embedded in JavaScript bundle
- Never put secrets in `REACT_APP_*` variables
- They are visible to anyone inspecting your frontend code

#### Next.js Applications

**Server-side Variables:**

```javascript
// .env.production (generated during deployment)
DATABASE_URL=postgresql://...
API_SECRET_KEY=sk-abc123...
```

```javascript
// Access in server components
const dbUrl = process.env.DATABASE_URL;
```

**Public Variables:**

```javascript
// .env.production
NEXT_PUBLIC_API_URL=https://api.example.com
```

```javascript
// Access in client components
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

#### PHP Applications

**Method 1: .env File (Laravel)**

```json
{
  "Name": "Create Environment File",
  "Commands": [
    "cat > .env << EOF",
    "APP_ENV=$ENVIRONMENT",
    "APP_URL=$APP_URL",
    "DB_HOST=$DATABASE_HOST",
    "DB_DATABASE=$DATABASE_NAME",
    "EOF"
  ]
}
```

Access in Laravel:

```php
$apiUrl = env('APP_URL');
$dbHost = env('DB_HOST');
```

**Method 2: php.ini or web.config**

For traditional PHP apps, set environment in server configuration.

---

## Security Best Practices

### ✅ Do

**1. Use Variables for Sensitive Data**

```bash
# Good
DATABASE_PASSWORD=$DB_PASSWORD

# Bad (hardcoded in code)
const password = "super_secret_password";
```

**2. Use Different Values per Environment**

```bash
# Development
API_URL=https://api-dev.example.com

# Production
API_URL=https://api.example.com
```

**3. Rotate Secrets Regularly**

- Update API keys monthly
- Regenerate tokens after team changes
- Change passwords on schedule

**4. Limit Variable Visibility**

- Only admins/managers can view variables in UI
- Developers see variable names, not values
- Variables not logged in deployment logs

**5. Use Descriptive Names**

```bash
# Good
DATABASE_CONNECTION_STRING
AWS_S3_BUCKET_NAME

# Bad
DB
BUCKET
```

### ❌ Don't

**1. Don't Commit Secrets to Git**

```bash
# Bad - this will be in Git history forever
git add .env
git commit -m "Add production secrets"
```

**2. Don't Use Variables for Non-Sensitive Data**

```bash
# Overkill - just hardcode this
APP_NAME=$APP_NAME

# Better in code
const APP_NAME = "My Application";
```

**3. Don't Put Secrets in Frontend Variables**

```bash
# Bad - visible in browser
REACT_APP_API_SECRET_KEY=sk-abc123...

# Good - only use public values
REACT_APP_API_URL=https://api.example.com
```

**4. Don't Share Variables Between Projects**

- Each project should have its own variables
- Reduces blast radius if compromised

**5. Don't Hardcode Production Values in Development**

```javascript
// Bad
const apiUrl = process.env.API_URL || "https://api.example.com";

// Good
const apiUrl = process.env.API_URL || "http://localhost:3000";
```

---

## Common Patterns

### Node.js API Server

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost/db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
API_KEY=sk-abc123...
LOG_LEVEL=info
```

### React Frontend

```bash
REACT_APP_API_URL=https://api.example.com
REACT_APP_GA_TRACKING_ID=UA-123456789-1
REACT_APP_SENTRY_DSN=https://...@sentry.io/123
REACT_APP_VERSION=$SHORT_HASH
```

### Next.js Application

```bash
# Server-side only
DATABASE_URL=postgresql://...
SECRET_KEY=abc123...

# Public (client-side)
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_STRIPE_KEY=pk_live_...
```

### Laravel PHP

```bash
APP_NAME=MyApp
APP_ENV=production
APP_URL=https://example.com
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=myapp
DB_USERNAME=dbuser
DB_PASSWORD=dbpass
REDIS_HOST=127.0.0.1
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
```

### Docker Application

```bash
DOCKER_IMAGE=myapp:latest
DOCKER_TAG=$SHORT_HASH
DOCKER_REGISTRY=registry.example.com
CONTAINER_NAME=myapp-prod
HOST_PORT=80
CONTAINER_PORT=3000
```

---

## Variable Validation

Deploy Center validates variable names:

**Valid:**

```bash
NODE_ENV          ✅
API_URL           ✅
DATABASE_HOST     ✅
S3_BUCKET_NAME    ✅
```

**Invalid:**

```bash
node-env          ❌ (hyphens not allowed)
api url           ❌ (spaces not allowed)
123_VAR           ❌ (starts with number)
```

**Naming Convention:**

- Use UPPERCASE letters
- Use underscores `_` for separation
- Start with a letter
- Only alphanumeric and underscores

---

## Troubleshooting

### Variable Not Available in Application

**Check 1: Variable exported in pipeline**

```bash
# In pre-deployment or post-deployment pipeline
export API_URL=$API_URL
```

**Check 2: Application reads from correct source**

```javascript
// Node.js - requires dotenv
require('dotenv').config();
console.log(process.env.API_URL);
```

**Check 3: .env file created correctly**

```bash
# Check if file exists
ls -la .env

# Check file contents
cat .env
```

### Variable Shows as Empty

**Cause:** Variable not defined in project.

**Solution:**

1. Go to project settings
2. Check "Environment Variables" section
3. Add missing variable

### Variable Not Replaced in Pipeline

**Cause:** Syntax error or variable doesn't exist.

**Check:**

```bash
# Correct
echo $API_URL

# Incorrect  
echo API_URL  # Missing $
echo ${API_URL  # Missing }
```

---

## Related Documentation

- [Pipeline Configuration](./pipeline-configuration.md) - Using variables in pipelines
- [Creating Projects](./creating-projects.md) - Setting up projects
- [Deployment Workflows](./deployment-workflows.md) - How deployments work

---

**Need Help?** Join our [Discord community](https://discord.gg/j8edhTZy) or [open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).
