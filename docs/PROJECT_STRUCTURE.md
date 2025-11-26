# Project Structure Documentation

This document explains the architecture and organization of the Deploy Center server.

## Architecture Overview

The project follows a layered architecture pattern:

```mermaid
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
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        Models Layer                     │
│  (Data access & ORM)                    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Database                        │
│  (MariaDB)                              │
└─────────────────────────────────────────┘
```

## Directory Structure

```mermaid
server/
├── src/
│   ├── Config/              # Application configuration
│   ├── Controllers/         # HTTP request handlers
│   ├── Database/            # Database connection & setup
│   ├── Middleware/          # Express middlewares
│   ├── Models/              # Database models (Sequelize)
│   ├── Routes/              # API route definitions
│   ├── Services/            # Business logic layer
│   ├── Types/               # TypeScript type definitions
│   ├── Utils/               # Utility functions & helpers
│   ├── App.ts               # Express application setup
│   ├── Server.ts            # Server initialization
│   └── index.ts             # Application entry point
├── logs/                    # Application logs (auto-generated)
├── deployments/             # Deployment workspaces (auto-generated)
├── .env                     # Environment variables (create from .env.example)
├── .env.example             # Environment template
├── .eslintrc.json           # ESLint configuration
├── .prettierrc.json         # Prettier configuration
├── .gitignore               # Git ignore rules
├── jest.config.js           # Jest testing configuration
├── nodemon.json             # Nodemon configuration
├── tsconfig.json            # TypeScript compiler options
├── package.json             # Dependencies and scripts
├── README.md                # Main documentation
├── QUICK_START.md           # Quick start guide
└── PROJECT_STRUCTURE.md     # This file
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
console.log(config.Port); // 3000
```

### 2. Models Layer (`src/Models/`)

**Purpose:** Database schema and ORM models

**Files:**

- `User.ts` - User authentication model
- `Project.ts` - Project configuration model
- `Deployment.ts` - Deployment tracking model
- `DeploymentStep.ts` - Pipeline step execution model
- `AuditLog.ts` - Audit trail model
- `index.ts` - Model associations and exports

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

**Purpose:** Database connection management

**Files:**

- `DatabaseConnection.ts` - Sequelize connection singleton

**Responsibilities:**

- Initialize database connection
- Connection pooling
- Test connectivity
- Sync models (development)

**Features:**

- Singleton pattern
- Connection testing
- Graceful shutdown
- Auto-reconnect

### 6. Services Layer (`src/Services/`)

**Purpose:** Business logic and orchestration

**Files:**

- `AuthService.ts` - Authentication & JWT
- `ProjectService.ts` - Project CRUD operations
- `DeploymentService.ts` - Deployment orchestration
- `PipelineService.ts` - Pipeline execution engine
- `QueueService.ts` - Deployment queue management
- `NotificationService.ts` - Multi-platform notifications
- `WebhookService.ts` - Webhook verification & processing

**Responsibilities:**

- Implement business rules
- Orchestrate complex operations
- Interact with models
- Handle business exceptions

**Architecture:**

- Service classes (not singletons, except QueueService)
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

**Files:**

- `AuthController.ts` - Authentication endpoints
- `ProjectController.ts` - Project management endpoints
- `DeploymentController.ts` - Deployment endpoints
- `WebhookController.ts` - Webhook endpoints

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

```mermaid
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

```mermaid
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

```mermaid
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
