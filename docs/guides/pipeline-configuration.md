# Pipeline Configuration - Advanced Guide

This guide covers the advanced configuration of deployment pipelines in Deploy Center, including step types, variable injection, conditional execution, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Structure](#pipeline-structure)
3. [Variable System](#variable-system)
4. [Conditional Execution](#conditional-execution)
5. [Common Patterns](#common-patterns)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

---

## Overview

Pipelines in Deploy Center are sequences of steps that execute commands during the deployment process. There are two pipeline types:

- **Pre-Deployment Pipeline**: Runs *before* files are synced (in working directory)
- **Post-Deployment Pipeline**: Runs *after* files are synced (in production directory)

### Pipeline Format

Pipelines are defined as JSON arrays in the project configuration:

```json
{
  "PreDeploymentPipeline": [
    {
      "Name": "Install Dependencies",
      "Commands": ["npm ci"],
      "RunIf": ""
    },
    {
      "Name": "Build Application",
      "Commands": ["npm run build"],
      "RunIf": "$ENVIRONMENT == 'production'"
    }
  ],
  "PostDeploymentPipeline": [
    {
      "Name": "Restart Service",
      "Commands": ["pm2 restart app"],
      "RunIf": ""
    }
  ]
}
```

---

## Pipeline Structure

### Step Definition

Each pipeline step has three fields:

#### Name (Required)

A descriptive name for the step.

**Guidelines:**

- Use clear, action-oriented names
- Keep it concise (< 50 characters)
- Examples: "Install Dependencies", "Build Application", "Run Tests"

#### Commands (Required)

An array of shell commands to execute.

**Examples:**

Single command:

```json
"Commands": ["npm install"]
```

Multiple commands:

```json
"Commands": [
  "npm install",
  "npm run lint",
  "npm test",
  "npm run build"
]
```

**Important:**

- Commands execute sequentially
- If any command fails (exit code ≠ 0), the step fails
- Step failure stops the entire pipeline
- Each command runs in the same shell session

#### RunIf (Optional)

A conditional expression. Step only runs if expression evaluates to `true`.

**Examples:**

Always run (default):

```json
"RunIf": ""
```

Only in production:

```json
"RunIf": "$ENVIRONMENT == 'production'"
```

Only when package.json changed:

```json
"RunIf": "$CHANGED_FILES contains 'package.json'"
```

---

## Variable System

Deploy Center provides a powerful variable substitution system for pipelines.

### Available Variables

#### Project Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `$PROJECT_NAME` | Project name | `My Website` |
| `$PROJECT_PATH` | Project working directory | `/tmp/deploy/123/repo` |
| `$PROJECT_TYPE` | Project type | `nodejs`, `react`, `static` |
| `$ENVIRONMENT` | Environment name | `production`, `staging` |

#### Git Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `$BRANCH` | Git branch | `main`, `develop` |
| `$COMMIT_HASH` | Full commit hash | `abc123def456...` |
| `$SHORT_HASH` | Short commit hash (7 chars) | `abc123d` |
| `$COMMIT_MESSAGE` | Commit message | `Fix authentication bug` |
| `$AUTHOR` | Commit author | `John Doe` |
| `$REPO_NAME` | Repository name | `my-website` |
| `$REPO_URL` | Repository URL | `https://github.com/user/repo` |

#### Deployment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `$DEPLOYMENT_ID` | Unique deployment ID | `123` |
| `$TRIGGERED_BY` | Trigger source | `webhook`, `manual` |
| `$CHANGED_FILES` | List of changed files | `src/app.js,README.md` |
| `$TIMESTAMP` | Deployment timestamp | `2026-01-04T11:30:00Z` |

#### Custom Variables

Environment variables from project configuration are also available:

```json
{
  "Variables": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com",
    "PORT": "3000"
  }
}
```

Access in pipeline:

```bash
echo "API URL is $API_URL"
echo "Running in $NODE_ENV mode"
```

### Variable Replacement

Variables are replaced **before** command execution:

**Configuration:**

```json
{
  "Name": "Build with commit info",
  "Commands": [
    "echo 'Building commit $SHORT_HASH'",
    "REACT_APP_VERSION=$SHORT_HASH npm run build"
  ]
}
```

**Actual execution:**

```bash
echo 'Building commit abc123d'
REACT_APP_VERSION=abc123d npm run build
```

### Escaping Variables

To use literal `$` character, escape it with backslash:

```json
"Commands": ["echo 'Price is \\$100'"]
```

Output: `Price is $100`

---

## Conditional Execution

The `RunIf` field supports conditional expressions to control step execution.

### Expression Syntax

#### Equality Comparison

```json
"RunIf": "$ENVIRONMENT == 'production'"
"RunIf": "$BRANCH == 'main'"
"RunIf": "$PROJECT_TYPE == 'nodejs'"
```

#### Inequality Comparison

```json
"RunIf": "$ENVIRONMENT != 'development'"
"RunIf": "$BRANCH != 'test-branch'"
```

#### String Contains

Check if variable contains a substring:

```json
"RunIf": "$CHANGED_FILES contains 'package.json'"
"RunIf": "$COMMIT_MESSAGE contains '[deploy]'"
"RunIf": "$BRANCH contains 'release'"
```

#### Logical Operators

**AND (`&&`):**

```json
"RunIf": "$ENVIRONMENT == 'production' && $BRANCH == 'main'"
```

**OR (`||`):**

```json
"RunIf": "$ENVIRONMENT == 'staging' || $ENVIRONMENT == 'production'"
```

**Complex:**

```json
"RunIf": "($ENVIRONMENT == 'production' && $BRANCH == 'main') || $TRIGGERED_BY == 'manual'"
```

### Conditional Examples

#### Run tests only in CI/CD

```json
{
  "Name": "Run Tests",
  "Commands": ["npm test"],
  "RunIf": "$TRIGGERED_BY == 'webhook'"
}
```

#### Install dependencies only when package.json changes

```json
{
  "Name": "Install Dependencies",
  "Commands": ["npm ci"],
  "RunIf": "$CHANGED_FILES contains 'package.json'"
}
```

#### Production-only optimizations

```json
{
  "Name": "Optimize Images",
  "Commands": ["npm run optimize-images"],
  "RunIf": "$ENVIRONMENT == 'production'"
}
```

#### Skip step for specific branches

```json
{
  "Name": "Deploy to CDN",
  "Commands": ["npm run deploy-cdn"],
  "RunIf": "$BRANCH != 'development'"
}
```

---

## Common Patterns

### Node.js Application

```json
{
  "PreDeploymentPipeline": [
    {
      "Name": "Install Dependencies",
      "Commands": ["npm ci"],
      "RunIf": ""
    },
    {
      "Name": "Run Linter",
      "Commands": ["npm run lint"],
      "RunIf": "$ENVIRONMENT != 'production'"
    },
    {
      "Name": "Run Tests",
      "Commands": ["npm test"],
      "RunIf": "$TRIGGERED_BY == 'webhook'"
    },
    {
      "Name": "Build TypeScript",
      "Commands": ["npm run build"],
      "RunIf": ""
    }
  ],
  "PostDeploymentPipeline": [
    {
      "Name": "Install Production Dependencies",
      "Commands": ["npm ci --production"],
      "RunIf": ""
    },
    {
      "Name": "Run Migrations",
      "Commands": ["npm run migrate"],
      "RunIf": "$ENVIRONMENT == 'production'"
    },
    {
      "Name": "Restart Application",
      "Commands": ["pm2 restart app"],
      "RunIf": ""
    }
  ]
}
```

### React Application

```json
{
  "PreDeploymentPipeline": [
    {
      "Name": "Install Dependencies",
      "Commands": ["npm ci"],
      "RunIf": ""
    },
    {
      "Name": "Build Application",
      "Commands": [
        "export REACT_APP_VERSION=$SHORT_HASH",
        "export REACT_APP_BUILD_DATE=$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")",
        "npm run build"
      ],
      "RunIf": ""
    },
    {
      "Name": "Generate Sitemap",
      "Commands": ["npm run sitemap"],
      "RunIf": "$ENVIRONMENT == 'production'"
    }
  ],
  "PostDeploymentPipeline": [
    {
      "Name": "Reload Web Server",
      "Commands": ["sudo nginx -s reload"],
      "RunIf": ""
    },
    {
      "Name": "Purge CDN Cache",
      "Commands": ["curl -X POST https://api.cdn.com/purge?key=$CDN_API_KEY"],
      "RunIf": "$ENVIRONMENT == 'production'"
    }
  ]
}
```

### PHP Laravel Application

```json
{
  "PreDeploymentPipeline": [
    {
      "Name": "Install Composer Dependencies",
      "Commands": ["composer install --no-dev --optimize-autoloader"],
      "RunIf": ""
    },
    {
      "Name": "Install NPM Dependencies",
      "Commands": ["npm ci"],
      "RunIf": "$CHANGED_FILES contains 'package.json'"
    },
    {
      "Name": "Build Assets",
      "Commands": ["npm run production"],
      "RunIf": ""
    }
  ],
  "PostDeploymentPipeline": [
    {
      "Name": "Clear Cache",
      "Commands": [
        "php artisan config:clear",
        "php artisan cache:clear",
        "php artisan view:clear"
      ],
      "RunIf": ""
    },
    {
      "Name": "Run Migrations",
      "Commands": ["php artisan migrate --force"],
      "RunIf": "$ENVIRONMENT == 'production'"
    },
    {
      "Name": "Restart Queue Workers",
      "Commands": ["php artisan queue:restart"],
      "RunIf": ""
    },
    {
      "Name": "Reload PHP-FPM",
      "Commands": ["sudo systemctl reload php8.1-fpm"],
      "RunIf": ""
    }
  ]
}
```

### Docker Application

```json
{
  "PreDeploymentPipeline": [
    {
      "Name": "Build Docker Image",
      "Commands": [
        "docker build -t myapp:$SHORT_HASH .",
        "docker tag myapp:$SHORT_HASH myapp:latest"
      ],
      "RunIf": ""
    },
    {
      "Name": "Run Tests in Container",
      "Commands": ["docker run --rm myapp:latest npm test"],
      "RunIf": "$TRIGGERED_BY == 'webhook'"
    }
  ],
  "PostDeploymentPipeline": [
    {
      "Name": "Stop Old Container",
      "Commands": ["docker stop myapp || true"],
      "RunIf": ""
    },
    {
      "Name": "Start New Container",
      "Commands": [
        "docker run -d --name myapp -p 3000:3000 myapp:latest"
      ],
      "RunIf": ""
    },
    {
      "Name": "Cleanup Old Images",
      "Commands": ["docker image prune -f"],
      "RunIf": "$ENVIRONMENT == 'production'"
    }
  ]
}
```

---

## Error Handling

### Exit Codes

Commands must exit with code `0` for success. Any other code is considered failure.

**Example:**

```bash
# This will fail the step if tests fail
npm test

# This will NOT fail the step even if command fails
npm test || true

# Fail step with custom exit code
if [ ! -f "required-file.txt" ]; then
  echo "Error: required-file.txt not found"
  exit 1
fi
```

### Handling Optional Commands

Use `|| true` to prevent optional commands from failing the step:

```json
{
  "Name": "Cleanup",
  "Commands": [
    "rm -rf old-logs || true",
    "docker system prune -f || true"
  ]
}
```

### Rollback on Failure

Enable automatic rollback in post-deployment pipeline:

```json
{
  "EnableAutomaticRollback": true,
  "PostDeploymentPipeline": [
    {
      "Name": "Health Check",
      "Commands": [
        "curl -f http://localhost:3000/health || exit 1"
      ]
    }
  ]
}
```

If health check fails:

1. Previous version restored from backup
2. Deployment marked as failed
3. Notification sent

---

## Best Practices

### ✅ Do

**Use descriptive step names:**

```json
{"Name": "Install Dependencies"}  ✅
{"Name": "Step 1"}  ❌
```

**Keep steps focused:**

```json
// Good - each step has one purpose
[
  {"Name": "Install", "Commands": ["npm ci"]},
  {"Name": "Build", "Commands": ["npm run build"]}
]

// Bad - too much in one step
[
  {"Name": "Setup", "Commands": ["npm ci", "npm run lint", "npm test", "npm run build"]}
]
```

**Use variables for flexibility:**

```json
{"Commands": ["REACT_APP_VERSION=$SHORT_HASH npm run build"]}  ✅
{"Commands": ["REACT_APP_VERSION=1.0.0 npm run build"]}  ❌
```

**Test commands locally first:**

```bash
# Test on your server before adding to pipeline
ssh user@server "cd /path && npm run build"
```

**Use absolute paths for binaries:**

```json
{"Commands": ["/usr/bin/pm2 restart app"]}  ✅
{"Commands": ["pm2 restart app"]}  ⚠️ (might fail if not in PATH)
```

### ❌ Don't

**Don't use interactive commands:**

```json
{"Commands": ["npm install"]}  ❌ (might prompt for input)
{"Commands": ["npm ci"]}  ✅ (non-interactive)
```

**Don't use extremely long-running commands:**

```json
// This will timeout or block the deployment
{"Commands": ["sleep 3600"]}  ❌
```

**Don't hardcode environment-specific values:**

```json
{"Commands": ["deploy to production.example.com"]}  ❌
{"Commands": ["deploy to $DEPLOY_HOST"]}  ✅
```

**Don't ignore errors silently:**

```bash
# Bad - hides errors
command1 || true
command2 || true

# Good - handle errors explicitly
command1 || { echo "Command1 failed"; exit 1; }
```

### Performance Tips

**Cache dependencies:**

- Use `npm ci` instead of `npm install` (faster, more reliable)
- Use `composer install --no-dev` for production
- Consider using build caches if available

**Run tests conditionally:**

```json
{
  "Name": "Run Tests",
  "Commands": ["npm test"],
  "RunIf": "$TRIGGERED_BY == 'webhook' && $BRANCH != 'main'"
}
```

**Parallelize when possible:**
Deploy Center runs commands sequentially, but you can use shell parallelization:

```bash
npm run lint & npm run test & wait
```

---

## Related Documentation

- [Deployment Workflows](./deployment-workflows.md) - Understanding the deployment process
- [Environment Variables](./environment-variables.md) - Managing variables
- [Creating Projects](./creating-projects.md) - Project setup guide

---

**Need Help?** Join our [Discord community](https://discord.gg/j8edhTZy) or [open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).
