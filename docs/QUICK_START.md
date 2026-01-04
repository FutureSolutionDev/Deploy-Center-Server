# Quick Start Guide - Deploy Center

This guide will help you get Deploy Center up and running in minutes.

## Prerequisites

- Node.js 18+ installed
- MariaDB 10.6+ installed and running
- Git installed

## Step 1: Database Setup

Create a new MariaDB database:

```sql
CREATE DATABASE deploy_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'deploy_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON deploy_center.* TO 'deploy_user'@'localhost';
FLUSH PRIVILEGES;
```

## Step 2: Install Dependencies

```bash
cd Deploy-Center-Server
npm install
```

## Step 3: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update these important values:

```env
# Database (REQUIRED)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=deploy_center
DB_USER=deploy_user
DB_PASSWORD=your_password

# JWT Secrets (REQUIRED - Change these!)
JWT_SECRET=change-this-to-a-random-secret-key
JWT_REFRESH_SECRET=change-this-to-another-random-secret

# Encryption Key (REQUIRED - 32 characters)
ENCRYPTION_KEY=change-to-32-character-key-here
```

## Step 4: Start the Server

Development mode (with hot reload):

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Step 5: Create First User

Use an API client (Postman, curl, etc.) to register:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "Username": "admin",
    "Email": "admin@example.com",
    "Password": "Admin@123",
    "Role": "admin"
  }'
```

Response will include your access token:

```json
{
  "Success": true,
  "Message": "User registered successfully",
  "Data": {
    "User": { ... },
    "Tokens": {
      "AccessToken": "eyJhbG...",
      "RefreshToken": "eyJhbG..."
    }
  }
}
```

## Step 6: Create Your First Project

Using the access token from registration:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "Name": "my-app",
    "Description": "My awesome application",
    "RepoUrl": "https://github.com/username/my-app.git",
    "Config": {
      "Branch": "main",
      "AutoDeploy": true,
      "Environment": "production",
      "Pipeline": [
        {
          "Name": "Install Dependencies",
          "Command": "npm install"
        },
        {
          "Name": "Build",
          "Command": "npm run build"
        },
        {
          "Name": "Deploy",
          "Command": "pm2 restart my-app"
        }
      ]
    }
  }'
```

Response includes webhook secret:

```json
{
  "Success": true,
  "Data": {
    "Project": {
      "Id": 1,
      "Name": "my-app",
      "WebhookSecret": "abc123...",
      ...
    }
  }
}
```

## Step 7: Setup GitHub Webhook

1. Go to your GitHub repository
2. Settings → Webhooks → Add webhook
3. Payload URL: `http://your-server.com/webhook/github/my-app`
4. Content type: `application/json`
5. Secret: Use the `WebhookSecret` from project creation
6. Events: Select "Just the push event"
7. Click "Add webhook"

## Step 8: Test Deployment

Push to your repository's main branch, and the deployment will trigger automatically!

Monitor deployment:

```bash
curl -X GET http://localhost:3000/api/projects/1/deployments \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Common API Endpoints

### Authentication

- Register: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Profile: `GET /api/auth/profile`

### Projects

- List all: `GET /api/projects`
- Create: `POST /api/projects`
- Update: `PUT /api/projects/:id`
- Statistics: `GET /api/projects/:id/statistics`

### Deployments

- Get deployment: `GET /api/deployments/:id`
- Project deployments: `GET /api/deployments/projects/:projectId/deployments`
- Manual deploy: `POST /api/deployments/projects/:projectId/deploy`
- Queue status: `GET /api/deployments/queue/status`

### Health Check

- `GET /health`

## Environment Variables Reference

### Required

- `DB_HOST` - Database host
- `DB_PORT` - Database port (3306)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `ENCRYPTION_KEY` - Encryption key (32 chars)

### Optional

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `CORS_ORIGINS` - Allowed origins
- `DEPLOYMENTS_PATH` - Path for deployments
- `LOGS_PATH` - Path for logs

## Production Deployment

1. Build the project:

```bash
npm run build
```

2. Use PM2 for process management:

```bash
npm install -g pm2
pm2 start dist/index.js --name deploy-center
pm2 save
pm2 startup
```

3. Use nginx as reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Database Connection Error

- Verify MariaDB is running: `systemctl status mariadb`
- Test connection: `mysql -u deploy_user -p`
- Check `.env` credentials

### Port Already in Use

- Change `PORT` in `.env`
- Or kill process: `lsof -ti:3000 | xargs kill`

### Webhook Not Working

- Test webhook: `GET /webhook/test/your-project-name`
- Verify webhook secret matches
- Check GitHub webhook deliveries
- Review logs: `tail -f logs/combined-*.log`

## Next Steps

- Configure notifications (Discord, Slack, Email)
- Set up SSL certificate for webhooks
- Configure deployment pipeline for your needs
- Add more projects
- Set up monitoring and alerts

## Support

For detailed documentation, see [README.md](README.md)

For issues, check the logs in `logs/` directory or review the troubleshooting section.
