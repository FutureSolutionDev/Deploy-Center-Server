/**
 * Test data factories — F-002. Each factory returns a persisted row with sensible
 * defaults so individual tests only override what they care about.
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { User } from '@Models/User';
import { Project } from '@Models/Project';
import { Deployment } from '@Models/Deployment';
import { setupTestDb } from './setupTestDb';

// --- shared helpers ----------------------------------------------------------

let userCounter = 0;
let projectCounter = 0;
let deploymentCounter = 0;

const uniqueSuffix = (): string => crypto.randomBytes(4).toString('hex');

// --- factories ---------------------------------------------------------------

export interface IMakeUserOverrides {
  Username?: string;
  Email?: string;
  Password?: string; // plaintext — will be bcrypt-hashed into PasswordHash
  Role?: 'Admin' | 'Manager' | 'Developer' | 'Viewer';
  IsActive?: boolean;
}

/**
 * Create + persist a User. Default Role=Developer.
 * `Password` is the plaintext — stored as bcrypt `PasswordHash`.
 */
export async function makeUser(overrides: IMakeUserOverrides = {}): Promise<User> {
  await setupTestDb();
  userCounter += 1;
  const suffix = uniqueSuffix();
  const plain = overrides.Password ?? `Test@${suffix}`;
  return User.create({
    Username: overrides.Username ?? `testuser_${userCounter}_${suffix}`,
    Email: overrides.Email ?? `test_${userCounter}_${suffix}@test.local`,
    PasswordHash: await bcrypt.hash(plain, 10),
    Role: overrides.Role ?? 'Developer',
    IsActive: overrides.IsActive ?? true,
  } as never);
}

export interface IMakeProjectOverrides {
  Name?: string;
  RepoUrl?: string;
  Branch?: string;
  ProjectPath?: string;
  CreatedBy?: number;
  Config?: Record<string, unknown>;
  IsActive?: boolean;
}

/**
 * Create + persist a Project. If CreatedBy not given, auto-creates an Admin user.
 */
export async function makeProject(overrides: IMakeProjectOverrides = {}): Promise<Project> {
  await setupTestDb();
  projectCounter += 1;
  const suffix = uniqueSuffix();
  const createdBy =
    overrides.CreatedBy ?? ((await makeUser({ Role: 'Admin' })).Id as number);

  return Project.create({
    Name: overrides.Name ?? `project_${projectCounter}_${suffix}`,
    RepoUrl: overrides.RepoUrl ?? `git@github.com:test/repo_${suffix}.git`,
    Branch: overrides.Branch ?? 'main',
    ProjectPath: overrides.ProjectPath ?? `/tmp/test/project_${projectCounter}`,
    // Must match EProjectType enum values: 'node'/'react'/'static'/'docker'/'nextjs'/'other'.
    ProjectType: 'node',
    WebhookSecret: crypto.randomBytes(16).toString('hex'),
    Config: overrides.Config ?? { pipeline: [], envVars: {} },
    CreatedBy: createdBy,
    IsActive: overrides.IsActive ?? true,
  } as never);
}

export interface IMakeDeploymentOverrides {
  ProjectId?: number;
  Status?: 'Pending' | 'Queued' | 'Running' | 'Success' | 'Failed' | 'Cancelled';
  Type?: 'manual' | 'webhook' | 'rollback';
  CommitHash?: string;
  Branch?: string;
  TriggeredBy?: number;
}

/**
 * Create + persist a Deployment. If ProjectId not given, auto-creates a Project.
 */
export async function makeDeployment(
  overrides: IMakeDeploymentOverrides = {}
): Promise<Deployment> {
  await setupTestDb();
  deploymentCounter += 1;
  const projectId =
    overrides.ProjectId ?? ((await makeProject()).Id as number);

  return Deployment.create({
    ProjectId: projectId,
    Status: overrides.Status ?? 'Pending',
    TriggerType: overrides.Type ?? 'manual',
    Branch: overrides.Branch ?? 'main',
    CommitHash: overrides.CommitHash ?? `abc${deploymentCounter}${uniqueSuffix()}`,
    CommitMessage: `test commit ${deploymentCounter}`,
    Author: 'tester',
    TriggeredBy: overrides.TriggeredBy,
  } as never);
}

/**
 * Reset internal counters. Call between suites if test isolation requires it.
 */
export function resetFactoryCounters(): void {
  userCounter = 0;
  projectCounter = 0;
  deploymentCounter = 0;
}
