# 📋 Changelog

> كل التغييرات الملحوظة في **Deploy Center** تُوثّق هنا.
> الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
> المشروع يتبع [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] — 2026-05-24

**Status:** 🟢 Released
**Theme:** Foundation — wipe out the five critical v2.1 debts + add five high-value UX wins.

### Added

- **F-001 — Persistent deployment queue.** Replaced the in-memory
  `Map<projectId, Item[]>` with a BullMQ/Redis-backed queue. Deployments
  now survive server restart. Retry policy: 3 attempts, exponential
  backoff (1s → 5s → 25s). New `Deployment.QueueJobId` column for
  job↔row correlation. Bull Board admin UI mounted at
  `/admin/queues` (Admin only). 503 short-circuit via
  `QueueReadyMiddleware` when Redis is unreachable.
- **F-002 — Testing foundation.** Jest + ts-jest scaffold under
  `server/__tests__/` mirroring `src/`. Coverage gate ratcheted from
  0 % → 40 % across 4 weeks (GA gate). Vitest gate for client at 30 %.
  Unit + integration tests for Encryption, Password, SSH key gen, log
  formatter, AutoRecovery, QueueService, NotificationService dispatchers,
  AuditLogService, plus integration tests for Auth, Projects, Users,
  Deployments, EnvVars, Notifications, Rollback.
- **F-003 — Encrypted environment variables.** New
  `EnvironmentVariables` table with AES-256-GCM at rest, unique IV per
  row. API: `GET/POST/PUT/DELETE /api/projects/:id/env-vars`
  (Admin/Manager). Injected into `process.env` during pipeline
  `spawn()`; secret values redacted from logs (FR-013).
- **F-004 — Log download.** `GET /api/deployments/:id/log/download`
  returns the deployment log as a `text/plain` attachment. Frontend
  "Download Log" + "Copy to Clipboard" buttons; auto-scroll toggle for
  live logs.
- **F-005 — Local Git bare cache.** First deploy creates
  `server/deployments/cache/project-{id}.git/`; subsequent deploys
  `--reference` it for ~85 % deploy-time / ~70 % disk savings.
- **F-006 — Multi-channel notifications.** Strategy-pattern refactor
  with three new dispatchers (Discord, Slack, Email). Three new tables:
  `NotificationProviders` (credentials, encrypted), `NotificationChannels`
  (delivery targets, encrypted), `ProjectNotificationSubscriptions`
  (M:N + event filter). Fan-out via `Promise.allSettled` — one channel
  failing does not block the others (FR-025b). Test endpoint per channel
  + per provider. Settings UI tab + per-project subscription card.
- **F-007 — Rollback UI.** New `EAuditAction.DeploymentRolledBack` and
  `ETriggerType.Rollback`. `POST /api/deployments/:id/rollback` creates a
  new deployment with the project's last successful commit, queued via
  BullMQ. New `deployment:rollback-queued` socket event. UI button auto-
  hides on non-failed deployments and disables with tooltip when there's
  no prior success or commits already match.
- **F-008 — Project templates.** Migration 017 seeds 5 built-ins
  (Node.js Backend, React SPA (Vite), Next.js, Static HTML, Astro). New
  `ProjectTemplateWizard` runs as Step 0 of Create-Project. Built-ins
  are immutable (422 on Update/Delete). Custom templates editable by
  Admin/Manager.
- **F-009 — Workspaces.** Migration 016 adds `Workspaces` table +
  nullable `Project.WorkspaceId`. ProjectsPage rewritten as a
  workspace-first grid with drag-and-drop project reassignment
  (`@dnd-kit`). "Unassigned" group always present. Owner-or-admin
  RBAC for workspace mutation; open to all for viewing.
- **F-010 — GitHub Actions CI.** `.github/workflows/ci.yml` runs server
  typecheck + lint + jest --coverage AND client typecheck + lint +
  vitest + build. Coverage gates wired to the jest/vitest configs.

### Changed

- `EAuditAction` extended with `DeploymentRolledBack`.
- `ETriggerType` extended with `Rollback`.
- `ResponseHelper` gains `Conflict` (409) and `UnprocessableEntity` (422)
  helpers used by F-007 + F-008.
- `NotificationService` refactored to fan out via the new
  Provider/Channel/Subscription model while preserving the legacy
  Project.Config.Notifications path for v2.1 backward compat.

### Database

- Migrations applied (in actual MigrationRunner order): 009, 012, 013, 016,
  017, 018, 019, 020, 021, 999.
- Migration 020 drops 7 legacy `UserSettings.Notify*` columns that were
  never wired to deployment fan-out.
- Migration 021 widens `Deployments.{ErrorMessage,CommitMessage}` from
  `TEXT` (64 KB) to `LONGTEXT` (4 GB) — fixes a pre-existing v2.1 bug
  where the original 007 file body was an accidental copy of 008, so the
  intended widening never ran on any upgrade.
- Migration 999 is one-shot data: re-enqueues v2.1 pending/queued
  deployments into BullMQ with an audit row. Idempotent via
  `QueueJobId IS NULL` guard.
- Migration numbers 010, 011, 014, 015 are reserved for v3.1.

### Compatibility

- **No breaking changes for v2.1 API clients.** All new columns are
  nullable; all new endpoints are additive (NFR-001).
- **`DISCORD_WEBHOOK_URL` env var still honored** as the legacy
  notification path — deprecated in v3.0, will be removed in v3.1.
- **`Project.Config.envVars` JSON still honored** alongside the new
  encrypted `EnvironmentVariables` table — deprecated in v3.0, will be
  removed in v3.1.

### Operator notes

- **Redis 7+ required.** See [migration-v2-to-v3.md](./migration-v2-to-v3.md)
  §1 for the docker-compose recipe.
- Bull Board lives at `/admin/queues` and is admin-only.
- See `server/docs/migration-v2-to-v3.md` for full upgrade steps,
  including the F-003 envVars migration helper SQL.

📄 **Full feature spec:** [versions/v3.0-foundation.md](./versions/v3.0-foundation.md)
📄 **Migration guide:** [migration-v2-to-v3.md](./migration-v2-to-v3.md)

---

## [2.1.2] - 2026-01-04

### Added

- Real-time deployment logging with structured `LogFormatter` outputs across clone, sync, post-deploy, rollback, and completion phases, emitted through `SocketService` for live UI updates (commit 8b8b434232d5978f7927a30934ac2b71583ab689).
- Post-deployment pipelines run **after** rsync in each production path (with per-path execution markers); includes optional pre-sync backups and rollback on failure to keep production safe.
- Post-deployment pipelines now emit start/success/failure logs and per-path execution markers when multiple production paths are used, giving clearer visibility into each post phase.
- Detailed pipeline step logging now includes formatted commands, outputs, warnings, and SSH authentication context to improve traceability and debugging during deployments.

### Changed

- Registered new migrations in `MigrationRunner` to grow log-related columns and prevent truncation of verbose deployment logs.
- Updated lint tooling to `@typescript-eslint/*` v8.51 and aligned package version to 2.1.1.

### Database

- **Migration 006**: Increase `DeploymentSteps.Output` and `DeploymentSteps.Error` to `LONGTEXT` (model updated in `src/Models/DeploymentStep.ts`).
- **Migration 007**: Increase `Deployments.ErrorMessage` and `Deployments.CommitMessage` to `LONGTEXT` (model updated in `src/Models/Deployment.ts`).
- **Migration 008**: Increase `ProjectAuditLogs.Changes` to `LONGTEXT` (model updated in `src/Models/ProjectAuditLog.ts`).

---

## [2.1.1] - 2025-12-28

### ✨ Added

#### Multiple Deployment Paths

- Added support for deploying to multiple paths simultaneously
  - Changed `ProjectPath` from single string to array of strings (`DeploymentPaths`)
  - Projects can now sync/deploy to multiple directories in parallel
  - Each path is processed independently with its own success/failure tracking

#### Enhanced Deployment Logging

- Added executed command to deployment step logs
  - Each step now shows the exact command that was executed
  - Improves debugging and troubleshooting capabilities
  - Command is displayed in step output for transparency

### 🐛 Fixed

#### npm Warning Display

- Fixed npm warnings (`npm warn`) incorrectly appearing as errors in deployment logs
  - Warnings now properly categorized and displayed separately
  - Error detection improved to only flag actual errors
  - Better log parsing for npm output

### 🔄 Changed

#### Database Schema Updates

- **Migration 004**: Convert `ProjectPath` to `DeploymentPaths` (JSON array)
  - Backward compatible: migrates existing single paths to array format
  - Index updated to support new structure

#### API Endpoint Changes

- Updated Project creation/update endpoints to accept `DeploymentPaths` array
- Maintained backward compatibility with `ProjectPath` for legacy clients

#### Frontend UI Updates

- Updated Project form to support multiple deployment paths
  - Dynamic path input fields (add/remove)
  - Validation for each path
  - Visual indicator for path synchronization status

---

## [2.1.0] - 2025-12-28

### 🎯 Major Feature: Strict RBAC with Multi-Owner Project Support

Complete implementation of Role-Based Access Control (RBAC) with support for multiple owners per project and comprehensive audit logging.

### ✨ Added

#### **New Roles**

- Added `Manager` role to the system
  - Full access to all projects
  - Can assign/remove project members
  - Cannot be assigned as project member (admin-level role)

#### **New Models**

- **ProjectMember Model** (`server/src/Models/ProjectMember.ts`)
  - Enables many-to-many relationship between Projects and Users
  - Distinguishes between `owner` (creator) and `member` (assigned developer)
  - Tracks who added the member and when
  - Unique constraint on (ProjectId, UserId)
  - Prevents duplicate memberships

- **ProjectAuditLog Model** (`server/src/Models/ProjectAuditLog.ts`)
  - Comprehensive audit trail for all project modifications
  - Tracks: Action, EntityType, Changes (JSON), IP Address, User Agent, Timestamp
  - Supported actions:
    - `create`, `update`, `delete`
    - `add_member`, `remove_member`
    - `regenerate_webhook`
    - `toggle_ssh_key`, `regenerate_ssh_key`
  - Indexes on ProjectId, UserId, Timestamp, and Action for fast queries

#### **New Database Migrations**

- **Migration 002** (`002_create_project_members.ts`)
  - Creates ProjectMembers table
  - Migrates existing projects (adds creators as owners)
  - Adds unique constraint on (ProjectId, UserId)
  - Adds indexes for performance

- **Migration 003** (`003_create_project_audit_logs.ts`)
  - Creates ProjectAuditLogs table
  - Adds comprehensive indexes for querying audit history

#### **New Service**

- **AuditLogService** (`server/src/Services/AuditLogService.ts`)
  - Centralized audit logging for all modifications
  - Automatically captures IP address and User Agent
  - Helper methods for common operations:
    - `RecordProjectCreation()`
    - `RecordProjectUpdate()` - tracks changed fields
    - `RecordProjectDeletion()`
    - `RecordWebhookRegeneration()`
    - `RecordSshKeyToggle()`
    - `RecordMemberAddition()`
    - `RecordMemberRemoval()`
    - `RecordConfigUpdate()`
    - `RecordPipelineUpdate()`

#### **New API Endpoints**

- `GET /api/projects/:id/members` - Get all members of a project
- `POST /api/projects/:id/members` - Add member to project (Admin/Manager only)
- `DELETE /api/projects/:id/members/:userId` - Remove member from project (Admin/Manager only)

#### **New Middleware Methods**

- **RoleMiddleware**:
  - `RequireAdminOrManager` - For admin/manager-only operations
  - `RequireAdminManagerOrDeveloper` - For all non-viewer operations
  - `IsManager()` - Check if user is a manager
  - `IsAdminOrManager()` - Check if user is admin or manager

- **ProjectAccessMiddleware**:
  - `CheckProjectDeleteAccess` - STRICT validation for project deletion
    - Only allows owners to delete (members cannot delete)
    - Admin/Manager have full access

### 🔧 Changed

#### **Permission System Overhaul**

- **Project Creation**:
  - BEFORE: Admin only
  - AFTER: Admin, Manager, or Developer
  - Developers automatically become owners of their created projects

- **Project Update**:
  - BEFORE: Admin only
  - AFTER: Admin/Manager or Project Owner/Member
  - All modifications are audit logged

- **Project Deletion** (STRICT):
  - BEFORE: Admin only
  - AFTER: Admin/Manager or Project **Owner ONLY**
  - Members **CANNOT** delete projects (even if they can modify)
  - Deletion is audit logged before execution

- **Webhook Regeneration**:
  - BEFORE: Admin only
  - AFTER: Admin/Manager or Project Owner/Member
  - Audit logged with timestamp

#### **Enhanced Middleware**

- **ProjectAccessMiddleware** - Complete rewrite:
  - Now checks `ProjectMember` table instead of `CreatedBy` field
  - Stores membership info in `req.projectMembership` for controllers
  - Three validation levels:
    - `CheckProjectAccess` - View access (owners + members)
    - `CheckProjectModifyAccess` - Modification access (owners + members)
    - `CheckProjectDeleteAccess` - Delete access (owners only - STRICT)

#### **Service Layer Updates**

- **ProjectService.CreateProject()**:
  - Now accepts `Request` parameter for audit logging
  - Automatically adds creator as owner in ProjectMember table
  - Records project creation in audit log

- **ProjectService.UpdateProject()**:
  - Now accepts `Request` parameter for audit logging
  - Tracks changed fields automatically
  - Records before/after values in audit log
  - Only logs if fields actually changed

- **ProjectService.DeleteProject()**:
  - Now accepts `Request` parameter for audit logging
  - Records deletion in audit log before soft delete

- **ProjectService.RegenerateWebhookSecret()**:
  - Now accepts `Request` parameter for audit logging
  - Records webhook regeneration with timestamp

- **ProjectService.ToggleSshKeyUsage()**:
  - Now accepts `Request` parameter for audit logging
  - Records SSH key toggle with enabled/disabled state

- **New ProjectService Methods**:
  - `GetProjectMembers(projectId)` - Get all members with user details
  - `AddProjectMember(projectId, userId, role, addedBy, req)` - Add member with audit log
  - `RemoveProjectMember(projectId, userId, req)` - Remove member with validation
    - Prevents removing the last owner from a project

#### **Model Associations**

- Added associations for ProjectMember:
  - `Project.hasMany(ProjectMember, { as: 'Members' })`
  - `User.hasMany(ProjectMember, { as: 'ProjectMemberships' })`

- Added associations for ProjectAuditLog:
  - `Project.hasMany(ProjectAuditLog, { as: 'AuditLogs' })`
  - `User.hasMany(ProjectAuditLog, { as: 'ProjectAuditLogs' })`

### 🔒 Security Enhancements

#### **Strict Permission Enforcement**

1. Developers can only delete projects they **own** (Role='owner' in ProjectMember)
2. Members can modify but **cannot delete** projects
3. Cannot remove the last owner from a project
4. All modifications are logged with IP address and User Agent
5. Before/after values tracked for all changes

#### **Audit Trail**

- Every project modification is logged with:
  - User ID (who made the change)
  - IP Address (where the change came from)
  - User Agent (what client was used)
  - Timestamp (when it happened)
  - Changes (what changed - JSON format with before/after)
  - Action type (create, update, delete, etc.)
  - Entity type (project, config, pipeline, etc.)

### 📊 Final Permission Matrix

| Action | Admin | Manager | Developer (Owner) | Developer (Member) | Viewer |
|--------|-------|---------|-------------------|-------------------|--------|
| Create Project | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Project | ✅ | ✅ | ✅ (own/member) | ✅ (own/member) | ✅ (all) |
| Update Project | ✅ | ✅ | ✅ (own/member) | ✅ (own/member) | ❌ |
| **Delete Project** | ✅ | ✅ | ✅ **Owner ONLY** | ❌ **Cannot** | ❌ |
| Regenerate Webhook | ✅ | ✅ | ✅ (own/member) | ✅ (own/member) | ❌ |
| Add Member | ✅ | ✅ | ❌ | ❌ | ❌ |
| Remove Member | ✅ | ✅ | ❌ | ❌ | ❌ |
| SSH Operations | ✅ | ✅ | ✅ (with access) | ✅ (with access) | ❌ |

### 🗄️ Database Schema Changes

```sql
-- New Table: ProjectMembers
CREATE TABLE ProjectMembers (
  Id INT PRIMARY KEY AUTO_INCREMENT,
  ProjectId INT NOT NULL,
  UserId INT NOT NULL,
  Role ENUM('owner', 'member') NOT NULL DEFAULT 'member',
  AddedBy INT NOT NULL,
  AddedAt DATETIME NOT NULL DEFAULT NOW(),
  CreatedAt DATETIME NOT NULL DEFAULT NOW(),
  UpdatedAt DATETIME NOT NULL DEFAULT NOW(),
  UNIQUE KEY unique_project_user (ProjectId, UserId),
  INDEX idx_project_members_project_id (ProjectId),
  INDEX idx_project_members_user_id (UserId),
  FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
  FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
  FOREIGN KEY (AddedBy) REFERENCES Users(UserId)
);

-- New Table: ProjectAuditLogs
CREATE TABLE ProjectAuditLogs (
  Id INT PRIMARY KEY AUTO_INCREMENT,
  ProjectId INT NOT NULL,
  UserId INT NOT NULL,
  Action ENUM('create', 'update', 'delete', 'add_member', 'remove_member',
              'regenerate_webhook', 'toggle_ssh_key', 'regenerate_ssh_key') NOT NULL,
  EntityType ENUM('project', 'config', 'pipeline', 'webhook', 'ssh_key', 'member') NOT NULL,
  Changes TEXT NOT NULL,
  IpAddress VARCHAR(45),
  UserAgent TEXT,
  Timestamp DATETIME NOT NULL DEFAULT NOW(),
  CreatedAt DATETIME NOT NULL DEFAULT NOW(),
  UpdatedAt DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_project_audit_project_id (ProjectId),
  INDEX idx_project_audit_user_id (UserId),
  INDEX idx_project_audit_timestamp (Timestamp),
  INDEX idx_project_audit_action (Action),
  FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
  FOREIGN KEY (UserId) REFERENCES Users(UserId)
);
```

### 📝 Files Changed

#### **Created (5 files)**

- `server/src/Models/ProjectMember.ts`
- `server/src/Models/ProjectAuditLog.ts`
- `server/src/Migrations/002_create_project_members.ts`
- `server/src/Migrations/003_create_project_audit_logs.ts`
- `server/src/Services/AuditLogService.ts`

#### **Modified (8 files)**

- `server/src/Types/ICommon.ts` - Added Manager role
- `server/src/Models/index.ts` - Added new model exports and associations
- `server/src/Database/MigrationRunner.ts` - Added new migrations
- `server/src/Middleware/RoleMiddleware.ts` - Added Manager support
- `server/src/Middleware/ProjectAccessMiddleware.ts` - Complete rewrite for multi-owner
- `server/src/Routes/ProjectRoutes.ts` - Updated permissions and added member endpoints
- `server/src/Controllers/ProjectController.ts` - Added audit logging and member management
- `server/src/Services/ProjectService.ts` - Added audit logging and member management

### 🚀 Migration Instructions

To apply these changes to your database:

```bash
# Run migrations
npm run migrate

# Or manually through the application
# Migrations will run automatically on server start
```

**Migration Order:**

1. `001_add_created_by_to_projects` (existing)
2. `002_create_project_members` (new) - Creates table and migrates existing projects
3. `003_create_project_audit_logs` (new) - Creates audit log table

### ⚠️ Breaking Changes

1. **ProjectService.CreateProject()** now requires `Request` parameter
2. **ProjectService.UpdateProject()** now requires `Request` parameter
3. **ProjectService.DeleteProject()** now requires `Request` parameter
4. **ProjectService.RegenerateWebhookSecret()** now requires `Request` parameter
5. **ProjectService.ToggleSshKeyUsage()** now requires `Request` parameter

**Migration Guide:**

```typescript
// Before:
await projectService.CreateProject(data);

// After:
await projectService.CreateProject(data, req);
```

### 🐛 Bug Fixes

- Fixed TypeScript strict mode issues with optional request parameters
- Fixed IP address extraction from forwarded headers
- Improved validation for request parameter parsing

### 📚 Documentation

- Added comprehensive inline documentation for all new methods
- Updated model documentation with association details
- Added permission matrix documentation in middleware

---

## [2.0.0] - 2025-01-26

### Complete Platform Rebuild

Complete transformation from simple webhook handler to comprehensive deployment platform.

### Added

#### Core Infrastructure

- **TypeScript Setup** - Full TypeScript implementation with strict mode
- **PascalCase Convention** - Enforced PascalCase naming throughout codebase
- **SOLID Principles** - Architecture following SOLID design principles
- **OOP Classes** - Object-oriented design with proper encapsulation

#### Database Layer

- **MariaDB Integration** - Sequelize ORM with MariaDB support
- **Database Models**:
  - `User` - Authentication and user management
  - `Project` - Project configurations
  - `Deployment` - Deployment tracking
  - `DeploymentStep` - Pipeline step execution
  - `AuditLog` - Comprehensive audit trail
- **Model Associations** - Proper foreign key relationships
- **Soft Deletes** - Non-destructive data removal
- **Timestamps** - Automatic CreatedAt/UpdatedAt tracking

#### Authentication & Authorization

- **JWT Authentication** - Secure token-based auth
- **Role-Based Access Control** - Admin, Developer, Viewer roles
- **Password Security** - bcrypt hashing with 12 salt rounds
- **Token Refresh** - Refresh token mechanism
- **Password Validation** - Strong password requirements

#### Project Management

- **CRUD Operations** - Complete project lifecycle management
- **Webhook Integration** - GitHub webhook support
- **Auto-Deploy Configuration** - Automatic deployment on push
- **Path-Based Triggers** - Deploy only on specific file changes
- **Project Statistics** - Success rate, average duration metrics

#### Deployment System

- **Queue Management** - Prevents concurrent deployments per project
- **Priority Queue** - Manual deployments get higher priority
- **Pipeline Execution** - Custom deployment pipeline support
- **Variable Substitution** - Dynamic variable replacement in commands
- **Conditional Execution** - RunIf conditions for steps
- **Real-time Tracking** - Track each deployment step
- **Retry Mechanism** - Retry failed deployments
- **Cancel Support** - Cancel queued deployments

#### Pipeline Engine

- **Step-by-Step Execution** - Sequential pipeline processing
- **Timeout Support** - Per-step timeout configuration
- **Continue on Error** - Optional error handling
- **Working Directory** - Per-step directory control
- **Output Capture** - Store command outputs
- **Duration Tracking** - Measure execution time

#### Notifications

- **Discord Integration** - Rich embeds with deployment status
- **Slack Integration** - Formatted attachments
- **Email Notifications** - HTML email templates
- **Telegram Support** - Markdown-formatted messages
- **Status Colors** - Color-coded by deployment status
- **Deployment Details** - Commit info, duration, errors

#### Webhook Processing

- **Signature Verification** - HMAC-SHA256 verification
- **Payload Validation** - Structure validation
- **Event Filtering** - Process only relevant events
- **URL Normalization** - Smart URL comparison
- **File Pattern Matching** - Glob pattern support
- **Branch Filtering** - Deploy only configured branches

#### API Endpoints

- **Authentication Routes** - Register, Login, Profile, Password Change
- **Project Routes** - CRUD, Statistics, Webhook Management
- **Deployment Routes** - List, Create, Retry, Cancel, Statistics
- **Webhook Routes** - GitHub webhook handler, Test endpoint
- **Health Check** - Server health monitoring

#### Middleware

- **Authentication Middleware** - JWT token validation
- **Role Middleware** - Permission enforcement
- **Validation Middleware** - Joi schema validation
- **Rate Limiting** - Prevent API abuse
  - General API: 100 req/15min
  - Auth: 5 req/15min
  - Deployment: 10 req/5min
  - Webhook: 60 req/min
- **Error Handler** - Global error handling
- **Request Logger** - HTTP request logging

#### Security

- **Helmet.js** - Security headers
- **CORS Configuration** - Cross-origin resource sharing
- **Input Sanitization** - XSS protection
- **SQL Injection Prevention** - Sequelize ORM protection
- **Rate Limiting** - DoS protection
- **Encryption** - AES-256-GCM for sensitive data
- **HMAC Signatures** - Webhook verification

#### Logging

- **Winston Logger** - Structured logging
- **Daily Rotation** - Automatic log rotation
- **Log Levels** - Info, Warn, Error
- **Separate Log Files**:
  - Combined logs
  - Error-only logs
  - Deployment-specific logs
- **Contextual Logging** - Rich metadata

#### Utilities

- **Password Helper** - Hashing, verification, validation
- **Encryption Helper** - Encryption, decryption, HMAC
- **Response Helper** - Standardized API responses
- **Logger** - Singleton logging instance

#### Configuration

- **Environment Variables** - Comprehensive .env support
- **Validation** - Config validation on startup
- **Defaults** - Sensible default values
- **Singleton Pattern** - Centralized configuration

#### Documentation

- **README.md** - Comprehensive project documentation
- **QUICK_START.md** - Quick start guide
- **PROJECT_STRUCTURE.md** - Detailed architecture docs
- **CHANGELOG.md** - Version history
- **Code Comments** - Inline documentation

#### Development Tools

- **ESLint** - Code linting with PascalCase enforcement
- **Prettier** - Code formatting
- **Nodemon** - Development hot reload
- **TypeScript Paths** - Module path aliases
- **Jest Setup** - Testing framework configuration

#### Scripts

- `npm run dev` - Development server with hot reload
- `npm run build` - Production build
- `npm start` - Start production server
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm test` - Run tests

### Changed

- **From:** Simple Express server with basic webhook handling
- **To:** Enterprise-grade deployment platform

### Technical Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.3+
- **Framework:** Express.js 4.18+
- **Database:** MariaDB 10.6+ with Sequelize ORM
- **Authentication:** JWT (jsonwebtoken)
- **Security:** Helmet, bcrypt, AES-256-GCM
- **Logging:** Winston with daily rotation
- **Validation:** Joi
- **Rate Limiting:** express-rate-limit
- **Testing:** Jest
- **Code Quality:** ESLint + Prettier

### Architecture Highlights

- **Layered Architecture** - Routes → Controllers → Services → Models → Database
- **Dependency Injection Ready** - Loose coupling for testability
- **Singleton Patterns** - Config, Logger, Database, Queue
- **Factory Patterns** - Response formatting, Middleware creation
- **Repository Pattern** - Data access abstraction
- **Service Layer Pattern** - Business logic separation
- **Event-Driven** - Queue service with EventEmitter

### Code Statistics

- **Total Files Created:** 40+
- **Lines of Code:** 5000+
- **Models:** 5
- **Services:** 7
- **Controllers:** 4
- **Middleware:** 6
- **Routes:** 4 groups
- **Utilities:** 4

### Naming Convention

- **Strictly PascalCase** for:
  - All Classes
  - All Interfaces (with 'I' prefix)
  - All Class Properties
  - All Class Methods
  - All Enums
  - All Types

### Breaking Changes

- Complete API redesign
- New database schema
- New authentication system
- PascalCase property names in responses

### Migration from v1.x

Not applicable - this is a complete rebuild. If migrating from old system:

1. Export existing project configurations
2. Set up new database
3. Recreate projects via API
4. Update GitHub webhooks
5. Reconfigure notifications

### Known Limitations

- No built-in CI/CD pipeline templates (coming soon)
- No web dashboard (server-side only)
- No database migrations system yet
- No Socket.IO real-time updates yet (infrastructure ready)

### Future Enhancements

- [ ] Web dashboard (React/Vue frontend)
- [ ] Database migrations with Sequelize CLI
- [ ] Real-time deployment updates via Socket.IO
- [ ] Deployment rollback functionality
- [ ] Multi-server deployment support
- [ ] Container deployment support (Docker/K8s)
- [ ] Deployment scheduling
- [ ] Environment variables management
- [ ] Secret management
- [ ] Deployment approvals workflow
- [ ] Advanced analytics dashboard
- [ ] Integration with more Git providers (GitLab, Bitbucket)

### Credits

- Developed following SOLID principles
- PascalCase naming enforced throughout
- Clean, maintainable, production-ready code

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
