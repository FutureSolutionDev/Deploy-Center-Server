# 📋 Changelog

> كل التغييرات الملحوظة في **Deploy Center** تُوثّق هنا.
> الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
> المشروع يتبع [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — v3.0 (Foundation)

**Target Date:** 2026-06-25
**Status:** 🟡 Active Development

### Planned Features

- **F-001** — BullMQ + Redis Persistent Queue
- **F-002** — Testing Foundation (Unit + Integration ≥40%)
- **F-003** — Encrypted Environment Variables
- **F-004** — Real-time Logs Streaming + Export (.txt)
- **F-005** — Local Git Bare Cache
- **F-006** — Multi-Channel Notifications (Slack + Email)
- **F-007** — Rollback UI + Service Hardening
- **F-008** — Project Templates (Node/React/Static/Next)
- **F-009** — Workspaces (Visual Organization)
- **F-010** — CI Pipeline (GitHub Actions)

📄 **تفاصيل كاملة:** [versions/v3.0-foundation.md](./versions/v3.0-foundation.md)

---

## [2.1.0] — 2024-12-28

### Added

- ✅ **RBAC Enhancement** — Complete project-level access control
- ✅ **Project Members System** — Add/remove team members per project
- ✅ Frontend RBAC for Projects, Deployments, Queue, Settings pages
- ✅ `ProjectMembersCard` component for member management
- ✅ Deployment filtering by project membership
- ✅ Queue filtering by project membership

### Changed

- `ProjectService.GetAllProjects()` — Added user filtering
- `DeploymentService.GetAllDeployments()` — Added user filtering
- `DeploymentController.GetQueueStatus()` — Added user filtering

### Files Changed

- `server/src/Services/ProjectService.ts`
- `server/src/Services/DeploymentService.ts`
- `server/src/Controllers/ProjectController.ts`
- `server/src/Controllers/DeploymentController.ts`
- `client/src/pages/Projects/ProjectDetailsPage.tsx`
- `client/src/pages/Projects/components/ProjectMembersCard.tsx`
- `client/src/pages/Deployments/DeploymentsPage.tsx`
- `client/src/pages/Queue/QueuePage.tsx`
- `client/src/pages/Settings/SettingsPage.tsx`

---

## [2.0.x] — 2024-12-20

### Added

- ✅ **Pipeline Enhancements** — Improved error handling
- ✅ Better log formatting via `LogFormatter` utility
- ✅ Deployment duration tracking
- ✅ Conditional step execution
- ✅ Variable substitution system

---

## [1.x] — 2024-12-15

### Added

- ✅ **Real-Time Updates** — Socket.IO integration
- ✅ Live deployment status updates
- ✅ Queue status WebSocket events

---

## [1.0.0] — 2024-11-26

### Added

- ✅ **Project Management** — CRUD + archive
- ✅ **JWT Authentication** — access + refresh tokens
- ✅ **SSH Key Management** — ED25519/RSA + AES-256-GCM
- ✅ **GitHub Webhook Integration** — signature verification
- ✅ **Discord Notifications** — webhook embeds
- ✅ **Audit Logging** — complete activity tracking
- ✅ Database migrations system

---

## Future Versions (Planned)

### [v3.1] — 2026-07-25 (Remote Targets)
**Status:** 🔵 Planned

Features: F-011 → F-021 (11 features)
📄 **تفاصيل:** [versions/v3.1-remote-targets.md](./versions/v3.1-remote-targets.md)

### [v3.2] — 2026-08-25 (Governance)
**Status:** 🔵 Planned

Features: F-022 → F-033 (12 features)
📄 **تفاصيل:** [versions/v3.2-governance.md](./versions/v3.2-governance.md)

### [v3.3] — 2026-09-30 (Smart Strategies)
**Status:** 🔵 Planned

Features: F-034 → F-047 (14 features)
📄 **تفاصيل:** [versions/v3.3-strategies.md](./versions/v3.3-strategies.md)

### [v4.0] — 2026-12-15 (Enterprise Suite)
**Status:** ⚪ Backlog

Features: F-048 → F-071 (24 features)
📄 **تفاصيل:** [versions/v4.0-enterprise.md](./versions/v4.0-enterprise.md)

### [v4.1] — 2027-03-15 (Container Era)
**Status:** ⚪ Backlog

Features: F-072 → F-085 (14 features)
📄 **تفاصيل:** [versions/v4.1-containers.md](./versions/v4.1-containers.md)

### [v4.2] — 2027-06-15 (AI Operations)
**Status:** ⚪ Backlog

Features: F-086 → F-097 (12 features)
📄 **تفاصيل:** [versions/v4.2-ai-ops.md](./versions/v4.2-ai-ops.md)

### [v5.0] — 2027-Q3+ (Cloud Native)
**Status:** ⚪ Vision

Features: F-098 → F-119 (22 features)
📄 **تفاصيل:** [versions/v5.0-cloud-native.md](./versions/v5.0-cloud-native.md)

---

## Backlog (Idea Pool)

Features F-120 → F-137 — أفكار لم تُجدول بعد.
📄 **تفاصيل:** [ROADMAP.md#-backlog--idea-pool](./ROADMAP.md#-backlog--idea-pool-18-ميزة-لم-تُجدول-بعد)

---

> **كيفية تحديث هذا الملف:**
> 1. عند بدء العمل على نسخة → ينقل من "Future" إلى "Unreleased"
> 2. عند إطلاق RC → حدّث الـ status
> 3. عند GA → ينقل من "Unreleased" إلى نسخة محددة بتاريخ ثابت
