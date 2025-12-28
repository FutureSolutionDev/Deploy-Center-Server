# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last Updated**: December 28, 2024

---

## 📋 Project Overview

**Deploy Center** is a modern, enterprise-grade, self-hosted CI/CD deployment platform built with TypeScript, React, and Node.js. It provides automated deployment workflows, role-based access control, real-time monitoring, and comprehensive security features.

###  Current Version: **v2.1.0**

### **Core Architecture:**

```
deploy-center/
├── server/              # Backend (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── Controllers/ # HTTP request handlers
│   │   ├── Services/    # Business logic layer
│   │   ├── Models/      # Sequelize database models
│   │   ├── Middlewares/ # Express middlewares (Auth, RBAC, etc.)
│   │   ├── Routes/      # API route definitions
│   │   ├── Utils/       # Helper utilities
│   │   ├── Migrations/  # Database schema migrations
│   │   └── Types/       # TypeScript type definitions
│   ├── public/          # Built frontend static files
│   ├── logs/            # Application and deployment logs
│   └── docs/            # Documentation files
│
└── client/              # Frontend (React + TypeScript)
    ├── src/
    │   ├── components/  # Reusable UI components
    │   ├── contexts/    # React contexts (Auth, Role, Theme)
    │   ├── hooks/       # Custom React hooks
    │   ├── pages/       # Page components
    │   ├── services/    # API service layer
    │   ├── types/       # TypeScript interfaces
    │   └── utils/       # Utility functions
    └── public/          # Static assets
```

### **Current Status: ✅ Production Ready**

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication & Security** | ✅ Complete | JWT + RBAC + SSH encryption |
| **User Management** | ✅ Complete | Full CRUD + role assignment |
| **Project Management** | ✅ Complete | Multi-project support |
| **Deployment Pipelines** | ✅ Complete | Customizable workflows |
| **Queue Management** | ✅ Complete | Per-project queues |
| **Real-Time Updates** | ✅ Complete | WebSocket + Socket.IO |
| **RBAC System** | ✅ Complete | 4 roles + project-level permissions |
| **Project Members** | ✅ Complete | Team collaboration |
| **SSH Key Management** | ✅ Complete | ED25519/RSA + encryption |
| **Audit Logging** | ✅ Complete | Complete activity tracking |
| **Discord Notifications** | ✅ Complete | Webhook integration |
| **GitHub Integration** | ✅ Complete | Webhook verification |
| **Settings Management** | ✅ Complete | User preferences + API keys |
| **Database Migrations** | ✅ Complete | Automated schema updates |

---

## 🚀 Key Features

### 1. **Authentication & Authorization** (✅ Complete)

**Multi-Layer Security:**
- JWT-based authentication (access + refresh tokens)
- bcrypt password hashing (10 rounds)
- Secure session management
- API key authentication for external tools

**RBAC System:**
- 4 user roles: Admin, Manager, Developer, Viewer
- Granular permission system
- Project-level access control
- Feature-based authorization

**Completed on**: December 28, 2024

### 2. **Project Management** (✅ Complete)

**Features:**
- Create, edit, delete, archive projects
- Custom deployment pipelines (JSON-based)
- Environment variables and secrets
- GitHub webhook integration
- SSH key management per project
- Project member management

**Project Types Supported:**
- Node.js backend applications
- Static websites (React, Vue, Angular)
- Custom deployment workflows

**Completed on**: November 26, 2024

### 3. **Deployment System** (✅ Complete)

**Intelligent Pipeline:**
- Multi-step deployment workflows
- Conditional step execution
- Variable substitution system
- Pre/post deployment hooks
- Automatic error recovery

**Deployment Features:**
- Manual or webhook-triggered deployments
- Real-time deployment logs
- Queue management (prevents conflicts)
- Deployment history tracking
- Success/failure notifications

**Completed on**: December 20, 2024

### 4. **Real-Time Monitoring** (✅ Complete)

**Live Updates via WebSocket:**
- Deployment status changes
- Queue updates
- Log streaming
- Notification delivery

**Dashboard:**
- System overview
- Recent deployments
- Success/failure statistics
- Active queues

**Completed on**: December 15, 2024

### 5. **Security Features** (✅ Complete)

**Data Protection:**
- AES-256-GCM encryption for SSH keys
- Encrypted environment variables
- Secure password storage
- Session management

**Access Control:**
- Role-based permissions
- Project-level access
- API key management
- Audit trail logging

**GitHub Security:**
- CodeQL analysis workflow
- Dependency scanning
- Automated security updates

**Completed on**: December 28, 2024

---

## 🔐 RBAC System (Role-Based Access Control)

### Role Hierarchy

```
Admin (Full Control)
  │
  ├─ Manager (User + Project Management)
  │   │
  │   ├─ Developer (Assigned Projects Only)
  │   │   │
  │   │   └─ Viewer (Read-Only Access)
```

### Permission Matrix

| Permission | Admin | Manager | Developer | Viewer |
|-----------|-------|---------|-----------|--------|
| **Projects** |
| View All Projects | ✅ | ✅ | ❌ | ❌ |
| View Assigned Projects | ✅ | ✅ | ✅ | ✅ |
| Create Project | ✅ | ✅ | ❌ | ❌ |
| Edit Project | ✅ | ✅ | ✅* | ❌ |
| Delete Project | ✅ | ✅ | ❌ | ❌ |
| **Deployments** |
| Trigger Deployment | ✅ | ✅ | ✅* | ❌ |
| View Deployments | ✅ | ✅ | ✅* | ✅* |
| Cancel Deployment | ✅ | ✅ | ✅* | ❌ |
| Retry Deployment | ✅ | ✅ | ✅* | ❌ |
| **Queue** |
| View Queue | ✅ | ✅ | ✅* | ✅* |
| Cancel Queue Items | ✅ | ✅ | ✅* | ❌ |
| **Users** |
| Manage Users | ✅ | ✅ | ❌ | ❌ |
| Assign Roles | ✅ | ✅ | ❌ | ❌ |
| **Project Members** |
| Add/Remove Members | ✅ | ✅ | ❌ | ❌ |
| **Settings** |
| Profile Settings | ✅ | ✅ | ✅ | ✅ |
| API Keys | ✅ | ✅ | ❌ | ❌ |
| Account Settings | ✅ | ✅ | ✅ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ |
| **Sensitive Data** |
| View Webhooks | ✅ | ✅ | ❌ | ❌ |
| View SSH Keys | ✅ | ✅ | ❌ | ❌ |

*Only for assigned projects

### Implementation Details

**Backend:**
- Middleware: `CheckPermission` in `server/src/Middlewares/RoleMiddleware.ts`
- Service layer filtering in `ProjectService.GetAllProjects()`
- Controller-level authorization checks

**Frontend:**
- Context: `RoleContext` provides `useRole()` hook
- Permissions: `canManageProjects`, `canManageUsers`, `canDeploy`, `isViewer`
- Conditional rendering based on role

**Database:**
- Table: `Users.Role` (Admin, Manager, Developer, Viewer)
- Table: `ProjectMembers` (project-level membership)

---

## 📚 Tech Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime environment |
| TypeScript | 5.7.2 | Type safety |
| Express.js | 4.21.2 | Web framework |
| Sequelize | 6.37.5 | ORM for MySQL |
| Socket.IO | 4.8.1 | Real-time communication |
| JWT | 9.0.2 | Authentication tokens |
| bcryptjs | 2.4.3 | Password hashing |
| Winston | 3.18.0 | Logging |
| mysql2 | 3.12.0 | MySQL driver |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.0.0 | UI framework |
| TypeScript | 5.6.2 | Type safety |
| Material-UI | 7.5.2 | Component library |
| React Query | 6.4.3 | Data fetching |
| React Router | 7.6.3 | Routing |
| Axios | 1.7.9 | HTTP client |
| Recharts | 2.15.1 | Charts |
| Vite | 7.2.4 | Build tool |

### Database

| Technology | Version | Purpose |
|-----------|---------|---------|
| MySQL | 8.0+ | Primary database |
| MariaDB | 11.2+ | Alternative database |

---

## 🗄️ Database Schema

### Core Tables

1. **Users** - User accounts and authentication
   - Columns: `UserId`, `Username`, `Email`, `Password`, `Role`, `IsActive`, `CreatedAt`
   - Indexes: `email` (unique), `role`

2. **UserSessions** - Active user sessions
   - Columns: `SessionId`, `UserId`, `RefreshToken`, `ExpiresAt`, `CreatedAt`
   - Indexes: `refresh_token` (unique), `user_id`

3. **Projects** - Deployment projects
   - Columns: `Id`, `Name`, `RepoUrl`, `Branch`, `ProjectPath`, `ProjectType`, `WebhookSecret`, `IsActive`, `Config`, `CreatedBy`, `SshKey*`, `CreatedAt`
   - Indexes: `name` (unique), `is_active`, `created_by`

4. **ProjectMembers** - Project team members (NEW ✨)
   - Columns: `Id`, `ProjectId`, `UserId`, `Role`, `AddedBy`, `AddedAt`
   - Indexes: `project_user` (unique), `project_id`, `user_id`
   - **Purpose**: Project-level access control for Developer/Viewer roles

5. **Deployments** - Deployment records
   - Columns: `Id`, `ProjectId`, `Status`, `Branch`, `CommitHash`, `CommitMessage`, `Author`, `TriggerType`, `TriggeredBy`, `StartedAt`, `FinishedAt`, `Duration`
   - Indexes: `project_id`, `status`, `created_at`

6. **DeploymentSteps** - Individual deployment steps
   - Columns: `Id`, `DeploymentId`, `StepNumber`, `StepName`, `Status`, `Output`, `Error`, `StartedAt`, `FinishedAt`, `Duration`
   - Indexes: `deployment_id`

7. **AuditLogs** - System audit trail
   - Columns: `Id`, `UserId`, `Action`, `ResourceType`, `ResourceId`, `IpAddress`, `UserAgent`, `Details`, `CreatedAt`
   - Indexes: `user_id`, `action`, `created_at`

8. **ProjectAuditLogs** - Project-specific audit logs (NEW ✨)
   - Columns: `Id`, `ProjectId`, `UserId`, `Action`, `EntityType`, `EntityId`, `Changes`, `IpAddress`, `CreatedAt`
   - Indexes: `project_id`, `user_id`, `created_at`

9. **ApiKeys** - API authentication keys
   - Columns: `Id`, `UserId`, `Name`, `KeyHash`, `LastFourChars`, `ExpiresAt`, `LastUsedAt`, `IsActive`, `CreatedAt`
   - Indexes: `key_hash` (unique), `user_id`

10. **UserSettings** - User preferences
    - Columns: `Id`, `UserId`, `Language`, `Theme`, `Timezone`, `NotificationsEnabled`, `EmailNotifications`
    - Indexes: `user_id` (unique)

11. **TwoFactorAuth** - 2FA settings (planned)
    - Columns: `Id`, `UserId`, `Secret`, `IsEnabled`, `BackupCodes`, `CreatedAt`

### Database Migrations

**Location**: `server/src/Migrations/`

**Completed Migrations:**
1. `001_add_created_by_to_projects.ts` - Added project creator tracking
2. `002_create_project_members.ts` - Created project membership system
3. `003_create_project_audit_logs.ts` - Added project audit logging

**How to Run:**
```bash
cd server
npm run migrate
```

---

## 🔑 SSH Key Management

### Overview

Deploy Center provides secure SSH key management for private Git repositories.

### Features

1. **Automatic Key Generation**
   - ED25519 (recommended, smaller, faster)
   - RSA 4096-bit (legacy support)

2. **Encryption**
   - AES-256-GCM encryption for private keys
   - Keys never stored in plaintext
   - Separate IV and AuthTag for each key

3. **Key Lifecycle**
   - Generate new keys
   - Rotate/regenerate keys
   - Delete keys
   - Enable/disable SSH authentication per project

4. **GitHub Integration**
   - Public key deployment to GitHub (manual)
   - Deploy keys support
   - Automatic SSH agent configuration

### API Endpoints

```typescript
// Generate SSH key
POST /api/projects/:id/ssh-key
Body: { keyType?: 'ed25519' | 'rsa' }

// Regenerate SSH key
PUT /api/projects/:id/ssh-key
Body: { keyType?: 'ed25519' | 'rsa' }

// Get public key info
GET /api/projects/:id/ssh-key

// Delete SSH key
DELETE /api/projects/:id/ssh-key

// Toggle SSH usage
PATCH /api/projects/:id/ssh-key/toggle
Body: { enabled: boolean }
```

### Security Notes

- Private keys are NEVER exposed via API
- Only public keys are returned to frontend
- Decryption only happens during deployment
- Keys are deleted from memory immediately after use

---

## 🛣️ API Routes

### Authentication Routes (`/api/auth`)

```typescript
POST   /api/auth/register         # Register new user (Admin only)
POST   /api/auth/login            # Login
POST   /api/auth/logout           # Logout
POST   /api/auth/refresh          # Refresh access token
GET    /api/auth/profile          # Get current user profile
PUT    /api/auth/profile          # Update profile
PUT    /api/auth/change-password  # Change password
```

### Project Routes (`/api/projects`)

```typescript
GET    /api/projects                      # Get all projects
GET    /api/projects/:id                  # Get project by ID
POST   /api/projects                      # Create project
PUT    /api/projects/:id                  # Update project
DELETE /api/projects/:id                  # Delete project (soft delete)
POST   /api/projects/:id/regenerate-webhook  # Regenerate webhook secret
GET    /api/projects/:id/statistics       # Get project stats
GET    /api/projects/:id/deployments      # Get project deployments

# SSH Key Management
POST   /api/projects/:id/ssh-key          # Generate SSH key
PUT    /api/projects/:id/ssh-key          # Regenerate SSH key
GET    /api/projects/:id/ssh-key          # Get public key info
DELETE /api/projects/:id/ssh-key          # Delete SSH key
PATCH  /api/projects/:id/ssh-key/toggle   # Toggle SSH usage

# Project Members (NEW ✨)
GET    /api/projects/:id/members          # Get project members
POST   /api/projects/:id/members          # Add member to project
DELETE /api/projects/:id/members/:userId  # Remove member from project
```

### Deployment Routes (`/api/deployments`)

```typescript
GET    /api/deployments                   # Get all deployments
GET    /api/deployments/:id               # Get deployment by ID
POST   /api/deployments/projects/:id/deploy  # Trigger deployment
DELETE /api/deployments/:id               # Cancel deployment
POST   /api/deployments/:id/retry         # Retry failed deployment
GET    /api/deployments/statistics        # Get global stats
GET    /api/deployments/queue/status      # Get queue status
```

### User Routes (`/api/users`)

```typescript
GET    /api/users                         # Get all users
GET    /api/users/:id                     # Get user by ID
POST   /api/users                         # Create user
PUT    /api/users/:id                     # Update user
DELETE /api/users/:id                     # Delete user
PATCH  /api/users/:id/role                # Update user role
GET    /api/users/me/settings             # Get user settings
PUT    /api/users/me/settings             # Update user settings
```

### API Key Routes (`/api/api-keys`)

```typescript
GET    /api/api-keys                      # Get user's API keys
POST   /api/api-keys                      # Create API key
DELETE /api/api-keys/:id                  # Delete API key
PATCH  /api/api-keys/:id/toggle           # Enable/disable API key
```

### Webhook Routes

```typescript
POST   /webhook/github                    # GitHub webhook receiver
```

---

## 🔔 Notifications

### Discord Integration

**Features:**
- Deployment status notifications
- Error alerts
- Success confirmations
- Custom colored embeds

**Configuration:**
```typescript
// In .env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

// In NotificationService
await NotificationService.SendDeploymentNotification({
  projectName: 'My App',
  status: 'success',
  branch: 'main',
  commit: 'abc123',
  duration: 120,
});
```

**Colors:**
- 🔴 Red: Errors, failures
- 🟠 Orange: Warnings
- 🔵 Blue: Info, in progress
- 🟢 Green: Success

### Planned Integrations

- Slack (Q1 2025)
- Email (Q1 2025)
- Telegram (Q2 2025)
- Custom webhooks (Q2 2025)

---

## 🧪 Testing

### Current Status

- ❌ Unit tests (planned Q1 2025)
- ❌ Integration tests (planned Q1 2025)
- ❌ E2E tests (planned Q2 2025)
- ✅ Manual testing (complete)

### Planned Testing Stack

- Jest for unit tests
- Supertest for API testing
- React Testing Library for frontend
- Playwright for E2E tests

---

## 🚧 Known Limitations

### Current Limitations

1. **Single Server Only**
   - No multi-server deployment support
   - Planned for Q2 2025

2. **No Rollback UI**
   - Rollback logic exists but no UI
   - Planned for Q1 2025

3. **Limited Notification Channels**
   - Only Discord currently
   - Slack & Email in Q1 2025

4. **No Scheduled Deployments**
   - Only manual/webhook triggers
   - Cron-based scheduling planned Q2 2025

5. **No CLI Tool**
   - Web UI and API only
   - CLI planned Q2 2025

6. **No Mobile App**
   - Desktop web only
   - React Native app planned Q3 2025

---

## 📈 Recent Updates (December 2024)

### December 28, 2024 - RBAC Enhancement

**Added:**
- ✅ Complete project-level access control
- ✅ Project members management UI
- ✅ Deployment filtering by project membership
- ✅ Queue filtering by project membership
- ✅ Frontend RBAC for all pages (Projects, Deployments, Queue, Settings)
- ✅ ProjectMembersCard component for member management

**Modified:**
- `ProjectService.GetAllProjects()` - Added user filtering
- `DeploymentService.GetAllDeployments()` - Added user filtering
- `DeploymentController.GetQueueStatus()` - Added user filtering
- All frontend pages - Added role-based UI controls

**Files Changed:**
- `server/src/Services/ProjectService.ts`
- `server/src/Services/DeploymentService.ts`
- `server/src/Controllers/ProjectController.ts`
- `server/src/Controllers/DeploymentController.ts`
- `client/src/pages/Projects/ProjectDetailsPage.tsx`
- `client/src/pages/Projects/components/ProjectMembersCard.tsx`
- `client/src/pages/Deployments/DeploymentsPage.tsx`
- `client/src/pages/Queue/QueuePage.tsx`
- `client/src/pages/Settings/SettingsPage.tsx`

### December 20, 2024 - Pipeline Enhancements

**Added:**
- Improved error handling in pipelines
- Better log formatting
- Deployment duration tracking

### December 15, 2024 - Real-Time Updates

**Added:**
- Socket.IO integration
- Live deployment status updates
- Queue status WebSocket events

---

## 🔮 Roadmap & Future Plans

See [VISION.md](./docs/VISION.md) and [FEATURES_TODO.md](./docs/FEATURES_TODO.md) for complete roadmap.

### Q1 2025

- Docker containerization
- Kubernetes deployment support
- Slack & Email notifications
- Rollback UI implementation
- Unit & Integration testing
- Performance optimization

### Q2 2025

- Multi-server deployment
- CLI tool
- Advanced analytics
- Scheduled deployments
- Health checks & monitoring
- API rate limiting

### Q3 2025

- Mobile app (React Native)
- Deployment templates marketplace
- Plugin system
- Advanced RBAC (custom roles)
- Audit report generation

---

## 🆘 Troubleshooting

### Common Issues

1. **Server Won't Start**
   - Check database connection in `.env`
   - Verify port 9090 is not in use
   - Check logs: `pm2 logs deploy-center`

2. **Authentication Fails**
   - Verify JWT secrets in `.env`
   - Check token expiration settings
   - Clear browser cache and cookies

3. **Deployments Not Triggering**
   - Verify GitHub webhook secret matches
   - Check webhook delivery in GitHub settings
   - Review server logs for errors

4. **Database Errors**
   - Run migrations: `npm run migrate`
   - Check database user permissions
   - Verify database exists

5. **Frontend Not Loading**
   - Build frontend: `cd client && npm run build`
   - Check server serves `public` folder
   - Verify API URL in frontend config

### Debug Commands

```bash
# View server logs
pm2 logs deploy-center

# View database migrations status
cd server && npm run migrate:status

# Check running processes
pm2 list

# Restart server
pm2 restart deploy-center

# View deployment logs
tail -f server/logs/deployments/*.log
```

---

## 📞 Support & Resources

### Documentation

- [README.md](./README.md) - Main documentation
- [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) - API reference
- [FEATURES_TODO.md](./docs/FEATURES_TODO.md) - Feature tracking
- [VISION.md](./docs/VISION.md) - Future roadmap

### Code Quality

- [CODING_STANDARDS.md](../CODING_STANDARDS.md) - Code style guide
- [REFACTOR_PLAN.md](../REFACTOR_PLAN.md) - Architecture improvements

### Contact

- **GitHub Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share ideas
- **Discord**: Join our community server (coming soon)

---

## 📝 Notes for Claude Code

### When Working on This Project

1. **Always** follow the TypeScript strict mode guidelines
2. **Always** use PascalCase for classes, interfaces, types
3. **Always** use camelCase for functions, variables
4. **Always** add JSDoc comments for public methods
5. **Never** commit `.env` files or sensitive data
6. **Never** modify migration files after they've been run
7. **Always** update this file when adding major features

### Code Patterns to Follow

**Service Pattern:**
```typescript
export class ExampleService {
  public async GetData(): Promise<Data[]> {
    try {
      // Implementation
    } catch (error) {
      Logger.Error('Failed to get data', error as Error);
      throw error;
    }
  }
}
```

**Controller Pattern:**
```typescript
public GetData = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await this.ExampleService.GetData();
    ResponseHelper.Success(res, 'Data retrieved', { Data: data });
  } catch (error) {
    ResponseHelper.Error(res, 'Failed to retrieve data');
  }
};
```

**React Component Pattern:**
```typescript
export const ExampleComponent: React.FC = () => {
  const { data, isLoading } = useQuery('key', fetchData);

  if (isLoading) return <CircularProgress />;

  return <div>{data}</div>;
};
```

---

**End of CLAUDE.md**
