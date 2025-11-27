# Deploy Center - Deployment Platform Server

Complete deployment automation platform with CI/CD integration, built with TypeScript, Express, and MariaDB.

## Links

- [GitHub Repository](https://github.com/FutureSolutionDev/Deploy-Center-Server)
- [Deploy Center Client](https://github.com/FutureSolutionDev/Deploy-Center-Client)

## Insights

![GitHub issues](https://img.shields.io/github/issues/FutureSolutionDev/Deploy-Center-Server)
![GitHub pull requests](https://img.shields.io/github/issues-pr/FutureSolutionDev/Deploy-Center-Server)
![GitHub stars](https://img.shields.io/github/stars/FutureSolutionDev/Deploy-Center-Server?style=social)
![GitHub forks](https://img.shields.io/github/forks/FutureSolutionDev/Deploy-Center-Server?style=social)

## 📚 Documentation

- **[SUMMARY](./docs/SUMMARY.md)** - Quick overview
- **[Quick Start Guide](./docs/QUICK_START.md)** - Get started in minutes
- **[Installation Guide](./docs/INSTALLATION.md)** - Detailed installation instructions
- **[Postman Collection](./docs/POSTMAN_COLLECTION.json)** - API testing collection
- **[Postman Guide](./docs/POSTMAN_GUIDE.md)** - How to use Postman collection
- **[Project Structure](./docs/PROJECT_STRUCTURE.md)** - Architecture and code organization
- **[Changelog](./docs/CHANGELOG.md)** - Version history and changes

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (Admin, Developer, Viewer)
  - Password security with bcrypt
  - Token refresh mechanism

- **Project Management**
  - Multiple project support
  - GitHub webhook integration
  - Automated deployments
  - Manual deployment triggers

- **Deployment Pipeline**
  - Custom pipeline configurations
  - Variable substitution
  - Conditional step execution
  - Real-time deployment tracking

- **Queue Management**
  - Prevents concurrent deployments
  - Priority-based queue
  - Project-specific queues
  - Queue status monitoring

- **Notifications**
  - Discord notifications
  - Slack integration
  - Email alerts
  - Telegram support

- **Monitoring & Logging**
  - Comprehensive logging with Winston
  - Daily log rotation
  - Deployment statistics
  - Audit trail

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MariaDB >= 10.6

## 🛠️ Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd deploy-center/server
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Server
NODE_ENV=development
PORT=3000

  # Database
  DB_HOST=localhost
  DB_PORT=3306
  DB_NAME=deploy_center
  DB_USER=root
  DB_PASSWORD=your_password
  DB_DIALECT=mariadb
  DB_AUTO_MIGRATE=true

  # Default Admin (auto-created if no active admins exist)
  DEFAULT_ADMIN_USERNAME=admin
  DEFAULT_ADMIN_EMAIL=admin@example.com
  DEFAULT_ADMIN_PASSWORD=changeme

  # JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRY=1h
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
JWT_REFRESH_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Paths
DEPLOYMENTS_PATH=./deployments
LOGS_PATH=./logs
```

4. **Start development server**

```bash
npm run dev
```

## 📜 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run start:prod` - Start production server with NODE_ENV=production
- `npm test` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting errors
- `npm run format` - Format code with Prettier

## 🏗️ Project Structure

```
server/
├── src/
│   ├── Config/          # Configuration management
│   │   └── AppConfig.ts
│   ├── Controllers/     # HTTP request handlers
│   │   ├── AuthController.ts
│   │   ├── ProjectController.ts
│   │   ├── DeploymentController.ts
│   │   └── WebhookController.ts
│   ├── Database/        # Database connection
│   │   └── DatabaseConnection.ts
│   ├── Middleware/      # Express middlewares
│   │   ├── AuthMiddleware.ts
│   │   ├── RoleMiddleware.ts
│   │   ├── ValidationMiddleware.ts
│   │   ├── RateLimiterMiddleware.ts
│   │   ├── ErrorHandlerMiddleware.ts
│   │   └── RequestLoggerMiddleware.ts
│   ├── Models/          # Sequelize models
│   │   ├── User.ts
│   │   ├── Project.ts
│   │   ├── Deployment.ts
│   │   ├── DeploymentStep.ts
│   │   ├── AuditLog.ts
│   │   └── index.ts
│   ├── Routes/          # API routes
│   │   ├── AuthRoutes.ts
│   │   ├── ProjectRoutes.ts
│   │   ├── DeploymentRoutes.ts
│   │   ├── WebhookRoutes.ts
│   │   └── index.ts
│   ├── Services/        # Business logic
│   │   ├── AuthService.ts
│   │   ├── ProjectService.ts
│   │   ├── DeploymentService.ts
│   │   ├── PipelineService.ts
│   │   ├── QueueService.ts
│   │   ├── NotificationService.ts
│   │   └── WebhookService.ts
│   ├── Types/           # TypeScript types
│   │   ├── ICommon.ts
│   │   └── IDatabase.ts
│   ├── Utils/           # Utility functions
│   │   ├── Logger.ts
│   │   ├── PasswordHelper.ts
│   │   ├── EncryptionHelper.ts
│   │   └── ResponseHelper.ts
│   ├── App.ts           # Express app setup
│   ├── Server.ts        # Server initialization
│   └── index.ts         # Entry point
├── .env.example         # Environment variables template
├── .eslintrc.json       # ESLint configuration
├── .prettierrc.json     # Prettier configuration
├── jest.config.js       # Jest configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## 🔑 API Endpoints

### Authentication

```markdown
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/change-password` - Change password
```

### Projects

```markdown
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get project by ID
- `GET /api/projects/name/:name` - Get project by name
- `POST /api/projects` - Create project (Admin)
- `PUT /api/projects/:id` - Update project (Admin)
- `DELETE /api/projects/:id` - Delete project (Admin)
- `POST /api/projects/:id/regenerate-webhook` - Regenerate webhook secret (Admin)
- `GET /api/projects/:id/statistics` - Get project statistics
```

### Deployments

```markdown
- `GET /api/deployments/:id` - Get deployment by ID
- `GET /api/deployments/statistics` - Get deployment statistics
- `GET /api/deployments/queue/status` - Get queue status
- `POST /api/deployments/:id/cancel` - Cancel deployment
- `POST /api/deployments/:id/retry` - Retry failed deployment
- `GET /api/deployments/projects/:projectId/deployments` - Get project deployments
- `POST /api/deployments/projects/:projectId/deploy` - Create manual deployment
- `GET /api/deployments/projects/:projectId/queue/status` - Get project queue status
- `POST /api/deployments/projects/:projectId/queue/cancel-all` - Cancel all pending (Admin)
```

### Webhooks

```markdown
- `POST /webhook/github/:projectName` - GitHub webhook endpoint
- `POST /webhook/test/:projectName` - Test webhook endpoint
```

### Health

```markdown
- `GET /health` - Health check endpoint
- `GET /` - API information
```

## 🔐 Authentication

All protected endpoints require a Bearer token in the Authorization header:

Moved To Cookies

> ~~Authorization: Bearer <access_token>~~

## 👥 User Roles

- **Admin** - Full access to all features
- **Developer** - Can view projects and trigger deployments
- **Viewer** - Read-only access

### Administrator Access Recovery

- The server ensures at least one administrator remains active each time it starts.
- If every admin is disabled, the oldest admin user is automatically reactivated to avoid lockouts.
- When a disabled admin is restored and DEFAULT_ADMIN_PASSWORD is set, the password is reset to that value so you can log in immediately (change it afterward).
- If no admin users exist, a new account is created using the DEFAULT_ADMIN_* environment variables—update those values and change the default password immediately after bootstrapping.

## 🎯 Pipeline Configuration

Example project configuration:

```json
{
  "Branch": "main",
  "Environment": "production",
  "AutoDeploy": true,
  "DeployOnPaths": ["src/**", "package.json"],
  "Pipeline": [
    {
      "Name": "Install Dependencies",
      "Command": "npm install",
      "WorkingDirectory": ".",
      "Timeout": 300000
    },
    {
      "Name": "Build Project",
      "Command": "npm run build",
      "WorkingDirectory": ".",
      "RunIf": "{{Environment}} === 'production'"
    },
    {
      "Name": "Run Tests",
      "Command": "npm test",
      "ContinueOnError": false
    },
    {
      "Name": "Deploy to Server",
      "Command": "pm2 restart ecosystem.config.js",
      "WorkingDirectory": "."
    }
  ],
  "Notifications": {
    "Discord": {
      "Enabled": true,
      "WebhookUrl": "https://discord.com/api/webhooks/..."
    },
    "Slack": {
      "Enabled": false,
      "WebhookUrl": ""
    },
    "Email": {
      "Enabled": true,
      "To": ["developer@example.com"]
    }
  },
  "Url": "https://myapp.example.com"
}
```

## 🔔 Webhook Setup

1. **Get Webhook URL**
   - Format: `https://your-deploy-center.com/webhook/github/:projectName`
   - Example: `https://deploy.example.com/webhook/github/my-project`

2. **Configure GitHub Webhook**
   - Go to repository Settings → Webhooks → Add webhook
   - Payload URL: Your webhook URL
   - Content type: `application/json`
   - Secret: Your project's webhook secret (from Deploy Center)
   - Events: Select "Just the push event"

3. **Test Webhook**
   - Push to your configured branch
   - Check deployment in Deploy Center

## 🐛 Troubleshooting

### Database Connection Failed

- Verify MariaDB is running
- Check credentials in `.env`
- Ensure database exists

### Missing Tables or `ER_NO_SUCH_TABLE`

- Keep `DB_AUTO_MIGRATE=true` during local development to let the server create tables automatically
- In production environments that rely on migrations, either run your migration scripts before starting the server or temporarily enable `DB_AUTO_MIGRATE`
- The server will now verify the schema at startup and stop with a descriptive error if required tables are missing

### Deployment Stuck in Queue

- Check logs in `logs/` directory
- Verify no other deployment is running for the same project
- Check queue status via API

### Admin Login Shows "User account is disabled"

- The server reactivates the oldest admin automatically, so restart the service to recover access.
- If `DEFAULT_ADMIN_PASSWORD` is set, the recovered admin password is reset to that value so you can log in right away.
- Make sure the `DEFAULT_ADMIN_*` environment variables are set to known credentials so a fallback admin can be created when none exist.
- If you intentionally disabled all admins for security reasons, re-enable at least one account directly in the database to avoid the automatic recovery.

### Webhook Not Triggering

- Verify webhook signature in GitHub
- Check webhook secret matches
- Review webhook logs
- Test with `/webhook/test/:projectName`

## 📊 Logging

Logs are stored in the `logs/` directory:

- `combined-%DATE%.log` - All logs
- `error-%DATE%.log` - Error logs only
- `deployment-%DATE%.log` - Deployment-specific logs

## 🔒 Security Features

- Helmet.js for security headers
- Rate limiting on all endpoints
- CORS configuration
- JWT token authentication
- bcrypt password hashing
- AES-256-GCM encryption for sensitive data
- HMAC webhook signature verification

## 🚀 Production Deployment

1. **Build the project**

```bash
npm run build
```

2. **Set environment to production**

```bash
export NODE_ENV=production
```

3. **Start the server**

```bash
npm run start:prod
```

Or use PM2:

```bash
pm2 start dist/index.js --name deploy-center-server
```

## 👨‍💻 Development

**Coding Standards:**

- PascalCase for classes, interfaces, types, enums
- TypeScript strict mode
- ESLint + Prettier for code quality
- SOLID principles
- Comprehensive error handling
- Detailed logging

**Testing: (Not yet implemented)**

- Unit tests for services
- Integration tests for API endpoints
- Run tests with `npm test`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📧 Support

For issues and questions, please open an issue on GitHub.

## Contact

- [Phone](tel:201015471713)
- [Whatsapp](https://wa.me/201148371185)
- [FaceBook](https://www.facebook.com/futuresolutionsdev)
- [Website](https://futuresolutionsdev.com)

## 📝 License

Personal Use License

Copyright (c) 2025 [FutureSolutionDev](https://futuresolutionsdev.com)

Permission is hereby granted to any individual to use, copy, and modify
this software for personal, non-commercial use only.

Restrictions:

- The software may NOT be used for commercial purposes.
- The software may NOT be sold, licensed, sublicensed, or distributed
  for profit.
- The software may NOT be integrated into any project intended for
  commercial use.
- Redistribution in any form (modified or unmodified) is NOT permitted
  without explicit written permission from the author.

The software is provided "as is", without warranty of any kind, express
or implied. In no event shall the author be liable for any claim,
damages, or other liability arising from the use of this software.

By using this software, you agree to the above terms.

## 🌟 Star this repository on GitHub

If you find this project helpful, consider giving it a star on GitHub!

## 🎉 Made with ❤️ by [FutureSolutionDev](https://futuresolutionsdev.com) Team
