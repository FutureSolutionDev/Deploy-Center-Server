# Contributing to Deploy Center

First off, **thank you** for considering contributing to Deploy Center! 🎉

It's people like you that make Deploy Center such a great tool for the community.

## 📋 **Table of Contents**

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Guidelines](#documentation-guidelines)
- [Community](#community)

---

## 📜 **Code of Conduct**

This project and everyone participating in it is governed by the [Deploy Center Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@futuresolutionsdev.com](mailto:conduct@futuresolutionsdev.com).

---

## 🤝 **How Can I Contribute?**

### **Reporting Bugs**

Before creating bug reports, please check the [existing issues](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues) to avoid duplicates.

When creating a bug report, please include:

- **Clear title** — Describe the issue in one line
- **Steps to reproduce** — Detailed steps to recreate the bug
- **Expected behavior** — What you expected to happen
- **Actual behavior** — What actually happened
- **Environment** — OS, Node.js version, database version
- **Logs** — Relevant error messages from logs
- **Screenshots** — If applicable

**Bug Report Template:**

```markdown
**Describe the bug:**
A clear description of what the bug is.

**To Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior:**
What you expected to happen.

**Screenshots:**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., Ubuntu 22.04]
- Node.js: [e.g., v18.17.0]
- Deploy Center version: [e.g., v2.0.0]
- Database: [e.g., MariaDB 10.11]

**Additional context:**
Any other context about the problem.
```

### **Suggesting Enhancements**

Enhancement suggestions are tracked as [GitHub issues](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).

When creating an enhancement suggestion, please include:

- **Clear title** — Describe the enhancement
- **Problem description** — What problem does this solve?
- **Proposed solution** — How would you implement it?
- **Alternative solutions** — Other approaches considered
- **Mockups/examples** — Visual aids if applicable

### **Your First Code Contribution**

Unsure where to begin? Look for issues labeled:

- `good first issue` — Simple issues for beginners
- `help wanted` — Issues where we need community help
- `documentation` — Documentation improvements

### **Pull Requests**

We actively welcome your pull requests!

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

---

## 🛠️ **Development Setup**

### **Prerequisites**

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- MariaDB ≥ 10.6
- Git ≥ 2.0

### **Setup Steps**

1. **Fork and clone**

```bash
git clone https://github.com/YOUR_USERNAME/Deploy-Center-Server.git
cd Deploy-Center-Server/server
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup database**

```sql
CREATE DATABASE deploy_center_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'deploy_dev'@'localhost' IDENTIFIED BY 'dev_password';
GRANT ALL PRIVILEGES ON deploy_center_dev.* TO 'deploy_dev'@'localhost';
FLUSH PRIVILEGES;
```

4. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env`:

```env
NODE_ENV=development
PORT=3000
DB_NAME=deploy_center_dev
DB_USER=deploy_dev
DB_PASSWORD=dev_password
# ... other settings
```

5. **Start development server**

```bash
npm run dev
```

Server runs at `http://localhost:3000`

### **Development Tools**

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Build for production
npm run build
```

---

## 💻 **Coding Standards**

### **TypeScript**

- ✅ Use TypeScript strict mode
- ✅ No `any` types (use `unknown` if necessary)
- ✅ Define interfaces for all data structures
- ✅ Use type guards for runtime type checking

**Example:**

```typescript
// ❌ Bad
function ProcessData(data: any) {
  return data.value;
}

// ✅ Good
interface IDataInput {
  Value: string;
  Timestamp: Date;
}

function ProcessData(data: IDataInput): string {
  return data.Value;
}
```

### **Naming Conventions**

Deploy Center enforces **PascalCase** naming via ESLint:

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `AuthService`, `UserController` |
| Interfaces | PascalCase + `I` prefix | `IUser`, `IApiResponse` |
| Types | PascalCase + `E` prefix (enums) | `EUserRole`, `EStatus` |
| Class Properties | PascalCase | `User.Id`, `Project.Name` |
| Class Methods | PascalCase | `GetAll()`, `CreateUser()` |
| Variables | camelCase | `const userId = 1` |
| Function Parameters | camelCase | `function login(username, password)` |
| Constants | UPPERCASE | `const MAX_RETRIES = 3` |
| Private Methods | camelCase + `private` | `private validateInput()` |

**Example:**

```typescript
// ✅ Correct
export interface IUser {
  Id: number;
  Username: string;
  Email: string;
  Role: EUserRole;
}

export class UserService {
  public async GetUserById(userId: number): Promise<IUser> {
    const user = await User.findByPk(userId);
    return user;
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// ❌ Incorrect
export interface user {  // Should be IUser
  id: number;          // Should be Id
  username: string;    // Should be Username
}
```

### **SOLID Principles**

Deploy Center follows **SOLID** design principles:

**S - Single Responsibility Principle**

- Each class should have one responsibility
- Services handle business logic
- Controllers handle HTTP requests
- Models handle data access

**O - Open/Closed Principle**

- Classes should be open for extension, closed for modification
- Use interfaces and dependency injection

**L - Liskov Substitution Principle**

- Derived classes must be substitutable for their base classes
- Interfaces define contracts

**I - Interface Segregation Principle**

- Many specific interfaces are better than one general interface
- Don't force classes to implement unused methods

**D - Dependency Inversion Principle**

- Depend on abstractions, not concretions
- Use dependency injection

**Example:**

```typescript
// ✅ Good - Following SOLID
interface INotificationService {
  Send(message: string, recipient: string): Promise<void>;
}

class EmailNotificationService implements INotificationService {
  async Send(message: string, recipient: string): Promise<void> {
    // Send email
  }
}

class DiscordNotificationService implements INotificationService {
  async Send(message: string, recipient: string): Promise<void> {
    // Send Discord message
  }
}

class DeploymentService {
  constructor(private notificationService: INotificationService) {}

  async NotifyDeployment(deployment: IDeployment): Promise<void> {
    await this.notificationService.Send(
      `Deployment ${deployment.Id} completed`,
      deployment.NotifyRecipient
    );
  }
}
```

### **Error Handling**

- ✅ Always use try-catch in async functions
- ✅ Throw meaningful errors
- ✅ Log errors with context
- ✅ Use custom error classes

**Example:**

```typescript
// ✅ Good
export class DeploymentService {
  public async CreateDeployment(projectId: number): Promise<IDeployment> {
    try {
      const project = await Project.findByPk(projectId);

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const deployment = await Deployment.create({
        ProjectId: projectId,
        Status: EDeploymentStatus.Queued,
      });

      Logger.info('Deployment created', {
        deploymentId: deployment.Id,
        projectId,
      });

      return deployment;
    } catch (error) {
      Logger.error('Failed to create deployment', {
        projectId,
        error: error.message,
      });
      throw error;
    }
  }
}
```

### **Logging**

- ✅ Use Winston logger (available via `Logger` singleton)
- ✅ Include context in logs
- ✅ Use appropriate log levels

**Log Levels:**

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Errors, exceptions | `Logger.error('Database connection failed', { error })` |
| `warn` | Warnings, deprecations | `Logger.warn('Deprecated API endpoint used')` |
| `info` | Important events | `Logger.info('Deployment started', { deploymentId })` |
| `debug` | Development debugging | `Logger.debug('Variable value', { variable })` |

**Example:**

```typescript
// ✅ Good
Logger.info('User registered successfully', {
  userId: user.Id,
  username: user.Username,
  timestamp: new Date(),
});

// ❌ Bad
console.log('User registered');
```

### **Comments**

- ✅ Write self-documenting code
- ✅ Add comments for complex logic
- ✅ Use JSDoc for public methods
- ❌ Don't state the obvious

**Example:**

```typescript
// ✅ Good
/**
 * Calculates deployment success rate for a project
 * @param projectId - The project ID
 * @param days - Number of days to look back (default: 30)
 * @returns Success rate as percentage (0-100)
 */
public async CalculateSuccessRate(
  projectId: number,
  days: number = 30
): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const deployments = await Deployment.findAll({
    where: {
      ProjectId: projectId,
      CreatedAt: { [Op.gte]: startDate },
    },
  });

  if (deployments.length === 0) return 0;

  const successCount = deployments.filter(
    d => d.Status === EDeploymentStatus.Success
  ).length;

  return (successCount / deployments.length) * 100;
}
```

---

## 📝 **Commit Message Guidelines**

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### **Format**

```
<type>(<scope>): <subject>

<body>

<footer>
```

### **Types**

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add JWT refresh token support` |
| `fix` | Bug fix | `fix(deployment): resolve queue deadlock issue` |
| `docs` | Documentation | `docs(readme): update installation guide` |
| `style` | Formatting, missing semicolons | `style: format code with prettier` |
| `refactor` | Code restructuring | `refactor(services): extract notification logic` |
| `test` | Adding tests | `test(auth): add unit tests for login` |
| `chore` | Maintenance | `chore(deps): update dependencies` |
| `perf` | Performance improvement | `perf(db): optimize deployment queries` |

### **Scope**

The scope should be the name of the affected module:

- `auth` — Authentication
- `projects` — Project management
- `deployments` — Deployment system
- `queue` — Queue management
- `pipeline` — Pipeline execution
- `notifications` — Notification service
- `webhooks` — Webhook handling
- `api` — API endpoints
- `db` — Database
- `config` — Configuration
- `docs` — Documentation

### **Examples**

```
✅ Good commit messages:

feat(auth): implement two-factor authentication
fix(queue): prevent concurrent deployments for same project
docs(api): add examples to deployment endpoints
refactor(pipeline): extract variable substitution logic
test(webhooks): add integration tests for GitHub webhooks
chore(deps): upgrade express to 4.19
perf(db): add index on Deployments.ProjectId

❌ Bad commit messages:

Fixed bug
Updated code
Changes
WIP
asdf
```

---

## 🔄 **Pull Request Process**

### **Before Submitting**

1. ✅ Ensure your code follows the [coding standards](#coding-standards)
2. ✅ Run `npm run lint` and fix all issues
3. ✅ Run `npm test` and ensure all tests pass
4. ✅ Update documentation if you changed APIs
5. ✅ Add tests for new features
6. ✅ Rebase on latest `main` branch

### **PR Title Format**

Follow the same format as commit messages:

```
feat(scope): description
fix(scope): description
docs(scope): description
```

### **PR Description Template**

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran.

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Related Issues
Closes #(issue number)

## Screenshots (if applicable)
Add screenshots here.
```

### **Review Process**

1. A maintainer will review your PR within 3-5 business days
2. Address any requested changes
3. Once approved, a maintainer will merge your PR
4. Your contribution will be included in the next release!

### **After Your PR is Merged**

- 🎉 Congratulations! You're now a Deploy Center contributor!
- Your name will be added to the [Contributors list](https://github.com/FutureSolutionDev/Deploy-Center-Server/graphs/contributors)
- Consider joining our [Discord community](#)

---

## 📁 **Project Structure**

Understanding the codebase structure:

```tree
server/src/
├── Config/              # Application configuration
│   └── AppConfig.ts     # Singleton config class
├── Controllers/         # HTTP request handlers
│   ├── AuthController.ts
│   ├── ProjectController.ts
│   ├── DeploymentController.ts
│   └── WebhookController.ts
├── Database/            # Database connection
│   └── DatabaseConnection.ts
├── Middleware/          # Express middlewares
│   ├── AuthMiddleware.ts
│   ├── RoleMiddleware.ts
│   ├── ValidationMiddleware.ts
│   └── ...
├── Models/              # Sequelize models
│   ├── User.ts
│   ├── Project.ts
│   ├── Deployment.ts
│   └── index.ts
├── Routes/              # API routes
│   ├── AuthRoutes.ts
│   ├── ProjectRoutes.ts
│   └── index.ts
├── Services/            # Business logic
│   ├── AuthService.ts
│   ├── DeploymentService.ts
│   ├── PipelineService.ts
│   └── ...
├── Types/               # TypeScript types
│   ├── ICommon.ts
│   └── IDatabase.ts
├── Utils/               # Utility functions
│   ├── Logger.ts
│   ├── PasswordHelper.ts
│   └── ...
├── App.ts               # Express app setup
├── Server.ts            # Server initialization
└── index.ts             # Entry point
```

**[📖 Detailed Structure Documentation](./docs/PROJECT_STRUCTURE.md)**

---

## 🧪 **Testing Guidelines**

### **Writing Tests**

- ✅ Write tests for all new features
- ✅ Write tests for bug fixes
- ✅ Aim for >80% code coverage
- ✅ Use descriptive test names

**Test File Naming:**

```
FileName.ts       → FileName.test.ts
AuthService.ts    → AuthService.test.ts
```

**Test Structure:**

```typescript
describe('AuthService', () => {
  describe('Login', () => {
    it('should return tokens for valid credentials', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'Test@12345';

      // Act
      const result = await authService.Login({ Username: username, Password: password });

      // Assert
      expect(result).toHaveProperty('Tokens');
      expect(result.Tokens).toHaveProperty('AccessToken');
      expect(result.Tokens).toHaveProperty('RefreshToken');
    });

    it('should throw error for invalid credentials', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'wrongpassword';

      // Act & Assert
      await expect(authService.Login({ Username: username, Password: password }))
        .rejects
        .toThrow('Invalid credentials');
    });
  });
});
```

### **Running Tests**

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test AuthService.test.ts
```

---

## 📚 **Documentation Guidelines**

### **Code Documentation**

Use JSDoc for public methods:

```typescript
/**
 * Creates a new deployment for a project
 * @param projectId - The ID of the project to deploy
 * @param options - Deployment options
 * @param options.branch - Git branch to deploy
 * @param options.commitHash - Specific commit to deploy (optional)
 * @returns The created deployment object
 * @throws {Error} If project not found or deployment fails
 * @example
 * ```typescript
 * const deployment = await deploymentService.CreateDeployment(1, {
 *   branch: 'main',
 *   commitHash: 'abc123'
 * });
 * ```
 */
public async CreateDeployment(
  projectId: number,
  options: IDeploymentOptions
): Promise<IDeployment> {
  // Implementation
}
```

### **Markdown Documentation**

- ✅ Use clear headings
- ✅ Include code examples
- ✅ Add table of contents for long documents
- ✅ Use markdown formatting (bold, italic, code blocks)
- ✅ Add diagrams where helpful (Mermaid)

### **README Updates**

If you change functionality visible to users, update relevant README sections:

- Installation steps
- Configuration options
- API endpoints
- Examples

---

## 🌍 **Community**

### **Communication Channels**

- 💬 **GitHub Discussions** — [Ask questions, share ideas](https://github.com/FutureSolutionDev/Deploy-Center-Server/discussions)
- 🐛 **GitHub Issues** — [Report bugs, request features](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues)
- 📧 **Email** — [support@futuresolutionsdev.com](mailto:support@futuresolutionsdev.com)

### **Recognition**

We appreciate all contributors! Your contributions will be:

- ✅ Listed in the [Contributors page](https://github.com/FutureSolutionDev/Deploy-Center-Server/graphs/contributors)
- ✅ Mentioned in release notes
- ✅ Highlighted in the changelog

### **Becoming a Maintainer**

Interested in becoming a maintainer? Active contributors who demonstrate:

- Quality code contributions
- Helpful code reviews
- Active community participation
- Alignment with project values

May be invited to join the maintainer team. Reach out to [maintainers@futuresolutionsdev.com](mailto:maintainers@futuresolutionsdev.com).

---

## ❓ **Questions?**

Have questions? Here's how to get help:

1. **Check the docs** — [Documentation](./docs/)
2. **Search issues** — [Existing issues](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues)
3. **Ask in discussions** — [GitHub Discussions](https://github.com/FutureSolutionDev/Deploy-Center-Server/discussions)
4. **Email support** — [support@futuresolutionsdev.com](mailto:support@futuresolutionsdev.com)

---

## 🙏 **Thank You!**

Thank you for contributing to Deploy Center! Every contribution, no matter how small, makes a difference.

**Happy Coding!** 🚀

---

<div align="center">

**[⬆ Back to Top](#contributing-to-deploy-center)**

Made with ❤️ by the [Deploy Center Community](https://github.com/FutureSolutionDev/Deploy-Center-Server/graphs/contributors)

</div>
