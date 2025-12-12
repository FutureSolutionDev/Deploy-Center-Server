# Deploy Center - GitHub Repository Setup Guide

Complete guide for setting up and configuring the Deploy Center GitHub repository with best practices for security, collaboration, and automation.

## Table of Contents

- [Initial Repository Creation](#initial-repository-creation)
- [Branch Protection Rules](#branch-protection-rules)
- [Security Features](#security-features)
- [Webhooks Configuration](#webhooks-configuration)
- [Team Management](#team-management)
- [Repository Settings](#repository-settings)
- [Labels and Milestones](#labels-and-milestones)
- [GitHub Actions](#github-actions)
- [Advanced Configuration](#advanced-configuration)

---

## Initial Repository Creation

### 1. Create New Repository

Navigate to: <https://github.com/organizations/FutureSolutionDev/repositories/new>

**Repository Settings:**

| Setting | Value |
|---------|-------|
| **Repository name** | `Deploy-Center-Server` |
| **Description** | Modern Self-Hosted CI/CD Deployment Platform with Webhook Integration |
| **Visibility** | Public |
| **Initialize** | ✅ No (we'll push existing code) |
| **Add .gitignore** | ❌ No (already exists) |
| **Add license** | ❌ No (using dual licensing) |
| **Add README** | ❌ No (already exists) |

### 2. Push Existing Code

```bash
cd "d:\Work\1-Nodejs\Deploy Center"

# Add remote
git remote add origin https://github.com/FutureSolutionDev/Deploy-Center-Server.git

# Verify remote
git remote -v

# Push main branch
git push -u origin main

# Push all branches (if any)
git push --all origin

# Push tags
git push --tags origin
```

### 3. Repository Configuration

Go to: `Settings` tab

**General Settings:**

- [ ] Set repository name and description
- [ ] Add website: `https://futuresolutionsdev.com`
- [ ] Add topics:
  - `deployment`
  - `cicd`
  - `automation`
  - `webhook`
  - `typescript`
  - `nodejs`
  - `self-hosted`
  - `continuous-deployment`
  - `pipeline`
  - `devops`

**Features:**

- ✅ **Issues** - Enable issue tracking
- ✅ **Discussions** - Enable community discussions
- ❌ **Wiki** - Disable (use docs folder instead)
- ❌ **Projects** - Optional (enable if using GitHub Projects)
- ✅ **Preserve this repository** - Archive important code

---

## Branch Protection Rules

### Main Branch Protection

Go to: `Settings` → `Branches` → `Add branch protection rule`

**Branch name pattern:** `main`

#### Protection Rules

**Require a pull request before merging:**

- ✅ Require approvals: `1`
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners
- ❌ Restrict who can dismiss pull request reviews
- ✅ Allow specified actors to bypass required pull requests (add bot accounts)

**Require status checks to pass before merging:**

- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- **Status checks to require:**
  - `Security Scan / CodeQL Security Analysis`
  - `Security Scan / Dependency Scan - Server`
  - `Security Scan / Dependency Scan - Client`
  - `CI / Build and Test - Server` (if you add CI workflow)
  - `CI / Build and Test - Client` (if you add CI workflow)

**Require conversation resolution before merging:**

- ✅ All conversations must be resolved

**Require signed commits:**

- ✅ Require signed commits (recommended for security)

**Require linear history:**

- ✅ Prevent merge commits (use squash or rebase)

**Require deployments to succeed before merging:**

- ❌ Not required (optional for production deployments)

**Lock branch:**

- ❌ Do not lock

**Do not allow bypassing the above settings:**

- ✅ Include administrators

**Restrict who can push to matching branches:**

- Optional: Add specific teams/users who can push

**Allow force pushes:**

- ❌ Disable force pushes

**Allow deletions:**

- ❌ Disable branch deletion

### Develop Branch Protection (if using git-flow)

**Branch name pattern:** `develop`

- ✅ Require pull request reviews: `1`
- ✅ Require status checks to pass
- ✅ Require conversation resolution
- ❌ Require signed commits (optional)
- ❌ Include administrators (allow maintainers to push)

---

## Security Features

### 1. Dependabot

Go to: `Settings` → `Code security and analysis`

**Dependabot alerts:**

- ✅ Enable - Get notified of vulnerable dependencies

**Dependabot security updates:**

- ✅ Enable - Automatically open PRs to update vulnerable dependencies

**Dependabot version updates:**

- ✅ Configure in `.github/dependabot.yml` (already created)

### 2. Code Scanning (CodeQL)

**Setup:**

- ✅ Already configured in `.github/workflows/security.yml`
- ✅ Scans on push, PR, and scheduled daily

**Configure alerts:**

- Go to `Settings` → `Code security and analysis`
- ✅ Enable CodeQL analysis
- Set alert threshold: `Medium` or `High`

### 3. Secret Scanning

**Enable:**

- ✅ Secret scanning - Detect secrets committed to repository
- ✅ Push protection - Prevent commits with secrets

**Protected secrets:**

- API keys
- Database passwords
- JWT secrets
- Webhook secrets
- OAuth tokens

### 4. Private Vulnerability Reporting

Go to: `Settings` → `Security` → `Private vulnerability reporting`

- ✅ Enable - Allow security researchers to privately report vulnerabilities

### 5. Security Policy

Already created in: `SECURITY.md`

**Configure:**

- Go to `Security` tab → `Policy`
- Verify `SECURITY.md` is displayed correctly

---

## Webhooks Configuration

### GitHub Webhook for Deploy Center

This is the webhook that Deploy Center receives from GitHub.

Go to: `Settings` → `Webhooks` → `Add webhook`

**Settings:**

| Field | Value |
|-------|-------|
| **Payload URL** | `https://your-domain.com/deploy` or `https://your-server-ip:3000/deploy` |
| **Content type** | `application/json` |
| **Secret** | `Future_CENTRAL_DEPLOY_2025` (from config.json) |
| **SSL verification** | ✅ Enable (if using HTTPS) |
| **Events** | ☑️ Just the push event |
| **Active** | ✅ Checked |

**Test webhook:**

- After saving, click "Recent Deliveries"
- Click on a delivery to see request/response
- Should see HTTP 200 response

### Additional Webhooks

**Discord/Slack Notifications (optional):**

For repository activity notifications:

```
Payload URL: https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN/github
Content type: application/json
Events: Issues, Pull requests, Push
```

---

## Team Management

### 1. Add Collaborators

Go to: `Settings` → `Collaborators and teams`

**Teams to create:**

| Team | Role | Access |
|------|------|--------|
| **Core Maintainers** | Admin | Full access |
| **Contributors** | Write | Push, merge PRs |
| **Triagers** | Triage | Manage issues/PRs |
| **Reviewers** | Read | Comment on PRs |

### 2. Code Owners

Create: `.github/CODEOWNERS`

```bash
# Default owners for everything in the repo
* @FutureSolutionDev/core-maintainers

# Server-specific ownership
/server/** @FutureSolutionDev/backend-team

# Client-specific ownership
/client/** @FutureSolutionDev/frontend-team

# Documentation
/docs/** @FutureSolutionDev/docs-team
*.md @FutureSolutionDev/docs-team

# Configuration files
/server/config/** @FutureSolutionDev/devops-team
/.github/** @FutureSolutionDev/devops-team
docker-compose.yml @FutureSolutionDev/devops-team

# Database
/server/migrations/** @FutureSolutionDev/database-team
/server/models/** @FutureSolutionDev/database-team
```

### 3. Outside Collaborators

For contributors outside your organization:

```bash
Settings → Collaborators → Add people
# Add by username or email
# Set permission level: Read, Triage, Write
```

---

## Repository Settings

### General

Go to: `Settings` → `General`

**Pull Requests:**

- ✅ Allow squash merging
  - Default: `Pull request title`
- ✅ Allow merge commits
- ✅ Allow rebase merging
- ✅ Always suggest updating pull request branches
- ✅ Allow auto-merge
- ✅ Automatically delete head branches

**Archives:**

- ❌ Do not include Git LFS objects in archives

### Merge Button

**Default merge method:**

- ☑️ Squash and merge (recommended)

### Discussions

Go to: `Settings` → `Features` → Enable Discussions

**Create categories:**

| Category | Description | Type |
|----------|-------------|------|
| 📣 **Announcements** | Official project updates | Announcement |
| 💡 **Ideas** | Feature requests and suggestions | Open discussion |
| ❓ **Q&A** | Questions and answers | Q&A |
| 🙌 **Show and Tell** | Community projects and integrations | Open discussion |
| 💬 **General** | General community chat | Open discussion |

### Actions

Go to: `Settings` → `Actions` → `General`

**Actions permissions:**

- ☑️ Allow all actions and reusable workflows

**Artifact and log retention:**

- Days: `90` (default)

**Fork pull request workflows:**

- ☑️ Require approval for first-time contributors

**Workflow permissions:**

- ☑️ Read and write permissions
- ✅ Allow GitHub Actions to create and approve pull requests

---

## Labels and Milestones

### Labels

Go to: `Issues` → `Labels`

**Type Labels:**

```yaml
- name: "bug"
  color: "d73a4a"
  description: "Something isn't working"

- name: "feature"
  color: "0e8a16"
  description: "New feature or request"

- name: "enhancement"
  color: "a2eeef"
  description: "Improvement to existing functionality"

- name: "documentation"
  color: "0075ca"
  description: "Documentation improvements"

- name: "security"
  color: "ee0701"
  description: "Security-related issues"
```

**Priority Labels:**

```yaml
- name: "priority: critical"
  color: "b60205"
  description: "Critical priority"

- name: "priority: high"
  color: "d93f0b"
  description: "High priority"

- name: "priority: medium"
  color: "fbca04"
  description: "Medium priority"

- name: "priority: low"
  color: "0e8a16"
  description: "Low priority"
```

**Status Labels:**

```yaml
- name: "status: needs triage"
  color: "ededed"
  description: "Needs investigation"

- name: "status: in progress"
  color: "ffcc00"
  description: "Work in progress"

- name: "status: blocked"
  color: "d4c5f9"
  description: "Blocked by dependencies"

- name: "status: needs review"
  color: "fbca04"
  description: "Ready for review"
```

**Component Labels:**

```yaml
- name: "server"
  color: "5319e7"
  description: "Server-side code"

- name: "client"
  color: "1d76db"
  description: "Client-side code"

- name: "database"
  color: "006b75"
  description: "Database-related"

- name: "ci/cd"
  color: "128a0c"
  description: "CI/CD pipeline"
```

**Special Labels:**

```yaml
- name: "good first issue"
  color: "7057ff"
  description: "Good for newcomers"

- name: "help wanted"
  color: "008672"
  description: "Extra attention needed"

- name: "dependencies"
  color: "0366d6"
  description: "Dependency updates"

- name: "breaking change"
  color: "d93f0b"
  description: "Breaking API change"
```

### Milestones

Go to: `Issues` → `Milestones` → `New milestone`

**Create milestones:**

| Milestone | Due Date | Description |
|-----------|----------|-------------|
| **v2.1.0** | 2025-12-15 | Telegram integration, health checks |
| **v2.2.0** | 2026-01-30 | OAuth support, advanced pipelines |
| **v3.0.0** | 2026-03-30 | Major architecture refactor |

---

## GitHub Actions

### Workflows Already Created

✅ **Security Scan** (`.github/workflows/security.yml`)

- CodeQL analysis
- Dependency scanning
- Runs on push, PR, and scheduled

### Additional Recommended Workflows

#### 1. CI/CD Workflow

Create: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test-server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: cd server && npm ci
      - run: cd server && npm test
      - run: cd server && npm run lint

  test-client:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: cd client && npm ci
      - run: cd client && npm test
      - run: cd client && npm run lint
```

#### 2. Auto-label PRs

Create: `.github/workflows/labeler.yml`

```yaml
name: Labeler
on: [pull_request_target]

jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/labeler@v5
        with:
          repo-token: "${{ secrets.GITHUB_TOKEN }}"
          configuration-path: .github/labeler.yml
```

Create: `.github/labeler.yml`

```yaml
server:
  - server/**/*

client:
  - client/**/*

documentation:
  - '**/*.md'
  - docs/**/*

ci/cd:
  - .github/workflows/*
```

---

## Advanced Configuration

### 1. Rulesets (Beta)

Go to: `Settings` → `Rules` → `Rulesets`

More flexible than branch protection with better targeting.

### 2. Environments

Go to: `Settings` → `Environments`

Create deployment environments:

**Production:**

- Required reviewers: Core team
- Wait timer: 5 minutes
- Deployment branches: `main` only
- Environment secrets

**Staging:**

- No required reviewers
- All branches allowed

### 3. Secrets and Variables

Go to: `Settings` → `Secrets and variables` → `Actions`

**Repository secrets:**

```
NPM_TOKEN - For npm publishing
DOCKER_USERNAME - Docker Hub username
DOCKER_PASSWORD - Docker Hub password
SLACK_WEBHOOK - Slack notifications
```

**Repository variables:**

```
NODE_VERSION=18
DEPLOYMENT_URL=https://deploy.example.com
```

### 4. Deploy Keys

Go to: `Settings` → `Deploy keys`

For server deployments that need read-only access:

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "deploy-center-ci"

# Add public key to GitHub
# Add private key to server
```

---

## Verification Checklist

After setup, verify:

- [ ] Repository is public/private as desired
- [ ] Topics and description set
- [ ] Branch protection rules active
- [ ] All security features enabled
- [ ] Dependabot configured
- [ ] Code scanning working
- [ ] Secret scanning active
- [ ] Webhooks configured and tested
- [ ] Team permissions set
- [ ] CODEOWNERS file in place
- [ ] Labels created
- [ ] Milestones created
- [ ] GitHub Actions running
- [ ] Discussions enabled
- [ ] Issue templates working
- [ ] PR template working

---

## Maintenance

### Regular Tasks

**Weekly:**

- Review Dependabot PRs
- Triage new issues
- Review security alerts

**Monthly:**

- Update milestones
- Archive completed milestones
- Review team permissions

**Quarterly:**

- Audit access controls
- Review branch protection rules
- Update documentation

---

## Troubleshooting

### Branch Protection Not Working

- Verify you're pushing to the correct branch
- Check if you have admin bypass enabled
- Ensure status checks exist

### Actions Not Running

- Check Actions permissions
- Verify workflow syntax with `yamllint`
- Check workflow triggers

### Webhook Delivery Failures

- Verify payload URL is accessible
- Check SSL certificate validity
- Verify secret matches
- Review webhook logs

---

## Resources

- [GitHub Docs - Managing repositories](https://docs.github.com/en/repositories)
- [Branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Dependabot](https://docs.github.com/en/code-security/dependabot)

---

## Support

Need help with GitHub setup?

- **Documentation**: [Deploy Center Docs](https://github.com/FutureSolutionDev/Deploy-Center-Server/docs)
- **Discussions**: [GitHub Discussions](https://github.com/FutureSolutionDev/Deploy-Center-Server/discussions)
- **Email**: <info@futuresolutionsdev.com>
