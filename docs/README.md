# Deploy Center Documentation

Welcome to the Deploy Center documentation. This directory contains all guides
and references for using, deploying, and contributing to Deploy Center.

**Current version:** v3.0.0 (Server & Client) — released 2026-05-24.

---

## 📚 Quick Navigation

### 🚀 Getting Started

Start here if you're new to Deploy Center:

1. **[Quick Start Guide](./QUICK_START.md)** — Get up and running in 5 minutes
2. **[Installation Guide](./INSTALLATION.md)** — Detailed installation instructions
3. **[Project Structure](./PROJECT_STRUCTURE.md)** — Understanding the codebase

### 📖 Core Documentation

Essential documentation for daily use:

- **[API Documentation](./API_DOCUMENTATION.md)** — Complete API reference
  (v3.0-specific endpoints are in [`versions/v3.0-foundation.md`](./versions/v3.0-foundation.md) §API)
- **[Webhooks Setup](./WEBHOOKS_SETUP.md)** — Configure GitHub webhooks
- **[GitHub Private Repos Setup](./GITHUB_PRIVATE_REPOS_SETUP.md)** — Connect private repositories
- **[Postman Guide](./POSTMAN_GUIDE.md)** — API testing with Postman
- **[FAQ](./FAQ.md)** — Frequently asked questions

### 🔮 Planning & Roadmap

- **[Roadmap (Master)](./ROADMAP.md)** — Single source of truth for product
  roadmap; every feature has a stable `F-NNN` ID and a target version
- **[Changelog](./CHANGELOG.md)** — Full release history (v1.0 → v3.0)
- **[Migration Guide v2 → v3](./migration-v2-to-v3.md)** — Upgrade path
- **[Release Guide](./RELEASE_GUIDE.md)** — Versioning, release process,
  branch protection, hotfix procedure

### 🏗️ Versions (Per-Release Specs)

Feature specs grouped by release. Each file lists the F-NNN features that
ship in that version:

- [`versions/v3.0-foundation.md`](./versions/v3.0-foundation.md) — **Released** (Foundation)
- [`versions/v3.1-remote-targets.md`](./versions/v3.1-remote-targets.md) — Planned (Remote Targets)
- [`versions/v3.2-governance.md`](./versions/v3.2-governance.md) — Planned (Governance)
- [`versions/v3.3-strategies.md`](./versions/v3.3-strategies.md) — Planned (Smart Strategies)
- [`versions/v4.0-enterprise.md`](./versions/v4.0-enterprise.md) — Backlog (Enterprise)
- [`versions/v4.1-containers.md`](./versions/v4.1-containers.md) — Backlog (Containers)
- [`versions/v4.2-ai-ops.md`](./versions/v4.2-ai-ops.md) — Backlog (AI Ops)
- [`versions/v5.0-cloud-native.md`](./versions/v5.0-cloud-native.md) — Vision (Cloud Native)

### 🎯 Advanced Guides

In-depth guides under [`guides/`](./guides/):

- [Creating projects](./guides/creating-projects.md)
- [Deployment workflows](./guides/deployment-workflows.md)
- [Pipeline configuration](./guides/pipeline-configuration.md)
- [Environment variables](./guides/environment-variables.md)
- [Notifications](./guides/notifications.md)
- [SSH keys](./guides/ssh-keys.md)
- [Webhooks](./guides/webhooks.md)
- [Deployment logs](./guides/deployment-logs.md)
- [GitHub Setup](./guides/GITHUB_SETUP.md)

### 🛠️ Engineering / Quality

- **[Coding Standards](./CODING_STANDARDS.md)** — TypeScript / SOLID conventions
- **[Test Coverage Status](./test-coverage-status.md)** — Current coverage gates
  and per-module breakdown
- **[v3.0 Staging Verification](./v3.0-staging-verification.md)** — Pre-GA
  smoke-test playbook (kept as historical reference for future major releases)

### 🤝 Contributing / Community

GitHub community files live under [`../.github/`](../.github/):

- [Contributing Guide](../.github/CONTRIBUTING.md)
- [Code of Conduct](../.github/CODE_OF_CONDUCT.md)
- [Security Policy](../.github/SECURITY.md)
- [Support](../.github/SUPPORT.md)
- [Authors & Contributors](../.github/AUTHORS.md)

---

## 📂 Documentation Structure

```text
server/
├── README.md                              # GitHub entry point
├── CLAUDE.md                              # AI-agent instructions (project conventions)
├── LICENSE.md                             # Project license (npm convention)
├── .github/                               # GitHub-recognized community files
│   ├── AUTHORS.md
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── SECURITY.md
│   ├── SUPPORT.md
│   ├── FUNDING.yml
│   ├── pull_request_template.md
│   ├── ISSUE_TEMPLATE/
│   └── workflows/                         # GitHub Actions CI
│
└── docs/                                  # ← ALL documentation lives here
    ├── README.md                          # This file — documentation index
    ├── QUICK_START.md                     # 5-minute quick start
    ├── INSTALLATION.md                    # Detailed installation
    ├── PROJECT_STRUCTURE.md               # Codebase architecture
    ├── API_DOCUMENTATION.md               # API reference
    ├── CODING_STANDARDS.md                # TypeScript / SOLID conventions
    ├── FAQ.md                             # Frequently asked questions
    ├── WEBHOOKS_SETUP.md                  # GitHub webhooks configuration
    ├── GITHUB_PRIVATE_REPOS_SETUP.md      # Private repository access
    ├── POSTMAN_GUIDE.md                   # Postman collection guide
    ├── POSTMAN_COLLECTION.json            # Postman collection itself
    ├── ROADMAP.md                         # Master product roadmap
    ├── CHANGELOG.md                       # Full release history (v1 → v3)
    ├── RELEASE_GUIDE.md                   # Release process + CI ops
    ├── migration-v2-to-v3.md              # v2.1 → v3.0 upgrade guide
    ├── test-coverage-status.md            # Coverage gates per module
    ├── v3.0-staging-verification.md       # v3.0 GA smoke-test playbook
    ├── versions/                          # Per-release feature specs
    │   ├── v3.0-foundation.md
    │   ├── v3.1-remote-targets.md
    │   ├── v3.2-governance.md
    │   ├── v3.3-strategies.md
    │   ├── v4.0-enterprise.md
    │   ├── v4.1-containers.md
    │   ├── v4.2-ai-ops.md
    │   └── v5.0-cloud-native.md
    ├── guides/                            # In-depth how-tos
    │   ├── creating-projects.md
    │   ├── deployment-workflows.md
    │   ├── pipeline-configuration.md
    │   ├── environment-variables.md
    │   ├── notifications.md
    │   ├── ssh-keys.md
    │   ├── webhooks.md
    │   ├── deployment-logs.md
    │   └── GITHUB_SETUP.md
    ├── screenshots/                       # UI screenshots
    └── spec-kit/                          # Spec-Kit prompt artifacts
```

> **📌 Documentation rule** (enforced by `CLAUDE.md`): every new documentation
> file MUST live under `server/docs/`. The only `.md` files allowed at the
> repository root are `README.md`, `LICENSE.md`, and `CLAUDE.md`. GitHub
> community files (CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / SUPPORT /
> AUTHORS) live under `.github/` so the GitHub UI surfaces them.

---

## 🎓 Learning Paths

### For New Users

1. [Quick Start Guide](./QUICK_START.md)
2. [Webhooks Setup](./WEBHOOKS_SETUP.md)
3. Create your first deployment
4. [API Documentation](./API_DOCUMENTATION.md)

### For Developers

1. [Project Structure](./PROJECT_STRUCTURE.md)
2. [Coding Standards](./CODING_STANDARDS.md)
3. [API Documentation](./API_DOCUMENTATION.md) + [v3.0 spec](./versions/v3.0-foundation.md)
4. [Contributing Guide](../.github/CONTRIBUTING.md)
5. [Roadmap](./ROADMAP.md) for available features to tackle

### For DevOps Engineers

1. [Installation Guide](./INSTALLATION.md)
2. [Migration v2 → v3](./migration-v2-to-v3.md) (if upgrading from v2.1)
3. [Webhooks Setup](./WEBHOOKS_SETUP.md) + [Private Repos](./GITHUB_PRIVATE_REPOS_SETUP.md)
4. [Release Guide](./RELEASE_GUIDE.md) (branch protection + CI ops)

### For Product Managers

1. [Roadmap](./ROADMAP.md)
2. [Changelog](./CHANGELOG.md) for what's already shipped
3. [Per-version specs](./versions/) for upcoming feature detail

---

## 🔍 Quick Reference

### Installation

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your configuration (DB, Redis, JWT secrets, encryption key)
npm run build
npm start
# Or for development:
npm run dev
```

See [Installation Guide](./INSTALLATION.md) for details.

### API endpoints

**Base URL:** `http://localhost:9090/api`

**Authentication:** JWT via httpOnly cookies (access + refresh tokens).

See [API Documentation](./API_DOCUMENTATION.md) for the v2.1 surface and
[`versions/v3.0-foundation.md`](./versions/v3.0-foundation.md) §API for the
v3.0-added endpoints (Workspaces, Templates, Env Vars, Notification
Providers/Channels, Rollback, Log download, Bull Board admin UI).

### Common tasks

| Task                       | Documentation                                                |
|----------------------------|--------------------------------------------------------------|
| Install Deploy Center      | [Installation Guide](./INSTALLATION.md)                      |
| Quick start                | [Quick Start](./QUICK_START.md)                              |
| Upgrade v2.1 → v3.0        | [Migration Guide](./migration-v2-to-v3.md)                   |
| Configure webhooks         | [Webhooks Setup](./WEBHOOKS_SETUP.md)                        |
| Test APIs                  | [Postman Guide](./POSTMAN_GUIDE.md)                          |
| Connect private repos      | [Private Repos](./GITHUB_PRIVATE_REPOS_SETUP.md)             |
| Review roadmap             | [ROADMAP.md](./ROADMAP.md)                                   |
| Cut a release              | [Release Guide](./RELEASE_GUIDE.md)                          |
| Contribute code            | [Contributing](../.github/CONTRIBUTING.md)                   |
| Report security issue      | [Security Policy](../.github/SECURITY.md)                    |

---

## 🆘 Getting Help

- **GitHub Issues** — [Report bugs / request features](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues)
- **GitHub Discussions** — [Ask questions / share ideas](https://github.com/FutureSolutionDev/Deploy-Center-Server/discussions)
- **Email** — <support@futuresolutionsdev.com>

See [SUPPORT.md](../.github/SUPPORT.md) for the full list of support options.

---

## 📝 Contributing to Documentation

Documentation improvements are always welcome. Standards:

- Use **Markdown** (CommonMark) formatting.
- Include **code examples** wherever applicable.
- Add **screenshots** for UI-related docs under `docs/screenshots/`.
- Keep the **table of contents** updated.
- Use **clear, concise language** (English for code/API docs, Arabic acceptable
  in contributor-focused docs).
- All new docs go under `docs/` — never in the repo root.

See [Contributing Guide](../.github/CONTRIBUTING.md) for the PR workflow.

---

## 🔗 External Resources

**Tech stack:**

- [Node.js](https://nodejs.org/docs) · [TypeScript](https://www.typescriptlang.org/docs/) · [Express](https://expressjs.com/en/guide/routing.html)
- [Sequelize](https://sequelize.org/) · [Socket.IO](https://socket.io/docs/) · [BullMQ](https://docs.bullmq.io/) · [ioredis](https://github.com/redis/ioredis)
- [React](https://react.dev/) · [Material-UI](https://mui.com/) · [TanStack Query](https://tanstack.com/query)

**Tools:**

- [GitHub Webhooks](https://docs.github.com/en/webhooks)
- [PM2 Process Manager](https://pm2.keymetrics.io/)
- [Docker](https://docs.docker.com/)
- [Nginx](https://nginx.org/en/docs/)

---

<div align="center">

**Need help?** [Open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues) or [contact support](mailto:support@futuresolutionsdev.com)

**Want to contribute?** See [Contributing Guide](../.github/CONTRIBUTING.md)

**© 2024-2026 FutureSolutionDev. All Rights Reserved.**

</div>
