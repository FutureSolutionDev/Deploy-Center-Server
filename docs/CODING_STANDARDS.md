# Deploy Center — Coding Standards

> Conventions are version-agnostic; the rules below apply to the v3.0
> codebase. v3.0-specific stack gotchas (BullMQ priority semantics, mysql2
> JSON parsing, jest setupFiles ordering, React 19 rules of hooks) live in
> [`../CLAUDE.md`](../CLAUDE.md) §"v3.0 Stack-Specific Gotchas".

## 📋 Table of Contents

- [Naming Conventions](#naming-conventions)
- [SOLID Principles](#solid-principles)
- [OOP Best Practices](#oop-best-practices)
- [TypeScript Guidelines](#typescript-guidelines)
- [React Components Guidelines](#react-components-guidelines)
- [File Organization](#file-organization)
- [v3.0 Dependencies (added since v2.1)](#v30-dependencies-added-since-v21)

---

## 🏷️ Naming Conventions

### PascalCase (Required)

#### Interfaces

- **MUST** start with `I` prefix
- **MUST** be PascalCase

```typescript
// ✅ Correct
interface IUser {
  Id: number;
  Name: string;
}

// ❌ Wrong
interface User {
  id: number;
  name: string;
}
```

#### Type Aliases

- **MUST** start with `T` prefix
- **MUST** be PascalCase

```typescript
// ✅ Correct
type TUserRole = 'admin' | 'developer' | 'viewer';

// ❌ Wrong
type UserRole = 'admin' | 'developer' | 'viewer';
```

#### Enums

- **MUST** start with `E` prefix
- **MUST** be PascalCase
- Members **MUST** be PascalCase

```typescript
// ✅ Correct
enum EProjectType {
  Node = 'node',
  React = 'react',
  Static = 'static',
  Docker = 'docker',
  NextJS = 'next',
  Other = 'other',
}

// ❌ Wrong
enum ProjectType {
  nodejs = 'nodejs',
  react = 'react',
}
```

#### Classes

- **MUST** be PascalCase
- No prefix required

```typescript
// ✅ Correct
class ProjectService {
  private apiUrl: string;
  
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }
  
  public async GetProjects(): Promise<IProject[]> {
    // Implementation
  }
}

// ❌ Wrong
class projectService {
  get_projects() {
    // Implementation
  }
}
```

### Variables and Functions

#### React Components

- **MUST** be PascalCase
- **MUST** use arrow functions for functional components

```typescript
// ✅ Correct
export const ProjectsPage: React.FC = () => {
  return <div>Projects</div>;
};

// ❌ Wrong
export const projectsPage = () => {
  return <div>Projects</div>;
};
```

#### Functions and Methods

- **SHOULD** be PascalCase for public methods
- **CAN** be camelCase for private/utility functions

```typescript
// ✅ Correct
class UserService {
  public async GetUserById(id: number): Promise<IUser> {
    return this.fetchUser(id);
  }
  
  private async fetchUser(id: number): Promise<IUser> {
    // Implementation
  }
}

// Handler functions in React
const HandleSubmit = (event: React.FormEvent) => {
  event.preventDefault();
};
```

#### Variables

- **PascalCase** for React state and component-level variables
- **camelCase** for utility variables and loop counters
- **UPPER_CASE** for constants

```typescript
// ✅ Correct - React Component
const [FormData, setFormData] = useState<IFormData>({});
const [Loading, setLoading] = useState(false);

// ✅ Correct - Constants
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRY_ATTEMPTS = 3;

// ✅ Correct - Utility
const fetchData = async () => {
  const response = await fetch(API_BASE_URL);
  return response.json();
};
```

#### Properties in Interfaces

- **MUST** be PascalCase to match backend API

```typescript
// ✅ Correct
interface IProject {
  Id: number;
  Name: string;
  RepoUrl: string;
  CreatedAt: Date;
}

// ❌ Wrong
interface IProject {
  id: number;
  name: string;
  repoUrl: string;
  createdAt: Date;
}
```

---

## 🏛️ SOLID Principles

### Single Responsibility Principle (SRP)

- Each class/function should have **ONE** reason to change
- Max **500 lines** per file
- Max **100 lines** per function

```typescript
// ✅ Correct - Single Responsibility
class ProjectService {
  public async GetAll(): Promise<IProject[]> {
    return ApiInstance.get('/projects');
  }
}

class ProjectValidator {
  public Validate(project: IProject): boolean {
    return project.Name.length > 0 && project.RepoUrl.length > 0;
  }
}

// ❌ Wrong - Multiple Responsibilities
class ProjectManager {
  public async GetAll(): Promise<IProject[]> { }
  public Validate(project: IProject): boolean { }
  public RenderUI(project: IProject): JSX.Element { }
  public SendEmail(project: IProject): void { }
}
```

### Open/Closed Principle (OCP)

- Open for extension, closed for modification
- Use interfaces and abstract classes

```typescript
// ✅ Correct
interface INotificationService {
  Send(message: string): Promise<void>;
}

class DiscordNotificationService implements INotificationService {
  public async Send(message: string): Promise<void> {
    // Discord-specific implementation
  }
}

class SlackNotificationService implements INotificationService {
  public async Send(message: string): Promise<void> {
    // Slack-specific implementation
  }
}
```

### Liskov Substitution Principle (LSP)

- Derived classes must be substitutable for their base classes

```typescript
// ✅ Correct
abstract class BaseService {
  protected abstract GetEndpoint(): string;
  
  public async FetchData<T>(): Promise<T> {
    const endpoint = this.GetEndpoint();
    return ApiInstance.get(endpoint);
  }
}

class ProjectService extends BaseService {
  protected GetEndpoint(): string {
    return '/projects';
  }
}
```

### Interface Segregation Principle (ISP)

- Clients should not depend on interfaces they don't use
- Prefer small, focused interfaces

```typescript
// ✅ Correct - Small, focused interfaces
interface IReadable {
  Read(): Promise<void>;
}

interface IWritable {
  Write(data: any): Promise<void>;
}

interface IDeletable {
  Delete(id: number): Promise<void>;
}

// ❌ Wrong - Fat interface
interface IRepository {
  Read(): Promise<void>;
  Write(data: any): Promise<void>;
  Delete(id: number): Promise<void>;
  Export(): void;
  Import(): void;
  Backup(): void;
}
```

### Dependency Inversion Principle (DIP)

- Depend on abstractions, not concretions

```typescript
// ✅ Correct
interface IApiClient {
  Get<T>(url: string): Promise<T>;
  Post<T>(url: string, data: any): Promise<T>;
}

class ProjectService {
  constructor(private apiClient: IApiClient) {}
  
  public async GetProjects(): Promise<IProject[]> {
    return this.apiClient.Get<IProject[]>('/projects');
  }
}

// ❌ Wrong - Direct dependency
class ProjectService {
  public async GetProjects(): Promise<IProject[]> {
    return axios.get('/projects'); // Direct dependency on axios
  }
}
```

---

## 🎯 OOP Best Practices

### Class Structure

```typescript
class ExampleService {
  // 1. Static fields
  private static instance: ExampleService;
  
  // 2. Instance fields
  private apiUrl: string;
  protected cache: Map<string, any>;
  public isReady: boolean;
  
  // 3. Constructor
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
    this.cache = new Map();
    this.isReady = false;
  }
  
  // 4. Static methods
  public static GetInstance(): ExampleService {
    if (!ExampleService.instance) {
      ExampleService.instance = new ExampleService('');
    }
    return ExampleService.instance;
  }
  
  // 5. Public methods
  public async Initialize(): Promise<void> {
    this.isReady = true;
  }
  
  // 6. Protected methods
  protected ValidateData(data: any): boolean {
    return data !== null;
  }
  
  // 7. Private methods
  private async fetchFromApi(): Promise<any> {
    // Implementation
  }
}
```

### Encapsulation

- Use `public`, `protected`, `private` modifiers
- Prefer getters/setters over direct property access

```typescript
// ✅ Correct
class User {
  private _name: string;
  
  public get Name(): string {
    return this._name;
  }
  
  public set Name(value: string) {
    if (value.length < 3) {
      throw new Error('Name too short');
    }
    this._name = value;
  }
}

// ❌ Wrong
class User {
  public name: string; // Direct access, no validation
}
```

### Inheritance

- Use inheritance for "is-a" relationships
- Use composition for "has-a" relationships

```typescript
// ✅ Correct - Inheritance
abstract class BaseComponent {
  protected abstract Render(): JSX.Element;
}

class ProjectCard extends BaseComponent {
  protected Render(): JSX.Element {
    return <div>Project Card</div>;
  }
}

// ✅ Correct - Composition
class ProjectService {
  constructor(
    private apiClient: IApiClient,
    private logger: ILogger,
    private cache: ICache
  ) {}
}
```

---

## 📘 TypeScript Guidelines

### Type Safety

```typescript
// ✅ Correct - Explicit types
function CalculateTotal(items: ICartItem[]): number {
  return items.reduce((sum, item) => sum + item.Price, 0);
}

// ❌ Wrong - No types
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Avoid `any`

```typescript
// ✅ Correct
function HandleError(error: Error | unknown): void {
  if (error instanceof Error) {
    console.error(error.message);
  }
}

// ⚠️ Acceptable for gradual migration (will warn)
function ProcessData(data: any): void {
  // Temporary, should be replaced with proper type
}
```

### Use Nullish Coalescing

```typescript
// ✅ Correct
const username = user.Name ?? 'Guest';

// ❌ Wrong
const username = user.Name || 'Guest'; // Fails for empty string
```

### Use Optional Chaining

```typescript
// ✅ Correct
const city = user?.Address?.City;

// ❌ Wrong
const city = user && user.Address && user.Address.City;
```

---

## ⚛️ React Components Guidelines

### Functional Components (Preferred)

```typescript
// ✅ Correct
interface IProjectCardProps {
  Project: IProject;
  OnDelete: (id: number) => void;
}

export const ProjectCard: React.FC<IProjectCardProps> = ({ Project, OnDelete }) => {
  const [Loading, setLoading] = useState(false);
  
  const HandleDelete = async () => {
    setLoading(true);
    await OnDelete(Project.Id);
    setLoading(false);
  };
  
  return (
    <Card>
      <Typography>{Project.Name}</Typography>
      <Button onClick={HandleDelete} disabled={Loading}>
        Delete
      </Button>
    </Card>
  );
};
```

### Class Components (When Needed)

```typescript
// ✅ Correct
interface IProjectListProps {
  ProjectId: number;
}

interface IProjectListState {
  Projects: IProject[];
  Loading: boolean;
}

export class ProjectList extends React.Component<IProjectListProps, IProjectListState> {
  public constructor(props: IProjectListProps) {
    super(props);
    this.state = {
      Projects: [],
      Loading: false,
    };
  }
  
  public async componentDidMount(): Promise<void> {
    await this.FetchProjects();
  }
  
  private async FetchProjects(): Promise<void> {
    this.setState({ Loading: true });
    const projects = await ProjectsService.GetAll();
    this.setState({ Projects: projects, Loading: false });
  }
  
  public render(): JSX.Element {
    const { Projects, Loading } = this.state;
    
    if (Loading) {
      return <CircularProgress />;
    }
    
    return (
      <div>
        {Projects.map(project => (
          <ProjectCard key={project.Id} Project={project} />
        ))}
      </div>
    );
  }
}
```

---

## 📁 File Organization

### Directory Structure

```tree
src/
├── components/          # Reusable UI components
│   ├── Layout/
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Navbar.tsx
│   └── Projects/
│       ├── ProjectCard.tsx
│       └── Wizard/
│           ├── ProjectWizard.tsx
│           ├── Step1BasicInfo.tsx
│           └── Step2Configuration.tsx
├── pages/               # Page components
│   ├── Auth/
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   └── Projects/
│       ├── ProjectsPage.tsx
│       └── ProjectDetailsPage.tsx
├── services/            # API services (Classes)
│   ├── ApiClient.ts
│   ├── ProjectsService.ts
│   └── DeploymentsService.ts
├── contexts/            # React Contexts
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── LanguageContext.tsx
├── types/               # TypeScript definitions
│   └── index.ts
├── utils/               # Utility functions
│   ├── formatters.ts
│   └── validators.ts
└── constants/           # Constants
    └── index.ts
```

### File Naming

- **Components:** PascalCase (e.g., `ProjectCard.tsx`)
- **Services:** PascalCase (e.g., `ProjectsService.ts`)
- **Utilities:** camelCase (e.g., `formatters.ts`)
- **Constants:** camelCase (e.g., `apiEndpoints.ts`)

---

## ✅ Checklist Before Committing

- [ ] All interfaces start with `I`
- [ ] All type aliases start with `T`
- [ ] All enums start with `E`
- [ ] No `any` types (or justified with comment)
- [ ] All functions have explicit return types
- [ ] PascalCase used for all public APIs
- [ ] Classes follow member ordering rules
- [ ] No circular dependencies
- [ ] Max file length: 500 lines
- [ ] Max function length: 100 lines
- [ ] ESLint passes with zero errors

---

## 🔍 Code Review Guidelines

### What to Look For

1. **Naming:** Does it follow PascalCase conventions?
2. **SOLID:** Does each class/function have a single responsibility?
3. **Types:** Are all types explicit and correct?
4. **Reusability:** Can this code be reused elsewhere?
5. **Testability:** Can this code be easily tested?
6. **Performance:** Are there any obvious performance issues?
7. **Security:** Are there any security vulnerabilities?

---

## v3.0 Dependencies (added since v2.1)

These were introduced by v3.0 features. The exact version pins live in
[`package.json`](../package.json) — treat this list as a reference for
**which library handles what**, not as version-of-truth.

### Server

| Package | Used for | Feature | Where |
| --- | --- | --- | --- |
| `bullmq` | Persistent job queue | F-001 | `Services/QueueService.ts`, `Services/QueueAdminService.ts` |
| `ioredis` | Redis client (BullMQ's transport) | F-001 | `Config/RedisConfig.ts` |
| `@bull-board/api` + `@bull-board/express` | Queue admin UI | F-001 | mounted at `/admin/queues` in `App.ts` |
| `@slack/webhook` | Slack notifications | F-006 | `Services/Notifications/SlackDispatcher.ts` |
| `nodemailer` | Email notifications | F-006 | `Services/Notifications/EmailDispatcher.ts` (was already in deps; now wired up) |

### Client

| Package | Used for | Feature | Where |
| --- | --- | --- | --- |
| `@dnd-kit/core` (+ `sortable`, `utilities`) | Drag-and-drop for the Workspaces grid | F-009 | `pages/Projects/` |

### Conventions for adding more

- **Don't import a new framework when one already in `package.json` covers
  the case.** (No Tailwind in the MUI codebase, no Drizzle next to
  Sequelize, no Axios alternative when fetch is enough.)
- **New `dependencies` need a clear, named home** — a service file or
  middleware. If it doesn't have one, it's probably not earning its bytes.
- **Pin BullMQ + ioredis together.** Their versions are tightly coupled —
  upgrade in lockstep.
- **`devDependencies`-only:** anything build-time (`@types/*`, eslint
  plugins, ts-jest). Anything imported by `src/` belongs in
  `dependencies`.

---

**Last Updated:** 2026-05-24 (v3.0.0 GA — added v3.0 deps section, linked
to CLAUDE.md for stack gotchas; rules themselves unchanged).
