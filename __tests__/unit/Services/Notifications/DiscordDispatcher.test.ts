/**
 * DiscordDispatcher unit tests — Deploy Center v3.0 / F-002 (T075).
 * axios.post is mocked so no network IO happens.
 */

import axios from 'axios';
import { DiscordDispatcher } from '@Services/Notifications/DiscordDispatcher';
import {
  ENotificationEvent,
  EDeploymentStatus,
} from '@Types/ICommon';
import type {
  INotificationPayload,
} from '@Services/Notifications/INotificationDispatcher';

jest.mock('axios');
const axiosMock = axios as jest.Mocked<typeof axios>;

const samplePayload: INotificationPayload = {
  Event: ENotificationEvent.DeploymentSucceeded,
  Status: EDeploymentStatus.Success,
  ProjectId: 1,
  ProjectName: 'demo',
  DeploymentId: 42,
  Branch: 'main',
  CommitHash: 'a'.repeat(40),
  CommitMessage: 'fix: something',
  Author: 'sabry',
  Duration: 12,
  Url: 'https://demo.local',
};

describe('DiscordDispatcher', () => {
  beforeEach(() => {
    axiosMock.post.mockReset();
  });

  it('posts to webhookRoot when no suffix or override provided', async () => {
    axiosMock.post.mockResolvedValueOnce({ status: 204 } as never);
    const d = new DiscordDispatcher();
    await d.Send(
      { webhookRoot: 'https://discord.test/webhooks/abc' },
      {},
      samplePayload
    );

    expect(axiosMock.post).toHaveBeenCalledTimes(1);
    const [url, body] = axiosMock.post.mock.calls[0]!;
    expect(url).toBe('https://discord.test/webhooks/abc');
    expect((body as { embeds: Array<{ fields: unknown[] }> }).embeds[0]!.fields.length)
      .toBeGreaterThanOrEqual(3);
  });

  it('honors overrideWebhook over webhookRoot', async () => {
    axiosMock.post.mockResolvedValueOnce({ status: 204 } as never);
    const d = new DiscordDispatcher();
    await d.Send(
      { webhookRoot: 'https://discord.test/main' },
      { overrideWebhook: 'https://discord.test/override' },
      samplePayload
    );
    expect(axiosMock.post.mock.calls[0]![0]).toBe('https://discord.test/override');
  });

  it('throws when neither webhookRoot nor override is provided', async () => {
    const d = new DiscordDispatcher();
    await expect(
      d.Send({ webhookRoot: '' }, {}, samplePayload)
    ).rejects.toThrow(/webhookRoot/);
    expect(axiosMock.post).not.toHaveBeenCalled();
  });

  it('propagates axios failure (so fan-out can log + continue)', async () => {
    axiosMock.post.mockRejectedValueOnce(new Error('429 Too Many Requests'));
    const d = new DiscordDispatcher();
    await expect(
      d.Send({ webhookRoot: 'https://discord.test/abc' }, {}, samplePayload)
    ).rejects.toThrow(/Too Many Requests/);
  });
});
