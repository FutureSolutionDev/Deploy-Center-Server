# Project Structure Documentation

This document explains the architecture and organization of the Deploy
Center server.

**Current version:** v3.0.0 (released 2026-05-24). v3.0 added BullMQ-backed
persistent queue, encrypted env vars, multi-channel notifications,
rollback service, project templates, and workspaces — see the v3.0 entries
in each layer below.

## Architecture Overview

The project follows a layered architecture pattern:

```ascii
┌─────────────────────────────────────────┐
│           HTTP Request                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Routes Layer                    │
│  (URL mapping & middleware chaining)    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Controllers Layer                  │
│  (Request/Response handling)            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       Services Layer                    │
│  (Business logic & orchestration)       │
└────────┬────────┬───────────────────────┘
         │        │
         │        └──────► BullMQ Queue (v3.0)
         │                 │
         │                 ▼
         │           ┌─────────────┐
         │           │   Redis 7+  │
         │           │ (persistent │
         │           │  jobs +     │
         │           │  pub/sub)   │
         │           └─────────────┘
         ▼
┌─────────────────────────┐
│      Models Layer       │
│  (Data access & ORM)    │
└─────────────┬───────────┘
              │
┌─────────────▼───────────┐
│       Database          │
│  (MariaDB 11.2+ / MySQL 8.0+) │
└─────────────────────────┘
```

## Directory Structure

```tree
server/
├── src/
│   ├── Config/              # Application configuration
│   │   ├── AppConfig.ts
│   │   └── RedisConfig.ts          # NEW v3.0 — F-001
│   ├── Controllers/         # HTTP request handlers
│   ├── Database/            # Database connection & setup
│   ├── Middleware/          # Express middlewares
│   │   ├── AuthMiddleware.ts
│   │   ├── RoleMiddleware.ts
│   │   ├── ProjectAccessMiddleware.ts
│   │   ├── DeploymentAccessMiddleware.ts
│   │   ├── RateLimiterMiddleware.ts
│   │   ├── CsrfMiddleware.ts
│   │   ├── SecurityMiddleware.ts
│   │   └── QueueReadyMiddleware.ts   # NEW v3.0 — 503 short-circuit when Redis is down
│   ├── Migrations/          # Database schema migrations (001 → 021 + 999)
│   ├── Models/              # Database models (Sequelize)
│   ├── Routes/              # API route definitions
│   ├── Services/            # Business logic layer
│   │   ├── Notifications/          # NEW v3.0 — F-006 Strategy pattern
│   │   │   ├── INotificationDispatcher.ts
│   │   │   ├── DiscordDispatcher.ts
│   │   │   ├── SlackDispatcher.ts
│   │   │   └── EmailDispatcher.ts
│   │   ├── QueueService.ts            # REWRITTEN v3.0 — BullMQ wrapper (F-001)
│   │   ├── QueueAdminService.ts       # NEW v3.0 — Bull Board mount (F-001)
│   │   ├── RollbackService.ts         # NEW v3.0 — F-007
│   │   ├── EnvironmentVariableService.ts  # NEW v3.0 — F-003
│   │   ├── NotificationProviderService.ts # NEW v3.0 — F-006
│   │   ├── NotificationChannelService.ts  # NEW v3.0 — F-006
│   │   ├── ProjectNotificationSubscriptionService.ts # NEW v3.0 — F-006
│   │   ├── ProjectTemplateService.ts      # NEW v3.0 — F-008
│   │   ├── WorkspaceService.ts            # NEW v3.0 — F-009
│   │   └── …
│   ├── Types/               # TypeScript type definitions
│   ├── Utils/               # Utility functions & helpers
│   ├── App.ts               # Express application setup + Bull Board mount
│   ├── Server.ts            # Server initialization
│   └── index.ts             # Application entry point
├── __tests__/               # NEW v3.0 — F-002 Jest test suite (mirrors src/)
├── docs/                    # All project documentation
├── logs/                    # Application logs (auto-generated)
├── deployments/             # Deployment workspaces (auto-generated)
│   └── cache/               # NEW v3.0 — F-005 git bare cache per project
├── .env                     # Environment variables (create from .env.example)
├── .env.example             # Environment template
├── .env.test                # Test fixture (committed, hardcoded test values)
├── .eslintrc.json           # ESLint configuration
├── .prettierrc.json         # Prettier configuration
├── jest.config.js           # Jest testing configuration
├── tsconfig.json            # TypeScript compiler options
├── tsconfig.test.json       # Test-specific TypeScript config
├── package.json             # Dependencies and scripts
├── CLAUDE.md                # AI-agent instructions
├── README.md                # GitHub entry point
└── LICENSE.md               # Project license
```

## Layer Responsibilities

### 1. Config Layer (`src/Config/`)

**Purpose:** Centralized configuration management

**Files:**

- `AppConfig.ts` - Singleton configuration class

**Responsibilities:**

- Load environment variables
- Provide default values
- Validate configuration
- Expose configuration to other layers

**Example:**

```typescript
const config = AppConfig.GetInstance();
console.log(config.Port); // 9090
```

In v3.0, `RedisConfig.ts` lives alongside `AppConfig.ts` and exposes a
typed `ioredis`-compatible config (host, port, password, db, retry
strategy) consumed by `QueueService` and `QueueReadyMiddleware`.

### 2. Models Layer (`src/Models/`)

**Purpose:** Database schema and ORM models

**Pre-v3.0:**

- `User.ts` — User authentication model
- `UserSettings.ts` — User preferences
- `UserSession.ts` — Active sessions / refresh tokens
- `ApiKey.ts` — API key authentication
- `Project.ts` — Project configuration model
- `ProjectMember.ts` — Project membership (RBAC)
- `ProjectAuditLog.ts` — Per-project audit trail
- `Deployment.ts` — Deployment tracking model
- `DeploymentStep.ts` — Pipeline step execution model
- `AuditLog.ts` — Global audit trail model

**Added in v3.0:**

- `EnvironmentVariable.ts` — Encrypted env vars (F-003)
- `NotificationProvider.ts` — Encrypted notification provider credentials (F-006)
- `NotificationChannel.ts` — Notification delivery channels (F-006)
- `ProjectNotificationSubscription.ts` — Per-project event subscriptions (F-006)
- `ProjectTemplate.ts` — Project templates with seeded built-ins (F-008)
- `Workspace.ts` — Optional project grouping (F-009)
- `index.ts` — Model associations and exports (updated)

`Deployment.ts` also gained a nullable `QueueJobId VARCHAR(100)` column
in v3.0 to correlate rows with BullMQ jobs (F-001).

**Responsibilities:**

- Define database schema
- Manage relationships between entities
- Provide data validation
- Expose Sequelize ORM interface

**Key Features:**

- All fields use PascalCase
- Timestamps (CreatedAt, UpdatedAt)
- Soft deletes support
- Foreign key relationships

### 3. Types Layer (`src/Types/`)

**Purpose:** TypeScript type definitions and interfaces

**Files:**

- `ICommon.ts` - Common types, enums, interfaces
- `IDatabase.ts` - Database-specific types

**Responsibilities:**

- Define interfaces for data structures
- Enum definitions
- Type safety across application
- API response types

**Example:**

```typescript
export enum EUserRole {
  Admin = 'admin',
  Developer = 'developer',
  Viewer = 'viewer',
}

export interface IApiResponse<T = any> {
  Success: boolean;
  Message: string;
  Data?: T;
  Error?: string;
  Code: number;
}
```

### 4. Utils Layer (`src/Utils/`)

**Purpose:** Reusable utility functions and helpers

**Files:**

- `Logger.ts` - Winston logging singleton
- `PasswordHelper.ts` - Password hashing (bcrypt)
- `EncryptionHelper.ts` - AES-256-GCM encryption
- `ResponseHelper.ts` - Standardized API responses

**Responsibilities:**

- Logging functionality
- Cryptographic operations
- Data transformation
- Common helper functions

### 5. Database Layer (`src/Database/`)

**Purpose:** Database connection management + migration runner

**Files:**

- `DatabaseConnection.ts` — Sequelize connection singleton
- `DatabaseInitializer.ts` — bootstrap sequence (associations + migrations)
- `MigrationRunner.ts` — schema migration orchestrator

**Migrations (`src/Migrations/`)** apply in this numeric order on first
startup (idempotent via the `Migrations` table):

| # | Purpose | Shipped in |
| --- | --- | --- |
| 001 | Add `CreatedBy` to projects | v2.1 |
| 002 | Create `ProjectMembers` | v2.1 |
| 003 | Create `ProjectAuditLogs` | v2.1 |
| 004 | Convert `ProjectPath` → `DeploymentPaths` JSON | v2.1.1 |
| 005 | Fix `DeploymentPaths` constraint (raw SQL workaround) | v2.1.2 |
| 006 | Widen `DeploymentSteps.{Output,Error}` to LONGTEXT | v2.1.2 |
| 008 | Widen `ProjectAuditLogs.Changes` to LONGTEXT | v2.1.2 |
| 009 | Create `EnvironmentVariables` | **v3.0 F-003** |
| 012 | Add `Deployment.QueueJobId` (BullMQ correlation) | **v3.0 F-001** |
| 013 | Create `NotificationProviders` | **v3.0 F-006** |
| 016 | Create `Workspaces` + `Project.WorkspaceId` | **v3.0 F-009** |
| 017 | Create `ProjectTemplates` + seed 5 built-ins | **v3.0 F-008** |
| 018 | Create `NotificationChannels` | **v3.0 F-006** |
| 019 | Create `ProjectNotificationSubscriptions` | **v3.0 F-006** |
| 020 | Drop legacy `UserSettings.Notify*` columns | **v3.0** |
| 021 | Widen `Deployments.{ErrorMessage,CommitMessage}` to LONGTEXT | **v3.0** (fixes a pre-existing v2.1.2 bug) |
| 999 | Re-enqueue v2.1 pending/queued deployments into BullMQ | **v3.0 F-001** |

Numbers 010, 011, 014, 015 are **reserved for v3.1** — do not use.

**Responsibilities:**

- Initialize database connection (MariaDB 11.2+ / MySQL 8.0+)
- Connection pooling
- Test connectivity
- Bootstrap baseline schema then apply migrations in order

**Features:**

- Singleton pattern
- Connection testing
- Graceful shutdown
- Auto-reconnect
- Idempotent migrations with `up()` AND `down()`

### 6. Services Layer (`src/Services/`)

**Purpose:** Business logic and orchestration

**Pre-v3.0:**

- `AuthService.ts` — Authentication & JWT
- `ProjectService.ts` — Project CRUD operations
- `DeploymentService.ts` — Deployment orchestration
- `PipelineService.ts` — Pipeline execution engine
- `NotificationService.ts` — Notification fan-out
- `WebhookService.ts` — Webhook verification & processing
- `AuditLogService.ts` — Audit log writes
- `AutoRecovery.ts` — Crash-recovery helpers
- `UsersService.ts`, `UserSettingsService.ts`, `ApiKeyService.ts`
- `SocketService.ts` — Socket.IO event dispatch

**Rewritten in v3.0:**

- `QueueService.ts` — was in-memory `Map<projectId, Item[]>`; now a thin
  wrapper around BullMQ (`Queue`, `Worker`, `QueueEvents`). Exposes
  `QUEUE_PRIORITY` constants (Webhook=0, Rollback=1, Manual=10 — lower
  = higher priority). Singleton across the process.
- `NotificationService.ts` — refactored to Strategy pattern. Dispatchers
  live under `Services/Notifications/` and implement
  `INotificationDispatcher`. Fan-out via `Promise.allSettled`.

**Added in v3.0:**

- `QueueAdminService.ts` — mounts Bull Board at `/admin/queues` (Admin only)
- `RollbackService.ts` — F-007 transactional rollback (create, enqueue,
  and audit inside a SQL transaction; orphan BullMQ job removed if commit fails)
- `EnvironmentVariableService.ts` — F-003 CRUD with AES-256-GCM
- `NotificationProviderService.ts` — F-006 credentials store
- `NotificationChannelService.ts` — F-006 delivery channels
- `ProjectNotificationSubscriptionService.ts` — F-006 per-project subs
- `ProjectTemplateService.ts` — F-008 templates (built-ins immutable)
- `WorkspaceService.ts` — F-009 workspaces (owner-or-admin mutation)

**Notifications/ subdirectory (F-006):**

- `INotificationDispatcher.ts` — channel interface
- `DiscordDispatcher.ts`, `SlackDispatcher.ts`, `EmailDispatcher.ts`

**Responsibilities:**

- Implement business rules
- Orchestrate complex operations
- Interact with models
- Handle business exceptions

**Architecture:**

- Service classes (not singletons, except `QueueService` and `SocketService`)
- Dependency injection ready
- Comprehensive error handling
- Detailed logging

**Example:**

```typescript
const authService = new AuthService();
const result = await authService.Login({ Username, Password });
```

### 7. Controllers Layer (`src/Controllers/`)

**Purpose:** HTTP request/response handling

**Pre-v3.0:**

- `AuthController.ts` — Authentication endpoints
- `ProjectController.ts` — Project management endpoints
- `DeploymentController.ts` — Deployment endpoints
- `WebhookController.ts` — Webhook endpoints
- `UsersController.ts` — User management endpoints

**Added in v3.0:**

- `EnvironmentVariableController.ts` — F-003
- `NotificationProviderController.ts` — F-006
- `NotificationChannelController.ts` — F-006
- `ProjectNotificationSubscriptionController.ts` — F-006
- `ProjectTemplateController.ts` — F-008
- `WorkspaceController.ts` — F-009

`DeploymentController.ts` gained the `Rollback` handler (F-007) and the
`DownloadDeploymentLog` handler (F-004) in v3.0.

**Responsibilities:**

- Parse request data
- Call appropriate services
- Format responses
- Handle HTTP-specific errors

**Pattern:**

```typescript
public GetAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await this.Service.GetAll();
    ResponseHelper.Success(res, 'Success', data);
  } catch (error) {
    ResponseHelper.Error(res, error.message);
  }
};
```

### 8. Middleware Layer (`src/Middleware/`)

**Purpose:** Request processing pipeline

**Files:**

- `AuthMiddleware.ts` - JWT authentication
- `RoleMiddleware.ts` - Role-based authorization
- `ValidationMiddleware.ts` - Request validation (Joi)
- `RateLimiterMiddleware.ts` - Rate limiting
- `ErrorHandlerMiddleware.ts` - Global error handling
- `RequestLoggerMiddleware.ts` - Request logging

**Responsibilities:**

- Authenticate requests
- Authorize access
- Validate input
- Prevent abuse
- Log requests
- Handle errors

**Usage:**

```typescript
router.get('/',
  authMiddleware.Authenticate,
  roleMiddleware.RequireAdmin,
  rateLimiter.ApiLimiter,
  controller.GetAll
);
```

### 9. Routes Layer (`src/Routes/`)

**Purpose:** API endpoint definitions

**Files:**

- `AuthRoutes.ts` - Authentication routes
- `ProjectRoutes.ts` - Project routes
- `DeploymentRoutes.ts` - Deployment routes
- `WebhookRoutes.ts` - Webhook routes
- `index.ts` - Route aggregation

**Responsibilities:**

- Define URL patterns
- Map URLs to controllers
- Chain middleware
- Group related endpoints

**Structure:**

```tree
/api
  /auth
    POST /register
    POST /login
    GET  /profile
  /projects
    GET    /
    POST   /
    GET    /:id
    PUT    /:id
    DELETE /:id
  /deployments
    GET  /:id
    POST /:id/retry
```

### 10. Application Layer (`src/`)

**Files:**

- `App.ts` - Express app configuration
- `Server.ts` - Server initialization
- `index.ts` - Entry point

**Responsibilities:**

- Configure Express middleware
- Initialize routes
- Setup error handling
- Start HTTP server
- Graceful shutdown

## Design Patterns Used

### 1. Singleton Pattern

- `AppConfig` - Single configuration instance
- `Logger` - Single logger instance
- `DatabaseConnection` - Single DB connection
- `QueueService` - Single queue manager

### 2. Repository Pattern

- Models abstract database access
- Services use models for data operations
- Separation of data access from business logic

### 3. Service Layer Pattern

- Business logic separated from controllers
- Reusable across different interfaces
- Testable independently

### 4. Dependency Injection (Ready)

- Services accept dependencies
- Easy to mock for testing
- Loose coupling

### 5. Factory Pattern

- Response formatting
- Error handling
- Middleware creation

## Naming Conventions

### PascalCase (Enforced by ESLint)

- Classes: `AuthService`, `UserController`
- Interfaces: `IUser`, `IApiResponse`
- Types: `EUserRole`, `EDeploymentStatus`
- Class properties: `User.Id`, `Project.Name`
- Class methods: `GetAll()`, `CreateUser()`

### camelCase

- Variables: `const userId = 1`
- Function parameters: `function login(username, password)`
- Private methods: `private validateInput()`

### UPPERCASE

- Constants: `const MAX_RETRIES = 3`
- Environment variables: `process.env.DB_HOST`

## Data Flow Example

Example: Creating a deployment via webhook

```ascii
1. GitHub sends webhook
               ↓
2. WebhookRoutes receives POST /webhook/github/:projectName
               ↓
3. RateLimiterMiddleware checks rate limit
               ↓
4. WebhookController.HandleGitHubWebhook()
               ↓
5. WebhookService.VerifyGitHubSignature()
               ↓
6. WebhookService.ProcessGitHubWebhook()
               ↓
7. WebhookService.ShouldTriggerDeployment()
               ↓
8. DeploymentService.CreateDeployment()
               ↓
9. QueueService.Add() - Add to queue
               ↓
10. QueueService.ProcessQueue() - Execute when ready
               ↓
11. DeploymentService.ExecuteDeployment()
               ↓
12. PipelineService.ExecutePipeline()
               ↓
13. NotificationService.SendDeploymentNotification()
               ↓
14. Response sent back to GitHub
```

## Error Handling Strategy

### Layered Error Handling

1. **Service Layer**
   - Catches and logs errors
   - Throws business exceptions
   - Detailed error context

2. **Controller Layer**
   - Catches service errors
   - Formats error responses
   - HTTP status codes

3. **Middleware Layer**
   - Global error handler
   - Uncaught exception handler
   - 404 handler

### Error Response Format

```json
{
  "Success": false,
  "Message": "User-friendly message",
  "Error": "Technical error details",
  "Code": 400
}
```

## Security Measures

1. **Authentication**
   - JWT with RS256/HS256
   - Token refresh mechanism
   - Password hashing (bcrypt, 12 rounds)

2. **Authorization**
   - Role-based access control
   - Middleware enforcement
   - Resource-level permissions

3. **Input Validation**
   - Joi schemas
   - Sanitization
   - Type checking

4. **Rate Limiting**
   - Per-endpoint limits
   - IP-based tracking
   - Sliding window

5. **Security Headers**
   - Helmet.js
   - CORS configuration
   - XSS protection

6. **Encryption**
   - AES-256-GCM for sensitive data
   - HMAC for webhook signatures
   - SSL/TLS for transport

## Testing Strategy

### Unit Tests

- Test individual functions
- Mock dependencies
- Services and utilities

### Integration Tests

- Test API endpoints
- Database interactions
- End-to-end flows

### Test Structure

```tree
src/
  Controllers/
    AuthController.ts
    AuthController.test.ts
  Services/
    AuthService.ts
    AuthService.test.ts
```

## Performance Optimizations

1. **Database**
   - Connection pooling
   - Indexed queries
   - Eager/lazy loading

2. **Caching**
   - In-memory caching ready
   - Redis integration ready

3. **Compression**
   - Response compression
   - Gzip enabled

4. **Rate Limiting**
   - Prevent abuse
   - Resource protection

## Scalability Considerations

1. **Horizontal Scaling**
   - Stateless design
   - Session in JWT
   - Ready for load balancing

2. **Queue System**
   - Prevents concurrent deployments
   - Priority-based processing
   - Extensible to Redis/RabbitMQ

3. **Logging**
   - Structured logging
   - Log rotation
   - Ready for centralized logging

4. **Monitoring**
   - Health check endpoint
   - Metrics ready
   - Error tracking ready

## Extension Points

### Adding New Features

1. **New Model**
   - Create in `Models/`
   - Define relationships in `Models/index.ts`
   - Update types in `Types/`

2. **New Service**
   - Create in `Services/`
   - Implement business logic
   - Use existing models

3. **New Endpoint**
   - Create controller in `Controllers/`
   - Create routes in `Routes/`
   - Add to `Routes/index.ts`

4. **New Middleware**
   - Create in `Middleware/`
   - Apply in routes or `App.ts`

## Best Practices

1. **Always use PascalCase** for classes, interfaces, properties, methods
2. **Always log** important operations and errors
3. **Always validate** input at controller level
4. **Always handle** errors gracefully
5. **Always use** TypeScript strict mode
6. **Always follow** SOLID principles
7. **Always test** new features
8. **Always document** complex logic

## Troubleshooting

### Common Issues

1. **Import errors**
   - Check tsconfig paths
   - Verify file exists
   - Check circular dependencies

2. **Database errors**
   - Check model definitions
   - Verify relationships
   - Check migrations

3. **Type errors**
   - Update interface definitions
   - Check type imports
   - Verify type compatibility

## Contributing Guidelines

When contributing to this project:

1. Follow the existing architecture
2. Maintain PascalCase naming
3. Add appropriate logging
4. Include error handling
5. Write tests
6. Update documentation
7. Follow ESLint rules

## Additional Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Express Documentation](https://expressjs.com/)
- [Sequelize Documentation](https://sequelize.org/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
