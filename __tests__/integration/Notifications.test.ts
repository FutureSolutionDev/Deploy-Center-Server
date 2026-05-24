/**
 * Notifications integration — Deploy Center v3.0 / F-002 (T076).
 *
 * Provider → Channel → Subscription wiring tested end-to-end via the REST
 * endpoints. Dispatchers are stubbed so no Discord/Slack/SMTP IO occurs.
 *
 * Scenarios:
 *  1. Admin creates a Discord provider, then a channel under it, then a
 *     subscription tying the channel to a project + event set.
 *  2. Triggering NotificationService.SendForEvent for that (project, event)
 *     invokes the matching dispatcher once.
 *  3. Deleting the provider cascades to its channels (and subscriptions).
 *  4. Subscriptions whose channel IsActive=false are skipped silently.
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import request from 'supertest';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeUser, makeProject } from '../helpers/factories';
import { authHeader } from '../helpers/token';
import { buildTestApp } from '../helpers/testApp';

import NotificationProviderRoutes from '@Routes/NotificationProviderRoutes';
import NotificationChannelRoutes from '@Routes/NotificationChannelRoutes';
import ProjectNotificationSubscriptionRoutes from '@Routes/ProjectNotificationSubscriptionRoutes';

import { NotificationService } from '@Services/NotificationService';
import { NotificationProvider } from '@Models/NotificationProvider';
import { NotificationChannel } from '@Models/NotificationChannel';
import {
  EDeploymentStatus,
  ENotificationEvent,
  ENotificationProviderType,
} from '@Types/ICommon';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('Notifications — F-006 integration (provider → channel → subscription)', () => {
  let dbUp = false;
  let app: import('express').Application;
  let adminAuth: { Authorization: string };
  let projectId: number;

  // Stub dispatchers so the suite is hermetic.
  const discordSend = jest.fn();
  const slackSend = jest.fn();

  beforeAll(async () => {
    dbUp = await dbReachable();
    if (!dbUp) {
      // eslint-disable-next-line no-console
      console.warn('Test DB unreachable — Notifications suite will be skipped');
      return;
    }
    app = buildTestApp([
      { path: '/api/notifications/providers', router: new NotificationProviderRoutes().Router },
      { path: '/api/notifications/channels', router: new NotificationChannelRoutes().Router },
      {
        path: '/api/projects/:projectId/notification-subscriptions',
        router: new ProjectNotificationSubscriptionRoutes().Router,
      },
    ]);

    const internals = NotificationService as unknown as {
      Dispatchers: Record<string, { Send: jest.Mock }>;
    };
    internals.Dispatchers.discord!.Send = discordSend as never;
    internals.Dispatchers.slack!.Send = slackSend as never;
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (!dbUp) return;
    await truncateAll();
    discordSend.mockReset();
    slackSend.mockReset();
    const admin = await makeUser({ Role: 'Admin' });
    adminAuth = authHeader(admin);
    const project = await makeProject({ CreatedBy: admin.Id });
    projectId = project.Id;
  });

  it('full happy path: create provider → channel → subscription → SendForEvent fires dispatcher', async () => {
    if (!dbUp) return;

    // 1. Create Discord provider
    const provRes = await request(app)
      .post('/api/notifications/providers')
      .set(adminAuth)
      .send({
        Name: 'discord-prod',
        Type: ENotificationProviderType.Discord,
        Config: { webhookRoot: 'https://discord.test/webhooks/main' },
      });
    expect(provRes.status).toBe(200);
    const providerId = provRes.body.Data.Id;
    expect(providerId).toBeGreaterThan(0);

    // 2. Create channel under that provider
    const chanRes = await request(app)
      .post('/api/notifications/channels')
      .set(adminAuth)
      .send({
        ProviderId: providerId,
        Name: 'deploy-room',
        DeliveryConfig: { webhookSuffix: 'abc/xyz' },
      });
    expect(chanRes.status).toBe(200);
    const channelId = chanRes.body.Data.Id;

    // 3. Subscribe the project to DeploymentSucceeded
    const subRes = await request(app)
      .post(`/api/projects/${projectId}/notification-subscriptions`)
      .set(adminAuth)
      .send({
        ChannelId: channelId,
        Events: [ENotificationEvent.DeploymentSucceeded],
      });
    expect(subRes.status).toBe(200);

    // 4. Fire — should dispatch via the stubbed Discord
    discordSend.mockResolvedValue(undefined);
    await new NotificationService().SendForEvent(
      projectId,
      ENotificationEvent.DeploymentSucceeded,
      {
        Event: ENotificationEvent.DeploymentSucceeded,
        Status: EDeploymentStatus.Success,
        ProjectId: projectId,
        ProjectName: 'demo',
        DeploymentId: 1,
        Branch: 'main',
        CommitHash: 'e'.repeat(40),
      }
    );
    expect(discordSend).toHaveBeenCalledTimes(1);
  });

  it('deleting provider cascades to its channels', async () => {
    if (!dbUp) return;
    // Seed direct via model to bypass crypto pain.
    const provider = await NotificationProvider.create({
      Name: 'p-x',
      Type: ENotificationProviderType.Discord,
      ConfigEncrypted: 'x',
      Iv: 'x'.repeat(24),
      AuthTag: 'x'.repeat(32),
      IsActive: true,
      CreatedBy: null,
    } as never);
    await NotificationChannel.create({
      ProviderId: provider.Id,
      Name: 'c-1',
      DeliveryConfigEncrypted: 'x',
      Iv: 'x'.repeat(24),
      AuthTag: 'x'.repeat(32),
      IsActive: true,
    } as never);

    const delRes = await request(app)
      .delete(`/api/notifications/providers/${provider.Id}`)
      .set(adminAuth);
    expect(delRes.status).toBe(200);

    const remaining = await NotificationChannel.count({ where: { ProviderId: provider.Id } });
    expect(remaining).toBe(0);
  });

  it('inactive channel is skipped silently in fan-out', async () => {
    if (!dbUp) return;

    // Create a provider + inactive channel + subscription via direct DB so the
    // failure mode is the dispatch step, not the API.
    const provider = await NotificationProvider.create({
      Name: 'p-inact',
      Type: ENotificationProviderType.Discord,
      ConfigEncrypted: 'x',
      Iv: 'x'.repeat(24),
      AuthTag: 'x'.repeat(32),
      IsActive: true,
      CreatedBy: null,
    } as never);
    const channel = await NotificationChannel.create({
      ProviderId: provider.Id,
      Name: 'c-inact',
      DeliveryConfigEncrypted: 'x',
      Iv: 'x'.repeat(24),
      AuthTag: 'x'.repeat(32),
      IsActive: false, // ← key
    } as never);
    // Bypass the controller to create a subscription pointing at an inactive channel.
    const { ProjectNotificationSubscription } = await import('@Models/index');
    await ProjectNotificationSubscription.create({
      ProjectId: projectId,
      ChannelId: channel.Id,
      Events: [ENotificationEvent.DeploymentSucceeded],
      IsActive: true,
    } as never);

    discordSend.mockResolvedValue(undefined);
    await new NotificationService().SendForEvent(
      projectId,
      ENotificationEvent.DeploymentSucceeded,
      {
        Event: ENotificationEvent.DeploymentSucceeded,
        Status: EDeploymentStatus.Success,
        ProjectId: projectId,
        ProjectName: 'demo',
        DeploymentId: 7,
        Branch: 'main',
        CommitHash: 'f'.repeat(40),
      }
    );
    // GetSubscriptionsForEvent only returns subscriptions whose channel is active —
    // dispatcher must NOT be called.
    expect(discordSend).not.toHaveBeenCalled();
  });
});
