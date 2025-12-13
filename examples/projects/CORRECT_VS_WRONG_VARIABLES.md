# المتغيرات الصحيحة vs الخاطئة في Deploy Center

## ❌ الطريقة الخاطئة (تسبب الخطأ: command not found)

```json
{
  "Config": {
    "Pipeline": [
      {
        "Name": "Build Project",
        "Run": [
          "cd {{WorkingDirectory}}",
          "{{BuildCommand}}"
        ]
      }
    ]
  }
}
```

**المشكلة**: استخدمت `{{BuildCommand}}` لكن لم تعرّفه في `Config.Variables` ❌

**النتيجة**:
```
/bin/bash: line 3: {{BuildCommand}}: command not found
```

---

## ✅ الطريقة الصحيحة

```json
{
  "Config": {
    "Variables": {
      "BuildCommand": "npm run build"
    },
    "Pipeline": [
      {
        "Name": "Build Project",
        "Run": [
          "cd {{WorkingDirectory}}",
          "{{BuildCommand}}"
        ]
      }
    ]
  }
}
```

**الحل**: عرّفت `BuildCommand` في `Config.Variables` أولاً ✅

**النتيجة**:
```
cd /www/wwwroot/DeployCenter/deployments/project-1/deployment-42
npm run build
```

---

## المتغيرات المتاحة بدون تعريف (Automatic Variables)

هذه المتغيرات **لا تحتاج** تعريفها في `Config.Variables`:

| المتغير | القيمة | مثال |
|---------|--------|------|
| `{{RepoName}}` | اسم الـ Repository | `Deploy-Center-Server` |
| `{{Branch}}` | اسم الـ Branch | `main` أو `master` |
| `{{Commit}}` | الـ Commit Hash | `9a544a0...` |
| `{{CommitHash}}` | نفس الـ Commit | `9a544a0...` |
| `{{CommitMessage}}` | رسالة الـ Commit | `feat: Add auto-recovery` |
| `{{Author}}` | صاحب الـ Commit | `John Doe` |
| `{{ProjectName}}` | اسم المشروع | `My Backend API` |
| `{{ProjectId}}` | معرّف المشروع | `1` |
| `{{DeploymentId}}` | معرّف الـ Deployment | `42` |
| `{{Environment}}` | البيئة | `production` أو `staging` |
| `{{WorkingDirectory}}` | مجلد الـ Deployment المؤقت | `/www/wwwroot/DeployCenter/deployments/project-1/deployment-42` |
| `{{ProjectPath}}` | مسار المشروع النهائي | `/www/wwwroot/my-app` |
| `{{TargetPath}}` | نفس `ProjectPath` | `/www/wwwroot/my-app` |
| `{{RepoUrl}}` | رابط الـ Repository | `https://github.com/user/repo.git` |

**استخدامها بدون تعريف:**

```json
{
  "Pipeline": [
    {
      "Name": "Pull Code",
      "Run": [
        "cd {{ProjectPath}}",
        "git pull origin {{Branch}}"
      ]
    }
  ]
}
```

---

## المتغيرات المخصصة (Custom Variables)

هذه المتغيرات **يجب** تعريفها في `Config.Variables`:

### مثال 1: Node.js Backend

```json
{
  "Config": {
    "Variables": {
      "PM2ProcessName": "my-backend-api",
      "BuildCommand": "npm run build",
      "MigrateCommand": "npm run migrate:up",
      "TestCommand": "npm test"
    },
    "Pipeline": [
      {
        "Name": "Install Dependencies",
        "Run": ["cd {{WorkingDirectory}}", "npm ci"]
      },
      {
        "Name": "Build TypeScript",
        "Run": ["cd {{WorkingDirectory}}", "{{BuildCommand}}"]
      },
      {
        "Name": "Run Migrations",
        "Run": ["cd {{WorkingDirectory}}", "{{MigrateCommand}}"]
      },
      {
        "Name": "Restart PM2",
        "Run": ["pm2 reload {{PM2ProcessName}}"]
      }
    ]
  }
}
```

### مثال 2: React Frontend

```json
{
  "Config": {
    "Variables": {
      "BuildCommand": "npm run build",
      "BuildOutput": "dist",
      "WebRoot": "/var/www/html/mysite",
      "NginxConfig": "/etc/nginx/sites-available/mysite"
    },
    "Pipeline": [
      {
        "Name": "Install Dependencies",
        "Run": ["cd {{WorkingDirectory}}", "npm ci"]
      },
      {
        "Name": "Build Production Bundle",
        "Run": ["cd {{WorkingDirectory}}", "{{BuildCommand}}"]
      },
      {
        "Name": "Deploy to Web Root",
        "Run": [
          "rsync -av --delete {{WorkingDirectory}}/{{BuildOutput}}/ {{WebRoot}}/"
        ]
      },
      {
        "Name": "Reload Nginx",
        "Run": ["sudo nginx -s reload"]
      }
    ]
  }
}
```

### مثال 3: Full Stack (Backend + Frontend)

```json
{
  "Config": {
    "Variables": {
      "BackendPath": "/www/wwwroot/myapp/server",
      "FrontendPath": "/var/www/html/myapp",
      "BackendPM2": "myapp-api",
      "BackendBuildCmd": "npm run build",
      "FrontendBuildCmd": "npm run build",
      "FrontendBuildOutput": "dist"
    },
    "Pipeline": [
      {
        "Name": "Install Backend Dependencies",
        "Run": ["cd {{WorkingDirectory}}/server", "npm ci"]
      },
      {
        "Name": "Build Backend",
        "Run": ["cd {{WorkingDirectory}}/server", "{{BackendBuildCmd}}"]
      },
      {
        "Name": "Install Frontend Dependencies",
        "Run": ["cd {{WorkingDirectory}}/client", "npm ci"]
      },
      {
        "Name": "Build Frontend",
        "Run": ["cd {{WorkingDirectory}}/client", "{{FrontendBuildCmd}}"]
      },
      {
        "Name": "Deploy Frontend",
        "Run": [
          "rsync -av --delete {{WorkingDirectory}}/client/{{FrontendBuildOutput}}/ {{FrontendPath}}/"
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

---

## أخطاء شائعة

### ❌ خطأ 1: استخدام متغير غير معرّف

```json
{
  "Pipeline": [
    {
      "Name": "Build",
      "Run": ["{{BuildCommand}}"]
    }
  ]
}
```

**الحل**: أضف المتغير في `Config.Variables`:

```json
{
  "Variables": {
    "BuildCommand": "npm run build"
  }
}
```

### ❌ خطأ 2: حساسية الحروف (Case-Sensitive)

```json
{
  "Variables": {
    "buildCommand": "npm run build"
  },
  "Pipeline": [
    {
      "Run": ["{{BuildCommand}}"]
    }
  ]
}
```

**المشكلة**: `buildCommand` ≠ `BuildCommand`

**الحل**: استخدم نفس الاسم بالضبط:

```json
{
  "Variables": {
    "BuildCommand": "npm run build"
  },
  "Pipeline": [
    {
      "Run": ["{{BuildCommand}}"]
    }
  ]
}
```

### ❌ خطأ 3: مسافات في اسم المتغير

```json
{
  "Variables": {
    "Build Command": "npm run build"
  },
  "Pipeline": [
    {
      "Run": ["{{ Build Command }}"]
    }
  ]
}
```

**المشكلة**: المسافات غير مسموحة

**الحل**: استخدم PascalCase أو camelCase:

```json
{
  "Variables": {
    "BuildCommand": "npm run build"
  },
  "Pipeline": [
    {
      "Run": ["{{BuildCommand}}"]
    }
  ]
}
```

---

## كيف يعمل نظام الاستبدال؟

```typescript
// في PipelineService.ts
private ReplaceVariables(str: string, context: IDeploymentContext): string {
  let result = str;
  const regex = /\{\{(\w+)\}\}/g;
  result = result.replace(regex, (match, key) => {
    // 1. يبحث عن المتغير في الـ context (automatic + custom variables)
    return context[key] !== undefined ? String(context[key]) : match;
  });
  return result;
}
```

**مثال:**

```
الأمر الأصلي: "cd {{WorkingDirectory}} && {{BuildCommand}}"
الـ Context: { WorkingDirectory: "/tmp/deploy-42", BuildCommand: "npm run build" }
النتيجة: "cd /tmp/deploy-42 && npm run build"
```

---

## نصائح للاستخدام الأمثل

1. ✅ **استخدم الـ Automatic Variables** بدون تعريف:
   ```json
   {
     "Run": ["cd {{WorkingDirectory}}", "git checkout {{Branch}}"]
   }
   ```

2. ✅ **عرّف Custom Variables** في `Config.Variables`:
   ```json
   {
     "Variables": {
       "PM2ProcessName": "my-app",
       "BuildCommand": "npm run build"
     }
   }
   ```

3. ✅ **استخدم أسماء واضحة** للمتغيرات:
   ```json
   {
     "Variables": {
       "BackendPath": "/www/wwwroot/app/server",
       "FrontendPath": "/var/www/html/app"
     }
   }
   ```

4. ✅ **اجمع الأوامر المتشابهة** في متغير واحد:
   ```json
   {
     "Variables": {
       "DeployCommand": "rsync -av --delete {{WorkingDirectory}}/dist/ {{TargetPath}}/"
     },
     "Pipeline": [
       {
         "Name": "Deploy",
         "Run": ["{{DeployCommand}}"]
       }
     ]
   }
   ```

---

## مراجعة سريعة

| السؤال | الجواب |
|--------|--------|
| `{{TargetPath}}` يشير إلى؟ | مسار المشروع النهائي (نفس `{{ProjectPath}}`) |
| `{{Environment}}` يشير إلى؟ | البيئة من `Config.Environment` (مثل `production` أو `staging`) |
| `{{BuildOutput}}` يشير إلى؟ | مجلد البناء من `Config.Variables.BuildOutput` (مثل `dist` أو `build`) |
| `{{Branch}}` يشير إلى؟ | اسم الـ Branch من `Config.Branch` (مثل `main` أو `master`) |
| `{{WorkingDirectory}}` يشير إلى؟ | المجلد المؤقت للـ Deployment الحالي |

**ملاحظة مهمة**:
- المتغيرات الأوتوماتيكية (`Branch`, `TargetPath`, `Environment`, إلخ) **لا تحتاج** تعريف
- المتغيرات المخصصة (`BuildOutput`, `BuildCommand`, `PM2ProcessName`, إلخ) **تحتاج** تعريف في `Config.Variables`
