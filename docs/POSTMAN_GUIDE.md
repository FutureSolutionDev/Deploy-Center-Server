# Postman Collection Guide

Complete guide for using the Deploy Center Postman Collection to test all API endpoints.

> **v3.0 status (2026-05-24):** the shipped `POSTMAN_COLLECTION.json` covers
> the v2.1 surface (auth, projects, deployments, users, webhooks, SSH keys).
> The v3.0 endpoints below are NOT yet in the collection — use the cURL
> examples in the relevant guides until the collection is refreshed in v3.0.1:
>
> - **Workspaces** — `/api/workspaces`, `PATCH /api/projects/:id/workspace`
>   (see [creating-projects.md §Workspaces](./guides/creating-projects.md#workspaces-v30))
> - **Project Templates** — `/api/project-templates`
>   (see [creating-projects.md §Step 0](./guides/creating-projects.md#step-0-choose-a-template-v30))
> - **Encrypted Env Vars** — `/api/projects/:projectId/env-vars`
>   (see [environment-variables.md §Encrypted Variables](./guides/environment-variables.md#encrypted-variables-v30))
> - **Notification Providers/Channels/Subscriptions** —
>   `/api/notifications/providers`, `/api/notifications/channels`,
>   `/api/projects/:projectId/notification-subscriptions`
>   (see [notifications.md §v3.0 Architecture](./guides/notifications.md#v30-architecture-providers-channels-subscriptions))
> - **Rollback** — `POST /api/deployments/:id/rollback`
>   (see [deployment-workflows.md §Rollback Support](./guides/deployment-workflows.md#rollback-support))
> - **Log download** — `GET /api/deployments/:id/log/download`
>   (see [deployment-logs.md §Downloading Logs](./guides/deployment-logs.md#downloading-logs-v30))
> - **Bull Board admin UI** — `GET /admin/queues/*` (browser-only, Admin role)
>
> Also note: the v3.0 server defaults to port **9090**, not `3000`.

## 📥 Import Collection

### Method 1: Import from File

1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `POSTMAN_COLLECTION.json`
5. Click **Import**

### Method 2: Import from URL

If the collection is hosted on GitHub:

1. Copy the raw URL of `POSTMAN_COLLECTION.json`
2. Click **Import** in Postman
3. Select **Link** tab
4. Paste the URL
5. Click **Continue** → **Import**

## ⚙️ Configuration

### Collection Variables

The collection uses variables for easy configuration. Update these before testing:

1. Click on **Deploy Center API** collection
2. Go to **Variables** tab
3. Update the following:

| Variable | Description | Default Value | Update To |
|----------|-------------|---------------|-----------|
| `base_url` | Server URL | `http://localhost:3000` | Your server URL |
| `access_token` | JWT access token | (empty) | Auto-filled on login |
| `refresh_token` | JWT refresh token | (empty) | Auto-filled on login |
| `project_id` | Project ID for testing | `1` | Auto-filled on create |
| `deployment_id` | Deployment ID for testing | `1` | Auto-filled on create |

### Environment Setup (Optional)

For multiple environments (dev, staging, production):

1. Create new environment: **Environments** → **Create Environment**
2. Add variables:
   - `base_url` → `http://localhost:3000` (for dev)
   - `base_url` → `https://api.yourdomain.com` (for production)
3. Select environment from dropdown (top right)

## 🚀 Quick Start Testing

### Step 1: Health Check

1. Expand **Health & Info** folder
2. Click **Health Check**
3. Click **Send**

**Expected Response:**

```json
{
  "Success": true,
  "Message": "Deploy Center API is running",
  "Timestamp": "2025-01-26T..."
}
```

### Step 2: Register Admin User

1. Expand **Authentication** folder
2. Click **Register Admin User**
3. (Optional) Modify the request body if needed
4. Click **Send**

**What happens:**

- Creates admin user in database
- Returns user info and JWT tokens
- **Automatically saves** `access_token` and `refresh_token` to variables

**Expected Response:**

```json
{
  "Success": true,
  "Message": "User registered successfully",
  "Data": {
    "User": {
      "Id": 1,
      "Username": "admin",
      "Email": "admin@example.com",
      "Role": "admin"
    },
    "Tokens": {
      "AccessToken": "eyJhbGc...",
      "RefreshToken": "eyJhbGc..."
    }
  },
  "Code": 201
}
```

### Step 3: Test Authentication

1. Click **Get Profile** request
2. Notice the **Authorization** header is auto-filled with `{{access_token}}`
3. Click **Send**

**Expected Response:**

```json
{
  "Success": true,
  "Message": "Profile retrieved successfully",
  "Data": {
    "User": {
      "Id": 1,
      "Username": "admin",
      "Email": "admin@example.com",
      "Role": "admin",
      "IsActive": true
    }
  }
}
```

### Step 4: Create Project

1. Expand **Projects** folder
2. Click **Create Project - Simple**
3. Modify the request body if needed:
   - Change `Name` to your project name
   - Update `RepoUrl` to your repository
   - Adjust `Pipeline` steps
4. Click **Send**

**What happens:**

- Creates project in database
- Generates webhook secret
- **Automatically saves** `project_id` to variable

**Expected Response:**

```json
{
  "Success": true,
  "Message": "Project created successfully",
  "Data": {
    "Project": {
      "Id": 1,
      "Name": "my-app",
      "RepoUrl": "https://github.com/username/my-app.git",
      "WebhookSecret": "abc123...",
      "Config": { ... }
    }
  },
  "Code": 201
}
```

**Important:** Save the `WebhookSecret` for GitHub webhook configuration!

### Step 5: Trigger Manual Deployment

1. Expand **Deployments** folder
2. Click **Create Manual Deployment**
3. Update the request body if needed
4. Click **Send**

**What happens:**

- Creates deployment record
- Adds to queue
- Starts deployment process
- **Automatically saves** `deployment_id` to variable

### Step 6: Monitor Deployment

1. Click **Get Deployment by ID**
2. Click **Send**
3. Check `Status` field:
   - `queued` - Waiting in queue
   - `inProgress` - Currently deploying
   - `success` - Completed successfully
   - `failed` - Deployment failed

## 📋 Request Organization

### 1. Health & Info (2 requests)

- ✅ **Health Check** - Verify server is running
- ✅ **API Information** - Get API version and endpoints

### 2. Authentication (6 requests)

- ✅ **Register Admin User** - Create admin account
- ✅ **Register Developer User** - Create developer account
- ✅ **Login** - Authenticate with credentials
- ✅ **Get Profile** - Retrieve current user info
- ✅ **Refresh Token** - Renew access token
- ✅ **Change Password** - Update user password

### 3. Projects (10 requests)

- ✅ **Get All Projects** - List all active projects
- ✅ **Get All Projects (Include Inactive)** - List all projects
- ✅ **Create Project - Simple** - Create with basic config
- ✅ **Create Project - Full Config** - Create with notifications
- ✅ **Get Project by ID** - Retrieve specific project
- ✅ **Get Project by Name** - Retrieve by project name
- ✅ **Update Project** - Modify project settings
- ✅ **Get Project Statistics** - View deployment stats
- ✅ **Regenerate Webhook Secret** - Generate new secret
- ✅ **Delete Project** - Soft delete project

### 4. Deployments (10 requests)

- ✅ **Get Deployment by ID** - View deployment details
- ✅ **Get Project Deployments** - List project deployments
- ✅ **Create Manual Deployment** - Trigger deployment
- ✅ **Cancel Deployment** - Cancel queued deployment
- ✅ **Retry Deployment** - Retry failed deployment
- ✅ **Get Deployment Statistics** - Overall stats
- ✅ **Get Project Deployment Statistics** - Project-specific stats
- ✅ **Get Queue Status** - View all queues
- ✅ **Get Project Queue Status** - View project queue
- ✅ **Cancel All Pending Deployments** - Clear project queue

### 5. Webhooks (2 requests)

- ✅ **Test Webhook** - Test webhook endpoint
- ✅ **GitHub Webhook (Simulated)** - Simulate GitHub push

## 🔐 Authentication

### How It Works

1. All requests use **Bearer Token** authentication
2. Token is stored in collection variable `{{access_token}}`
3. Auto-filled in **Authorization** header
4. Auto-saved when you login or register

### Manual Token Setup

If auto-save doesn't work:

1. Login or Register
2. Copy `AccessToken` from response
3. Go to Collection → Variables
4. Paste token in `access_token` value
5. Click **Save**

### Token Expiry

- Access tokens expire after 1 hour (by default)
- When you get `401 Unauthorized`:
  1. Use **Refresh Token** request
  2. Or use **Login** request again

## 📝 Request Examples

### Example 1: Create Full-Featured Project

Request: **Create Project - Full Config**

```json
{
  "Name": "production-app",
  "Description": "Production application",
  "RepoUrl": "https://github.com/myorg/production-app.git",
  "Config": {
    "Branch": "main",
    "AutoDeploy": true,
    "Environment": "production",
    "DeployOnPaths": ["src/**", "package.json"],
    "Pipeline": [
      {
        "Name": "Install Dependencies",
        "Command": "npm ci",
        "Timeout": 600000
      },
      {
        "Name": "Run Tests",
        "Command": "npm test",
        "RunIf": "{{Environment}} === 'production'"
      },
      {
        "Name": "Build",
        "Command": "npm run build"
      },
      {
        "Name": "Deploy",
        "Command": "pm2 restart ecosystem.config.js"
      }
    ],
    "Notifications": {
      "Discord": {
        "Enabled": true,
        "WebhookUrl": "https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN"
      },
      "Email": {
        "Enabled": true,
        "Host": "smtp.gmail.com",
        "Port": 587,
        "Secure": false,
        "User": "your-email@gmail.com",
        "Password": "your-app-password",
        "From": "Deploy Center <noreply@yourapp.com>",
        "To": ["team@yourapp.com"]
      }
    },
    "Url": "https://production-app.com"
  }
}
```

### Example 2: Trigger Deployment with Specific Commit

Request: **Create Manual Deployment**

```json
{
  "Branch": "main",
  "CommitHash": "a1b2c3d4e5f6",
  "CommitMessage": "Deploy version 2.5.0"
}
```

### Example 3: Get Deployments with Pagination

Request: **Get Project Deployments**

URL: `{{base_url}}/api/deployments/projects/{{project_id}}/deployments?limit=20&offset=0`

- `limit=20` - Get 20 deployments per page
- `offset=0` - Start from first deployment
- `offset=20` - Start from 21st deployment (page 2)

## 🧪 Testing Workflows

### Workflow 1: Complete Setup Test

1. ✅ Health Check
2. ✅ Register Admin User (saves token)
3. ✅ Get Profile (verify token works)
4. ✅ Create Project - Simple (saves project_id)
5. ✅ Get Project by ID (verify creation)
6. ✅ Create Manual Deployment (saves deployment_id)
7. ✅ Get Deployment by ID (check status)

### Workflow 2: Project Management

1. ✅ Get All Projects
2. ✅ Create Project - Full Config
3. ✅ Get Project Statistics
4. ✅ Update Project
5. ✅ Regenerate Webhook Secret

### Workflow 3: Deployment Monitoring

1. ✅ Get Queue Status
2. ✅ Get Project Queue Status
3. ✅ Get Project Deployments
4. ✅ Get Deployment Statistics

### Workflow 4: Error Handling

1. ✅ Create Manual Deployment
2. ✅ Wait for failure (if configured to fail)
3. ✅ Get Deployment by ID (check error message)
4. ✅ Retry Deployment

## 🐛 Troubleshooting

### Issue: 401 Unauthorized

**Cause:** Token expired or not set

**Solution:**

1. Check if `access_token` variable is set
2. Login again to get new token
3. Or use **Refresh Token** request

### Issue: 404 Not Found

**Cause:** Resource doesn't exist or wrong ID

**Solution:**

1. Verify `project_id` or `deployment_id` in variables
2. Check if resource was created successfully
3. Use **Get All Projects** to find correct ID

### Issue: 403 Forbidden

**Cause:** Insufficient permissions

**Solution:**

1. Check user role (admin, developer, viewer)
2. Use admin account for admin-only endpoints
3. Verify in **Get Profile** response

### Issue: 400 Bad Request

**Cause:** Invalid request body or missing fields

**Solution:**

1. Check request body format (valid JSON)
2. Verify required fields are present
3. Check field names match API expectations (PascalCase)

### Issue: 429 Too Many Requests

**Cause:** Rate limit exceeded

**Solution:**

1. Wait a few minutes
2. Reduce request frequency
3. Check rate limits in documentation

### Issue: Variables Not Auto-Saving

**Cause:** Test scripts may not be running

**Solution:**

1. Enable test scripts in Postman settings
2. Manually copy tokens to variables
3. Check Postman console for errors

## 💡 Pro Tips

### 1. Use Postman Console

View detailed request/response info:

1. Click **Console** button (bottom left)
2. See all requests, headers, and responses
3. Debug test script execution

### 2. Save Responses as Examples

Save successful responses as examples:

1. Send request
2. Click **Save as Example**
3. Named examples appear under request
4. Great for documentation

### 3. Use Pre-request Scripts

Auto-generate data:

1. Go to request **Pre-request Script** tab
2. Add script:

```javascript
pm.collectionVariables.set('timestamp', Date.now());
```

3. Use in request: `{{timestamp}}`

### 4. Chain Requests

Test complete workflows:

1. Create **Collection Runner**
2. Select requests to run
3. Set iterations
4. Run automated tests

### 5. Export Environment

Share configuration with team:

1. Click **Environments**
2. Click **...** next to environment
3. Click **Export**
4. Share JSON file

## 📊 Response Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no response body |
| 400 | Bad Request | Check request body and parameters |
| 401 | Unauthorized | Login or refresh token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Wait and retry |
| 500 | Server Error | Check server logs |

## 🔗 Related Documentation

- [README.md](README.md) - Main documentation
- [QUICK_START.md](QUICK_START.md) - Quick start guide
- [INSTALLATION.md](INSTALLATION.md) - Installation instructions
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Architecture details

## 📧 Support

If you encounter issues:

1. Check Postman Console for errors
2. Verify server is running (`/health` endpoint)
3. Check server logs in `logs/` directory
4. Review this guide for common issues
5. Open GitHub issue with request/response details

---

Happy Testing! 🚀
