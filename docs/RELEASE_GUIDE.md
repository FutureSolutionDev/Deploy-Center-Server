# Deploy Center - Release Guide

This guide outlines the complete release process for Deploy Center, ensuring consistent, high-quality releases.

## Table of Contents

- [Versioning Strategy](#versioning-strategy)
- [Pre-Release Checklist](#pre-release-checklist)
- [Release Process](#release-process)
- [Post-Release Tasks](#post-release-tasks)
- [Hotfix Procedure](#hotfix-procedure)
- [Rollback Procedure](#rollback-procedure)
- [npm Publishing](#npm-publishing)
- [Docker Publishing](#docker-publishing)

---

## Versioning Strategy

Deploy Center follows [Semantic Versioning](https://semver.org/) (SemVer):

### Version Format: `MAJOR.MINOR.PATCH`

- **MAJOR** (`X.0.0`) - Breaking changes, incompatible API changes
- **MINOR** (`0.X.0`) - New features, backward-compatible functionality
- **PATCH** (`0.0.X`) - Bug fixes, backward-compatible improvements

### Examples

| Change Type | Example | New Version |
|-------------|---------|-------------|
| Bug fix | Fix webhook signature verification | `2.0.0` → `2.0.1` |
| New feature | Add Telegram notifications | `2.0.1` → `2.1.0` |
| Breaking change | Change API authentication method | `2.1.0` → `3.0.0` |

### Pre-Release Versions

- **Alpha**: `2.1.0-alpha.1` - Early development, unstable
- **Beta**: `2.1.0-beta.1` - Feature complete, testing phase
- **RC**: `2.1.0-rc.1` - Release candidate, final testing

---

## Pre-Release Checklist

### 1. Code Quality

- [ ] All tests passing (unit, integration, e2e)
- [ ] No linting errors (`npm run lint`)
- [ ] Code coverage meets minimum threshold (80%+)
- [ ] No security vulnerabilities (`npm audit`)
- [ ] CodeQL security scan passed
- [ ] All TypeScript compilation errors resolved

### 2. Documentation

- [ ] `CHANGELOG.md` updated with all changes
- [ ] `README.md` reflects new features/changes
- [ ] API documentation updated (if applicable)
- [ ] Migration guide created (for breaking changes)
- [ ] All new features documented
- [ ] Screenshots/GIFs updated (if UI changed)

### 3. Dependencies

- [ ] All dependencies up to date
- [ ] No deprecated packages in use
- [ ] License compatibility verified
- [ ] Bundle size acceptable (check with `npm run analyze`)

### 4. Database & Migrations

- [ ] All migrations tested
- [ ] Rollback migrations tested
- [ ] Database schema documented
- [ ] Seed data updated (if applicable)

### 5. Configuration

- [ ] Environment variables documented
- [ ] `.env.example` updated
- [ ] Configuration validation working
- [ ] Default values reviewed

### 6. Testing

- [ ] Manual testing completed
- [ ] Regression testing completed
- [ ] Performance testing completed
- [ ] Load testing (for major releases)
- [ ] Cross-browser testing (client)
- [ ] Mobile responsiveness verified (client)

---

## Release Process

### Step 1: Prepare the Release

```bash
# Ensure you're on the main branch with latest changes
git checkout main
git pull origin main

# Create a release branch
git checkout -b release/v2.1.0
```

### Step 2: Update Version Numbers

**Server:**

```bash
cd server
npm version minor  # or major/patch
cd ..
```

**Client:**

```bash
cd client
npm version minor  # or major/patch
cd ..
```

**Manual Updates:**

- Update version in `README.md` badges
- Update version in `package.json` files (if not done by npm version)
- Update version in Docker files (if applicable)

### Step 3: Update CHANGELOG.md

Add release notes following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [2.1.0] - 2025-11-28

### Added
- Telegram notification integration
- Project health check endpoint
- Deployment rollback functionality

### Changed
- Improved webhook signature verification
- Updated TypeScript to v5.3
- Enhanced error logging with structured logs

### Fixed
- Pipeline execution race condition
- Discord notification delivery failures
- Memory leak in deployment queue

### Security
- Fixed JWT token expiration validation
- Added rate limiting to API endpoints
- Upgraded dependencies with security patches

### Deprecated
- Old `/api/v1/deploy` endpoint (use `/api/v2/deploy`)

### Removed
- Legacy file-based configuration (use database)
```

### Step 4: Commit Release Changes

```bash
git add .
git commit -m "chore(release): prepare v2.1.0"
git push origin release/v2.1.0
```

### Step 5: Create Pull Request

- Create PR from `release/v2.1.0` to `main`
- Title: `Release v2.1.0`
- Description: Copy changelog content
- Request reviews from maintainers
- Ensure all CI/CD checks pass

### Step 6: Merge and Tag

```bash
# After PR approval, merge to main
git checkout main
git pull origin main

# Create annotated tag
git tag -a v2.1.0 -m "Release v2.1.0

- Telegram notification integration
- Project health check endpoint
- Deployment rollback functionality
See CHANGELOG.md for full details"

# Push tag to trigger release workflows
git push origin v2.1.0
```

### Step 7: Create GitHub Release

Go to GitHub repository → Releases → Draft a new release

**Settings:**

- **Tag**: `v2.1.0`
- **Target**: `main`
- **Release title**: `Deploy Center v2.1.0`
- **Description**:

  ```markdown
  ## 🚀 What's New in v2.1.0
  
  ### ✨ New Features
  - 📱 Telegram notification integration
  - 🏥 Project health check endpoint
  - ↩️ Deployment rollback functionality
  
  ### 🔧 Improvements
  - Enhanced webhook signature verification
  - Improved error logging with structured logs
  
  ### 🐛 Bug Fixes
  - Fixed pipeline execution race condition
  - Resolved Discord notification delivery issues
  
  ### 📚 Documentation
  - Added Telegram setup guide
  - Updated API documentation
  
  ## 📦 Installation
  
  See [Installation Guide](https://github.com/FutureSolutionDev/Deploy-Center-Server#installation)
  
  ## 🔄 Upgrade Instructions
  
  ```bash
  git pull origin main
  cd server && npm install
  npm run migrate
  pm2 restart deploy-center
  ```
  
  ## 📖 Full Changelog
  
  [View full changelog](https://github.com/FutureSolutionDev/Deploy-Center-Server/blob/main/CHANGELOG.md#210---2025-11-28)

  ```

- **Artifacts**: Attach any release binaries/packages
- **Pre-release**: Check if this is a pre-release
- **Latest**: Set as latest release

---

## Post-Release Tasks

### 1. Verify Release

- [ ] GitHub release created successfully
- [ ] Docker images built and pushed (if applicable)
- [ ] npm packages published (if applicable)
- [ ] Release notes visible on GitHub
- [ ] All artifacts attached

### 2. Update Documentation Sites

- [ ] Update documentation website (if separate)
- [ ] Update API documentation
- [ ] Update examples repository

### 3. Announce Release

**GitHub:**

- [ ] Create GitHub Discussion announcement
- [ ] Update project README with latest version

**Social Media:**

- [ ] Tweet release announcement
- [ ] Post on LinkedIn
- [ ] Post on Discord community (if applicable)

**Email:**

- [ ] Notify mailing list subscribers
- [ ] Notify enterprise customers

### 4. Monitor

- [ ] Monitor error tracking (Sentry, etc.)
- [ ] Check deployment success rate
- [ ] Review user feedback/issues
- [ ] Monitor performance metrics

### 5. Cleanup

```bash
# Delete release branch
git branch -d release/v2.1.0
git push origin --delete release/v2.1.0

# Update develop branch (if using git-flow)
git checkout develop
git merge main
git push origin develop
```

---

## Hotfix Procedure

For critical bugs in production that need immediate release:

### 1. Create Hotfix Branch

```bash
git checkout main
git pull origin main
git checkout -b hotfix/v2.1.1
```

### 2. Fix the Issue

```bash
# Make necessary fixes
# Update tests
# Update CHANGELOG.md
```

### 3. Version Bump

```bash
cd server
npm version patch
cd ../client
npm version patch
```

### 4. Commit and Tag

```bash
git add .
git commit -m "fix: critical security vulnerability in authentication"
git tag -a v2.1.1 -m "Hotfix v2.1.1 - Security patch"
```

### 5. Merge to Main and Develop

```bash
# Merge to main
git checkout main
git merge hotfix/v2.1.1
git push origin main v2.1.1

# Merge to develop
git checkout develop
git merge hotfix/v2.1.1
git push origin develop

# Delete hotfix branch
git branch -d hotfix/v2.1.1
```

### 6. Create GitHub Release

Follow the same GitHub release process as regular releases.

---

## Rollback Procedure

If a release causes critical issues in production:

### 1. Immediate Rollback

**Using Git Tags:**

```bash
# Revert to previous version
git checkout v2.0.1

# For production deployment
pm2 restart deploy-center
```

**Using GitHub Releases:**

- Download previous release artifacts
- Deploy previous version

### 2. Database Rollback (if needed)

```bash
# Rollback migrations
npm run migrate:rollback

# Or manually restore database backup
```

### 3. Communication

- [ ] Update GitHub release - mark as problematic
- [ ] Post incident report issue
- [ ] Notify users via email/social media
- [ ] Update status page

### 4. Fix and Re-Release

```bash
# Create hotfix for the issue
git checkout -b hotfix/v2.1.1
# Fix issues
# Follow hotfix procedure above
```

---

## npm Publishing

### Prerequisites

```bash
# Login to npm
npm login

# Verify authentication
npm whoami
```

### Publishing Server Package

```bash
cd server

# Dry run to verify package contents
npm publish --dry-run

# Publish to npm
npm publish --access public

# Or for scoped package
npm publish --access public
```

### Publishing Client Package (if applicable)

```bash
cd client

# Build production bundle
npm run build

# Publish
npm publish --access public
```

### Verify Publication

```bash
# Check package on npm
npm view @futuresolutiondev/deploy-center-server

# Test installation
npm install @futuresolutiondev/deploy-center-server
```

---

## Docker Publishing

### Build Docker Images

```bash
# Build server image
docker build -t futuresolutiondev/deploy-center-server:2.1.0 -f server/Dockerfile .
docker build -t futuresolutiondev/deploy-center-server:latest -f server/Dockerfile .

# Build client image (if separate)
docker build -t futuresolutiondev/deploy-center-client:2.1.0 -f client/Dockerfile .
docker build -t futuresolutiondev/deploy-center-client:latest -f client/Dockerfile .
```

### Test Images Locally

```bash
# Run container
docker run -p 3000:3000 futuresolutiondev/deploy-center-server:2.1.0

# Verify functionality
curl http://localhost:3000/health
```

### Push to Docker Hub

```bash
# Login to Docker Hub
docker login

# Push versioned images
docker push futuresolutiondev/deploy-center-server:2.1.0
docker push futuresolutiondev/deploy-center-client:2.1.0

# Push latest tags
docker push futuresolutiondev/deploy-center-server:latest
docker push futuresolutiondev/deploy-center-client:latest
```

### Verify on Docker Hub

Visit: <https://hub.docker.com/r/futuresolutiondev/deploy-center-server>

---

## Release Schedule

### Regular Releases

- **Major**: Yearly or as needed for breaking changes
- **Minor**: Monthly or bi-monthly for new features
- **Patch**: As needed for bug fixes (typically weekly)

### Release Windows

- **Beta Release**: First Monday of the month
- **Stable Release**: Third Monday of the month
- **Hotfixes**: Any time for critical issues

### Support Policy

- **Current Version** (v2.x): Full support
- **Previous Major** (v1.x): Security patches only (6 months)
- **Older Versions**: End of life, no support

---

## Troubleshooting

### Failed GitHub Release

```bash
# Delete and recreate tag
git tag -d v2.1.0
git push origin :refs/tags/v2.1.0
git tag -a v2.1.0 -m "Release v2.1.0"
git push origin v2.1.0
```

### npm Publish Failures

```bash
# Check npm credentials
npm whoami

# Clear cache and retry
npm cache clean --force
npm publish
```

### Docker Build Issues

```bash
# Clear build cache
docker builder prune -a

# Rebuild with no cache
docker build --no-cache -t image:tag .
```

---

## Resources

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [npm Publishing Guide](https://docs.npmjs.com/cli/v8/commands/npm-publish)

---

## Contact

For questions about the release process:

- **Email**: <info@futuresolutionsdev.com>
- **GitHub Discussions**: [Deploy Center Discussions](https://github.com/FutureSolutionDev/Deploy-Center-Server/discussions)
- **Issue Tracker**: [Report Issues](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues)
