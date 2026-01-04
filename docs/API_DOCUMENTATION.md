# Deploy Center - API Documentation

**Version:** 2.1.0
**Base URL:** `http://your-domain.com/api/v1`
**Authentication:** JWT Bearer Token (via httpOnly cookies)
**Last Updated:** December 28, 2024

---

## 📋 Table of Contents

1. [Authentication](#1-authentication)
2. [User Management](#2-user-management)
3. [Project Management](#3-project-management)
4. [SSH Key Management](#4-ssh-key-management)
5. [Deployment Operations](#5-deployment-operations)
6. [Audit Logs](#6-audit-logs)
7. [GitHub Webhooks](#7-github-webhooks)
8. [Error Handling](#error-handling)
9. [Response Format](#response-format)
10. [Rate Limiting](#rate-limiting)

---

## 🔐 Authentication

All authenticated endpoints require a valid JWT access token sent via httpOnly cookies. Tokens are automatically included in requests after login.

### Cookie Names

- `accessToken` - Short-lived access token (15 minutes)
- `refreshToken` - Long-lived refresh token (7 days)

---

### 1.1 Register User

**Endpoint:** `POST /api/v1/auth/register`
**Authentication:** Not required
**Description:** Create a new user account

**Request Body:**

```json
{
  "Username": "johndoe",
  "Email": "john@example.com",
  "Password": "SecurePassword123!",
  "Role": "Developer"
}
```

**Field Validation:**

- `Username`: Required, 3-50 characters, alphanumeric + underscore
- `Email`: Required, valid email format
- `Password`: Required, minimum 8 characters
- `Role`: Optional, one of: `Admin`, `Manager`, `Developer`, `Viewer` (default: `Developer`)

**Success Response (201):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "Id": 1,
    "Username": "johndoe",
    "Email": "john@example.com",
    "Role": "Developer",
    "CreatedAt": "2024-12-28T10:00:00.000Z"
  },
  "error": false
}
```

**Error Responses:**

- `400` - Validation error (missing fields, invalid format)
- `409` - User already exists (duplicate username/email)
- `500` - Server error

---

### 1.2 Login User

**Endpoint:** `POST /api/v1/auth/login`
**Authentication:** Not required
**Description:** Authenticate user and receive JWT tokens

**Request Body:**

```json
{
  "Email": "john@example.com",
  "Password": "SecurePassword123!"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "Id": 1,
      "Username": "johndoe",
      "Email": "john@example.com",
      "Role": "Developer"
    }
  },
  "error": false
}
```

**Sets Cookies:**

- `accessToken` - HTTP-only, Secure, SameSite=Strict
- `refreshToken` - HTTP-only, Secure, SameSite=Strict

**Error Responses:**

- `400` - Invalid credentials
- `404` - User not found
- `500` - Server error

---

### 1.3 Logout User

**Endpoint:** `POST /api/v1/auth/logout`
**Authentication:** Required
**Description:** Invalidate current session and clear tokens

**Success Response (200):**

```json
{
  "success": true,
  "message": "Logout successful",
  "data": null,
  "error": false
}
```

**Clears Cookies:**

- `accessToken`
- `refreshToken`

---

### 1.4 Refresh Token

**Endpoint:** `POST /api/v1/auth/refresh`
**Authentication:** Refresh token required (via cookie)
**Description:** Get a new access token using refresh token

**Success Response (200):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": null,
  "error": false
}
```

**Sets Cookies:**

- `accessToken` - New access token

**Error Responses:**

- `401` - Invalid or expired refresh token
- `500` - Server error

---

### 1.5 Get Current User

**Endpoint:** `GET /api/v1/auth/me`
**Authentication:** Required
**Description:** Get currently authenticated user's profile

**Success Response (200):**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "Id": 1,
    "Username": "johndoe",
    "Email": "john@example.com",
    "Role": "Developer",
    "CreatedAt": "2024-12-28T10:00:00.000Z",
    "UpdatedAt": "2024-12-28T10:00:00.000Z"
  },
  "error": false
}
```

---

### 1.6 Request Password Reset

**Endpoint:** `POST /api/v1/auth/forgot-password`
**Authentication:** Not required
**Description:** Request password reset email

**Request Body:**

```json
{
  "Email": "john@example.com"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password reset link sent to email",
  "data": null,
  "error": false
}
```

---

### 1.7 Reset Password

**Endpoint:** `POST /api/v1/auth/reset-password`
**Authentication:** Not required
**Description:** Reset password using reset token

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword123!"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": null,
  "error": false
}
```

**Error Responses:**

- `400` - Invalid or expired token
- `500` - Server error

---

## 👥 2. User Management

### 2.1 List All Users

**Endpoint:** `GET /api/v1/users`
**Authentication:** Required
**Permissions:** Admin, Manager
**Description:** Get list of all users

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `role` (optional): Filter by role
- `search` (optional): Search by username or email

**Example Request:**

```
GET /api/v1/users?page=1&limit=10&role=Developer&search=john
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "Id": 1,
        "Username": "johndoe",
        "Email": "john@example.com",
        "Role": "Developer",
        "CreatedAt": "2024-12-28T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  },
  "error": false
}
```

**Error Responses:**

- `403` - Insufficient permissions
- `500` - Server error

---

### 2.2 Get User by ID

**Endpoint:** `GET /api/v1/users/:id`
**Authentication:** Required
**Permissions:** Admin, Manager, or own profile
**Description:** Get detailed user information

**Success Response (200):**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "Id": 1,
    "Username": "johndoe",
    "Email": "john@example.com",
    "Role": "Developer",
    "CreatedAt": "2024-12-28T10:00:00.000Z",
    "UpdatedAt": "2024-12-28T10:00:00.000Z",
    "Projects": [
      {
        "Id": 1,
        "Name": "My Project",
        "Role": "owner"
      }
    ]
  },
  "error": false
}
```

---

### 2.3 Update User

**Endpoint:** `PUT /api/v1/users/:id`
**Authentication:** Required
**Permissions:** Admin, Manager, or own profile
**Description:** Update user information

**Request Body:**

```json
{
  "Username": "johndoe_updated",
  "Email": "john.new@example.com",
  "Role": "Manager"
}
```

**Notes:**

- Only Admin can change roles
- Users can update their own username and email

**Success Response (200):**

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "Id": 1,
    "Username": "johndoe_updated",
    "Email": "john.new@example.com",
    "Role": "Manager"
  },
  "error": false
}
```

---

### 2.4 Change Password

**Endpoint:** `PUT /api/v1/users/:id/password`
**Authentication:** Required
**Permissions:** Own account only
**Description:** Change user password

**Request Body:**

```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword123!"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": null,
  "error": false
}
```

**Error Responses:**

- `400` - Old password incorrect
- `403` - Cannot change other user's password

---

### 2.5 Delete User

**Endpoint:** `DELETE /api/v1/users/:id`
**Authentication:** Required
**Permissions:** Admin only
**Description:** Delete a user account

**Success Response (200):**

```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": null,
  "error": false
}
```

**Notes:**

- Cascades delete: ProjectMembers, SSHKeys, AuditLogs
- Cannot delete yourself

---

## 📁 3. Project Management

### 3.1 Create Project

**Endpoint:** `POST /api/v1/projects`
**Authentication:** Required
**Permissions:** Admin, Manager, Developer
**Description:** Create a new project

**Request Body:**

```json
{
  "Name": "My Awesome Project",
  "Description": "A production-ready Node.js application",
  "Repository": "https://github.com/user/repo.git",
  "Branch": "main",
  "ProjectPath": "/var/www/my-project",
  "Variables": {
    "type": "node",
    "pm2Name": "my-app",
    "buildCmd": "npm run build",
    "port": "3000"
  },
  "Pipeline": [
    {
      "name": "Pull Latest Code",
      "run": [
        "cd {{projectPath}}",
        "git pull origin {{branch}}"
      ]
    },
    {
      "name": "Install Dependencies",
      "run": ["npm ci"]
    },
    {
      "name": "Build Application",
      "run_if": "hasVar('buildCmd')",
      "run": ["{{buildCmd}}"]
    },
    {
      "name": "Restart PM2",
      "run": ["pm2 reload {{pm2Name}}"]
    }
  ],
  "DiscordWebhook": "https://discord.com/api/webhooks/..."
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Project created successfully",
  "data": {
    "Id": 1,
    "Name": "My Awesome Project",
    "Description": "A production-ready Node.js application",
    "Repository": "https://github.com/user/repo.git",
    "Branch": "main",
    "CreatedAt": "2024-12-28T10:00:00.000Z"
  },
  "error": false
}
```

**Notes:**

- User creating project is automatically assigned as "owner"
- Pipeline steps are executed sequentially
- Variables can be referenced in pipeline using `{{variableName}}`

---

### 3.2 List All Projects

**Endpoint:** `GET /api/v1/projects`
**Authentication:** Required
**Description:** Get all projects accessible to current user

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search by name or description

**Success Response (200):**

```json
{
  "success": true,
  "message": "Projects retrieved successfully",
  "data": {
    "projects": [
      {
        "Id": 1,
        "Name": "My Awesome Project",
        "Description": "A production-ready Node.js application",
        "Repository": "https://github.com/user/repo.git",
        "Branch": "main",
        "CreatedAt": "2024-12-28T10:00:00.000Z",
        "UserRole": "owner"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "error": false
}
```

**Access Rules:**

- **Admin/Manager:** See all projects
- **Developer/Viewer:** See only projects they're members of

---

### 3.3 Get Project by ID

**Endpoint:** `GET /api/v1/projects/:id`
**Authentication:** Required
**Permissions:** Project member, Admin, or Manager
**Description:** Get detailed project information

**Success Response (200):**

```json
{
  "success": true,
  "message": "Project retrieved successfully",
  "data": {
    "Id": 1,
    "Name": "My Awesome Project",
    "Description": "A production-ready Node.js application",
    "Repository": "https://github.com/user/repo.git",
    "Branch": "main",
    "ProjectPath": "/var/www/my-project",
    "Variables": {
      "type": "node",
      "pm2Name": "my-app",
      "buildCmd": "npm run build"
    },
    "Pipeline": [...],
    "DiscordWebhook": "https://discord.com/api/webhooks/...",
    "Members": [
      {
        "UserId": 1,
        "Username": "johndoe",
        "Role": "owner",
        "AddedAt": "2024-12-28T10:00:00.000Z"
      }
    ],
    "CreatedAt": "2024-12-28T10:00:00.000Z",
    "UpdatedAt": "2024-12-28T10:00:00.000Z"
  },
  "error": false
}
```

---

### 3.4 Update Project

**Endpoint:** `PUT /api/v1/projects/:id`
**Authentication:** Required
**Permissions:** Project owner, Admin, or Manager
**Description:** Update project configuration

**Request Body:** (all fields optional)

```json
{
  "Name": "Updated Project Name",
  "Description": "Updated description",
  "Branch": "develop",
  "Variables": {
    "newVar": "value"
  },
  "Pipeline": [...],
  "DiscordWebhook": "https://discord.com/api/webhooks/new"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Project updated successfully",
  "data": {
    "Id": 1,
    "Name": "Updated Project Name",
    "UpdatedAt": "2024-12-28T11:00:00.000Z"
  },
  "error": false
}
```

---

### 3.5 Delete Project

**Endpoint:** `DELETE /api/v1/projects/:id`
**Authentication:** Required
**Permissions:** Admin or Manager only
**Description:** Delete a project

**Success Response (200):**

```json
{
  "success": true,
  "message": "Project deleted successfully",
  "data": null,
  "error": false
}
```

**Notes:**

- Cascades delete: Deployments, DeploymentLogs, ProjectMembers, ProjectAuditLogs

---

### 3.6 Get Project Members

**Endpoint:** `GET /api/v1/projects/:id/members`
**Authentication:** Required
**Permissions:** Project member, Admin, or Manager
**Description:** Get all members of a project

**Success Response (200):**

```json
{
  "success": true,
  "message": "Project members retrieved successfully",
  "data": [
    {
      "Id": 1,
      "UserId": 1,
      "ProjectId": 1,
      "Role": "owner",
      "AddedAt": "2024-12-28T10:00:00.000Z",
      "User": {
        "Id": 1,
        "Username": "johndoe",
        "Email": "john@example.com",
        "Role": "Developer"
      }
    }
  ],
  "error": false
}
```

---

### 3.7 Add Project Member

**Endpoint:** `POST /api/v1/projects/:id/members`
**Authentication:** Required
**Permissions:** Project owner, Admin, or Manager
**Description:** Add a user to the project

**Request Body:**

```json
{
  "userId": 2,
  "role": "member"
}
```

**Role Options:**

- `owner` - Can manage members and project settings
- `member` - Can deploy and view project

**Success Response (201):**

```json
{
  "success": true,
  "message": "Member added successfully",
  "data": {
    "Id": 2,
    "UserId": 2,
    "ProjectId": 1,
    "Role": "member",
    "AddedAt": "2024-12-28T12:00:00.000Z"
  },
  "error": false
}
```

**Error Responses:**

- `400` - User already a member
- `404` - User or project not found

---

### 3.8 Remove Project Member

**Endpoint:** `DELETE /api/v1/projects/:projectId/members/:userId`
**Authentication:** Required
**Permissions:** Project owner, Admin, or Manager
**Description:** Remove a user from the project

**Success Response (200):**

```json
{
  "success": true,
  "message": "Member removed successfully",
  "data": null,
  "error": false
}
```

**Notes:**

- Cannot remove the last owner of a project
- Owners can remove themselves if there's another owner

---

### 3.9 Get Project Audit Logs

**Endpoint:** `GET /api/v1/projects/:id/audit-logs`
**Authentication:** Required
**Permissions:** Project member, Admin, or Manager
**Description:** Get audit trail for project changes

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Items per page

**Success Response (200):**

```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": {
    "logs": [
      {
        "Id": 1,
        "ProjectId": 1,
        "UserId": 1,
        "Action": "PROJECT_UPDATED",
        "Details": "Updated project configuration",
        "CreatedAt": "2024-12-28T11:00:00.000Z",
        "User": {
          "Username": "johndoe"
        }
      }
    ],
    "pagination": {...}
  },
  "error": false
}
```

---

## 🔑 4. SSH Key Management

### 4.1 Add SSH Key

**Endpoint:** `POST /api/v1/ssh-keys`
**Authentication:** Required
**Description:** Add a new SSH key pair

**Request Body:**

```json
{
  "Name": "Production Server Key",
  "PublicKey": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...",
  "PrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "SSH key added successfully",
  "data": {
    "Id": 1,
    "Name": "Production Server Key",
    "Fingerprint": "SHA256:abc123...",
    "CreatedAt": "2024-12-28T10:00:00.000Z"
  },
  "error": false
}
```

**Notes:**

- Private key is encrypted with AES-256-GCM before storage
- Fingerprint is SHA-256 hash of public key
- Private key is NEVER returned in API responses

---

### 4.2 List SSH Keys

**Endpoint:** `GET /api/v1/ssh-keys`
**Authentication:** Required
**Description:** Get all SSH keys for current user

**Success Response (200):**

```json
{
  "success": true,
  "message": "SSH keys retrieved successfully",
  "data": [
    {
      "Id": 1,
      "Name": "Production Server Key",
      "Fingerprint": "SHA256:abc123...",
      "CreatedAt": "2024-12-28T10:00:00.000Z"
    }
  ],
  "error": false
}
```

**Access Rules:**

- Users see only their own SSH keys
- Admin/Manager can see all SSH keys

---

### 4.3 Get SSH Key by ID

**Endpoint:** `GET /api/v1/ssh-keys/:id`
**Authentication:** Required
**Permissions:** Key owner, Admin, or Manager
**Description:** Get SSH key details (without private key)

**Success Response (200):**

```json
{
  "success": true,
  "message": "SSH key retrieved successfully",
  "data": {
    "Id": 1,
    "Name": "Production Server Key",
    "PublicKey": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...",
    "Fingerprint": "SHA256:abc123...",
    "CreatedAt": "2024-12-28T10:00:00.000Z"
  },
  "error": false
}
```

---

### 4.4 Delete SSH Key

**Endpoint:** `DELETE /api/v1/ssh-keys/:id`
**Authentication:** Required
**Permissions:** Key owner, Admin, or Manager
**Description:** Delete an SSH key

**Success Response (200):**

```json
{
  "success": true,
  "message": "SSH key deleted successfully",
  "data": null,
  "error": false
}
```

---

## 🚀 5. Deployment Operations

### 5.1 Trigger Deployment

**Endpoint:** `POST /api/v1/deployments/trigger`
**Authentication:** Required
**Permissions:** Project member, Admin, or Manager
**Description:** Manually trigger a deployment

**Request Body:**

```json
{
  "projectId": 1,
  "branch": "main",
  "commit": "a1b2c3d4e5f6"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Deployment triggered successfully",
  "data": {
    "Id": 1,
    "ProjectId": 1,
    "Branch": "main",
    "Commit": "a1b2c3d4e5f6",
    "Status": "pending",
    "TriggeredBy": 1,
    "CreatedAt": "2024-12-28T10:00:00.000Z"
  },
  "error": false
}
```

**Deployment Status Flow:**

- `pending` → Deployment queued
- `running` → Pipeline executing
- `success` → Deployment completed successfully
- `failed` → Deployment failed (check logs)

---

### 5.2 List Deployments

**Endpoint:** `GET /api/v1/deployments`
**Authentication:** Required
**Description:** Get all deployments accessible to current user

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Items per page
- `projectId` (optional): Filter by project
- `status` (optional): Filter by status (pending, running, success, failed)
- `branch` (optional): Filter by branch

**Success Response (200):**

```json
{
  "success": true,
  "message": "Deployments retrieved successfully",
  "data": {
    "deployments": [
      {
        "Id": 1,
        "ProjectId": 1,
        "Branch": "main",
        "Commit": "a1b2c3d4e5f6",
        "Status": "success",
        "TriggeredBy": 1,
        "StartedAt": "2024-12-28T10:00:00.000Z",
        "CompletedAt": "2024-12-28T10:05:00.000Z",
        "Duration": 300,
        "Project": {
          "Name": "My Awesome Project"
        },
        "User": {
          "Username": "johndoe"
        }
      }
    ],
    "pagination": {...}
  },
  "error": false
}
```

**Access Rules:**

- **Admin/Manager:** See all deployments
- **Developer/Viewer:** See only deployments for projects they're members of

---

### 5.3 Get Deployment by ID

**Endpoint:** `GET /api/v1/deployments/:id`
**Authentication:** Required
**Permissions:** Project member, Admin, or Manager
**Description:** Get detailed deployment information

**Success Response (200):**

```json
{
  "success": true,
  "message": "Deployment retrieved successfully",
  "data": {
    "Id": 1,
    "ProjectId": 1,
    "Branch": "main",
    "Commit": "a1b2c3d4e5f6",
    "Status": "success",
    "TriggeredBy": 1,
    "StartedAt": "2024-12-28T10:00:00.000Z",
    "CompletedAt": "2024-12-28T10:05:00.000Z",
    "Duration": 300,
    "Logs": [
      {
        "Id": 1,
        "StepName": "Pull Latest Code",
        "Output": "Already up to date.\n",
        "Error": null,
        "ExitCode": 0,
        "Timestamp": "2024-12-28T10:01:00.000Z"
      },
      {
        "Id": 2,
        "StepName": "Install Dependencies",
        "Output": "added 250 packages in 30s\n",
        "Error": null,
        "ExitCode": 0,
        "Timestamp": "2024-12-28T10:02:00.000Z"
      }
    ],
    "Project": {...},
    "User": {...}
  },
  "error": false
}
```

---

### 5.4 Get Deployment Logs (Real-Time)

**WebSocket Connection:** `ws://your-domain.com`
**Authentication:** Required (via Socket.IO handshake)
**Description:** Subscribe to real-time deployment logs

**Client-Side (JavaScript):**

```javascript
import io from 'socket.io-client';

const socket = io('http://your-domain.com', {
  withCredentials: true // Include cookies for auth
});

// Join deployment room
socket.emit('join-deployment', { deploymentId: 1 });

// Listen for log updates
socket.on('deployment-log', (data) => {
  console.log('Step:', data.stepName);
  console.log('Output:', data.output);
  console.log('Status:', data.status);
});

// Listen for deployment status changes
socket.on('deployment-status', (data) => {
  console.log('Deployment Status:', data.status);
  // status: pending, running, success, failed
});

// Leave deployment room
socket.emit('leave-deployment', { deploymentId: 1 });
```

**Events Emitted by Server:**

- `deployment-log` - New log entry added
- `deployment-status` - Deployment status changed
- `deployment-complete` - Deployment finished (success or failed)

---

### 5.5 Rollback Deployment

**Endpoint:** `POST /api/v1/deployments/:id/rollback`
**Authentication:** Required
**Permissions:** Project owner, Admin, or Manager
**Description:** Rollback to a previous deployment

**Success Response (200):**

```json
{
  "success": true,
  "message": "Rollback triggered successfully",
  "data": {
    "newDeploymentId": 15,
    "rolledBackFrom": 14,
    "rolledBackTo": 13
  },
  "error": false
}
```

**Notes:**

- Creates a new deployment that reverts to the specified commit
- Only successful deployments can be rolled back to

---

### 5.6 Get Deployment Queue Status

**Endpoint:** `GET /api/v1/deployments/queue/:projectId`
**Authentication:** Required
**Permissions:** Project member, Admin, or Manager
**Description:** Get current deployment queue for a project

**Success Response (200):**

```json
{
  "success": true,
  "message": "Queue status retrieved successfully",
  "data": {
    "projectId": 1,
    "queueLength": 2,
    "currentDeployment": {
      "Id": 10,
      "Status": "running",
      "StartedAt": "2024-12-28T10:00:00.000Z"
    },
    "pendingDeployments": [
      {
        "Id": 11,
        "Status": "pending",
        "CreatedAt": "2024-12-28T10:05:00.000Z"
      }
    ]
  },
  "error": false
}
```

---

## 📊 6. Audit Logs

### 6.1 List System Audit Logs

**Endpoint:** `GET /api/v1/audit-logs`
**Authentication:** Required
**Permissions:** Admin or Manager
**Description:** Get system-wide audit trail

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Items per page
- `userId` (optional): Filter by user
- `action` (optional): Filter by action type
- `startDate` (optional): Filter from date (ISO 8601)
- `endDate` (optional): Filter to date (ISO 8601)

**Success Response (200):**

```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": {
    "logs": [
      {
        "Id": 1,
        "UserId": 1,
        "Action": "USER_LOGIN",
        "Details": "User logged in successfully",
        "IpAddress": "192.168.1.100",
        "UserAgent": "Mozilla/5.0...",
        "CreatedAt": "2024-12-28T10:00:00.000Z",
        "User": {
          "Username": "johndoe"
        }
      }
    ],
    "pagination": {...}
  },
  "error": false
}
```

**Audit Action Types:**

- `USER_LOGIN`
- `USER_LOGOUT`
- `USER_CREATED`
- `USER_UPDATED`
- `USER_DELETED`
- `PROJECT_CREATED`
- `PROJECT_UPDATED`
- `PROJECT_DELETED`
- `DEPLOYMENT_TRIGGERED`
- `DEPLOYMENT_COMPLETED`
- `SSH_KEY_ADDED`
- `SSH_KEY_DELETED`
- `MEMBER_ADDED`
- `MEMBER_REMOVED`

---

## 🔗 7. GitHub Webhooks

### 7.1 GitHub Push Webhook

**Endpoint:** `POST /api/v1/deploy`
**Authentication:** GitHub webhook signature (HMAC-SHA256)
**Description:** Receive GitHub push events and trigger deployments

**Headers:**

- `X-Hub-Signature-256`: HMAC-SHA256 signature for verification
- `X-GitHub-Event`: Event type (should be "push")

**GitHub Webhook Payload:**

```json
{
  "ref": "refs/heads/main",
  "repository": {
    "name": "my-repo",
    "full_name": "user/my-repo"
  },
  "head_commit": {
    "id": "a1b2c3d4e5f6",
    "message": "Fix critical bug",
    "author": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Deployment triggered successfully",
  "data": {
    "deploymentId": 1,
    "projectName": "My Awesome Project",
    "branch": "main",
    "commit": "a1b2c3d4e5f6"
  },
  "error": false
}
```

**Error Responses:**

- `400` - Invalid signature or payload
- `404` - No matching project found
- `403` - Branch does not match project configuration

**Signature Verification:**
The webhook secret must match the `secret` in project configuration. Signature is verified using HMAC-SHA256:

```javascript
const signature = request.headers['x-hub-signature-256'];
const hmac = crypto.createHmac('sha256', projectSecret);
const digest = 'sha256=' + hmac.update(JSON.stringify(request.body)).digest('hex');
const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
```

---

## ❌ Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "message": "Human-readable error message",
  "data": null,
  "error": true
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Validation error, invalid input |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource (username, email, etc.) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### Common Error Messages

**Authentication Errors:**

```json
{
  "success": false,
  "message": "Unauthorized - Please login",
  "error": true
}
```

**Permission Errors:**

```json
{
  "success": false,
  "message": "Forbidden - Insufficient permissions",
  "error": true
}
```

**Validation Errors:**

```json
{
  "success": false,
  "message": "Validation failed: Email is required",
  "error": true
}
```

**Resource Not Found:**

```json
{
  "success": false,
  "message": "Project not found",
  "error": true
}
```

---

## ✅ Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ },
  "error": false
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "data": null,
  "error": true
}
```

### Paginated Response

```json
{
  "success": true,
  "message": "Resources retrieved successfully",
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  },
  "error": false
}
```

---

## 🛡️ Rate Limiting

### Default Limits

- **Authentication endpoints:** 5 requests per minute per IP
- **API endpoints (authenticated):** 100 requests per minute per user
- **Webhook endpoint:** 10 requests per minute per project

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later.",
  "error": true
}
```

**HTTP Status:** 429 Too Many Requests

---

## 🔧 Development & Testing

### Base URLs

- **Production:** `https://deploy.yourdomain.com/api/v1`
- **Staging:** `https://staging-deploy.yourdomain.com/api/v1`
- **Development:** `http://localhost:5000/api/v1`

### Testing with cURL

**Login Example:**

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"Email":"john@example.com","Password":"password123"}' \
  -c cookies.txt
```

**Authenticated Request:**

```bash
curl -X GET http://localhost:5000/api/v1/projects \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

### Testing with Postman

1. **Import Collection:** Use the OpenAPI/Swagger specification (coming soon)
2. **Environment Variables:**
   - `base_url`: `http://localhost:5000/api/v1`
   - `access_token`: Automatically captured from login response
3. **Cookie Management:** Enable "Automatically follow redirects" and "Send cookies"

---

## 📚 Additional Resources

- **OpenAPI/Swagger Spec:** `/api/v1/docs` (coming soon)
- **Postman Collection:** Available in `docs/` folder
- **Example Requests:** See `examples/` folder
- **GitHub Repository:** [https://github.com/FutureSolutionDev/Deploy-Center-Server](https://github.com/FutureSolutionDev/Deploy-Center-Server)

---

## 📞 Support

- **Documentation:** [https://docs.deploycenter.io](https://docs.deploycenter.io)
- **API Status:** [https://status.deploycenter.io](https://status.deploycenter.io)
- **Support Email:** <support@deploycenter.io>
- **Discord Community:** [Join our Discord](https://discord.gg/deploycenter)

---

**Last Updated:** December 28, 2024
**API Version:** v1
**Documentation Version:** 1.0
