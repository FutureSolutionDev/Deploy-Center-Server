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

## [2.0.0] - Previous Release

### Initial RBAC Implementation
- Basic role system (Admin, Developer, Viewer)
- Project ownership based on CreatedBy field
- SSH key management
- Webhook integration

---

## Contributing

When adding entries to this changelog:
1. Use the format: `[Version] - YYYY-MM-DD`
2. Group changes by type: Added, Changed, Deprecated, Removed, Fixed, Security
3. Include migration instructions for database changes
4. Document breaking changes clearly
5. Add examples for API changes

---

**Legend:**
- ✅ Supported / Allowed
- ❌ Not Supported / Denied
- ⚠️ Warning / Important Note
