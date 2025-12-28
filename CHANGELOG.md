# Changelog

All notable changes to the Deploy Center project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## Previous Versions

### [1.0.0] - Original Version

- Basic GitHub webhook receiver
- Simple deployment execution
- Discord notification support
- No database
- No authentication
- Single project support

---

**Legend:**

- ✅ Supported / Allowed
- ❌ Not Supported / Denied
- ⚠️ Warning / Important Note
