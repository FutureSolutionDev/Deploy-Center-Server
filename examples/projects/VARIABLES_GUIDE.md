# 📚 Pipeline Variables Guide

## Available Variables in Deploy Center

### 🔹 Automatic Variables (Always Available)

These variables are automatically populated by the system:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{{RepoName}}` | Repository name | `Deploy-Center-Server` |
| `{{Branch}}` | Git branch name | `master` or `main` |
| `{{Commit}}` | Full commit hash | `9a544a0...` |
| `{{CommitHash}}` | Same as Commit | `9a544a0...` |
| `{{CommitMessage}}` | Commit message text | `feat: Add auto-recovery` |
| `{{Author}}` | Commit author | `John Doe` |
| `{{ProjectName}}` | Project name | `My Backend API` |
| `{{ProjectId}}` | Project database ID | `1` |
| `{{DeploymentId}}` | Deployment ID | `42` |
| `{{Environment}}` | Environment name | `production` or `staging` |
| `{{WorkingDirectory}}` | Temporary deploy directory | `/www/wwwroot/DeployCenter/deployments/project-1/deployment-42` |
| `{{ProjectPath}}` | Project's target path | `/www/wwwroot/my-app` |
| `{{TargetPath}}` | Same as ProjectPath | `/www/wwwroot/my-app` |
| `{{RepoUrl}}` | Git repository URL | `https://github.com/user/repo.git` |

### 🔹 Custom Variables (From Config.Variables)

You can define any custom variables in your project's `Config.Variables`:

```json
{
  "Config": {
    "Variables": {
      "BuildCommand": "npm run build",
      "BuildOutput": "dist",
      "PM2ProcessName": "my-backend",
      "BackendPath": "/www/wwwroot/my-app/server",
      "FrontendPath": "/var/www/html/my-app",
      "NodeVersion": "18",
      "Port": "3000"
    }
  }
}
```

Then use them in pipeline:

```json
{
  "Pipeline": [
    {
      "Name": "Build Project",
      "Run": [
        "cd {{WorkingDirectory}}",
        "{{BuildCommand}}"
      ]
    },
    {
      "Name": "Deploy Built Files",
      "Run": [
        "rsync -av {{WorkingDirectory}}/{{BuildOutput}}/ {{FrontendPath}}/"
      ]
    },
    {
      "Name": "Restart Backend",
      "Run": [
        "pm2 reload {{PM2ProcessName}}"
      ]
    }
  ]
}
```

## 📦 Common Variable Patterns

### Node.js Backend:

```json
{
  "Variables": {
    "PM2ProcessName": "my-api",
    "BuildCommand": "npm run build",
    "MigrateCommand": "npm run migrate:up",
    "TestCommand": "npm test"
  }
}
```

### React/Vue Frontend:

```json
{
  "Variables": {
    "BuildCommand": "npm run build",
    "BuildOutput": "dist",
    "TargetPath": "/var/www/html/my-app",
    "NginxConfigPath": "/etc/nginx/sites-available/my-app"
  }
}
```

### Full Stack (Backend + Frontend):

```json
{
  "Variables": {
    "BackendPath": "/www/wwwroot/my-app/server",
    "FrontendPath": "/var/www/html/my-app",
    "BackendPM2": "my-app-backend",
    "BackendBuildCmd": "npm run build",
    "FrontendBuildCmd": "npm run build",
    "FrontendBuildOutput": "dist"
  }
}
```

## 🎯 Real-World Examples

### Example 1: Simple Node.js Backend

```json
{
  "Name": "My API",
  "Config": {
    "Variables": {
      "PM2ProcessName": "my-api"
    },
    "Pipeline": [
      {
        "Name": "Install Dependencies",
        "Run": ["cd {{WorkingDirectory}}", "npm ci"]
      },
      {
        "Name": "Build TypeScript",
        "Run": ["cd {{WorkingDirectory}}", "npm run build"]
      },
      {
        "Name": "Restart PM2",
        "Run": ["pm2 reload {{PM2ProcessName}}"]
      }
    ]
  }
}
```

### Example 2: React Frontend

```json
{
  "Name": "My Website",
  "Config": {
    "Variables": {
      "BuildOutput": "build",
      "WebRoot": "/var/www/html/mysite"
    },
    "Pipeline": [
      {
        "Name": "Install Dependencies",
        "Run": ["cd {{WorkingDirectory}}", "npm ci"]
      },
      {
        "Name": "Build Production Bundle",
        "Run": ["cd {{WorkingDirectory}}", "npm run build"]
      },
      {
        "Name": "Deploy to Web Root",
        "Run": [
          "rsync -av --delete {{WorkingDirectory}}/{{BuildOutput}}/ {{WebRoot}}/"
        ]
      }
    ]
  }
}
```

### Example 3: Full Stack with Database

```json
{
  "Name": "Full Stack App",
  "Config": {
    "Variables": {
      "BackendPath": "/www/wwwroot/myapp/server",
      "BackendPM2": "myapp-api",
      "FrontendOutput": "dist",
      "WebRoot": "/var/www/html/myapp"
    },
    "Pipeline": [
      {
        "Name": "Install Backend Dependencies",
        "Run": ["cd {{WorkingDirectory}}/server", "npm ci"]
      },
      {
        "Name": "Run Database Migrations",
        "Run": ["cd {{WorkingDirectory}}/server", "npm run migrate:up"]
      },
      {
        "Name": "Build Backend",
        "Run": ["cd {{WorkingDirectory}}/server", "npm run build"]
      },
      {
        "Name": "Install Frontend Dependencies",
        "Run": ["cd {{WorkingDirectory}}/client", "npm ci"]
      },
      {
        "Name": "Build Frontend",
        "Run": ["cd {{WorkingDirectory}}/client", "npm run build"]
      },
      {
        "Name": "Deploy Frontend",
        "Run": [
          "rsync -av --delete {{WorkingDirectory}}/client/{{FrontendOutput}}/ {{WebRoot}}/"
        ]
      },
      {
        "Name": "Restart Backend",
        "Run": ["pm2 reload {{BackendPM2}}"]
      }
    ]
  }
}
```

## ❗ Important Notes

1. **All variables must be defined**: If you use `{{BuildCommand}}` in pipeline, you MUST define it in `Config.Variables` or it will remain as literal `{{BuildCommand}}` text.

2. **Variable names are case-sensitive**: `{{buildCommand}}` ≠ `{{BuildCommand}}`

3. **No spaces in variable names**: Use `{{MyVar}}` not `{{ MyVar }}`

4. **String replacement only**: Variables are simple string replacement. They don't support expressions like `{{Port + 1}}`.

## 🐛 Troubleshooting

**Problem**: Command shows `{{BuildCommand}}: command not found`

**Solution**: You forgot to define `BuildCommand` in `Config.Variables`. Add it:

```json
{
  "Config": {
    "Variables": {
      "BuildCommand": "npm run build"
    }
  }
}
```

**Problem**: Variable not being replaced

**Solution**: Check spelling and case. Make sure variable exists in `Config.Variables` or is an automatic variable.
