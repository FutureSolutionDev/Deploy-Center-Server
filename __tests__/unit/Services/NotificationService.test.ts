/**
 * NotificationService.SendForEvent unit tests — Deploy Center v3.0 / F-002 (T075).
 *
 * Verifies the fan-out contract:
 *   - When zero subscriptions exist for (projectId, event), no dispatcher runs.
 *   - When two subscriptions exist and one dispatcher fails, the other still
 *     delivers (Promise.allSettled, FR-025b).
 *   - When the SubscriptionService lookup itself throws, SendForEvent returns
 *     quietly (logs the error) and does NOT propagate.
 */

import { NotificationService } from '@Services/NotificationService';
import {
  EDeploymentStatus,
  ENotificationEvent,
  ENotificationProviderType,
} from '@Types/ICommon';

// Reach into the static container — these are the singletons SendForEvent uses.
const internals = NotificationService as unknown as {
  SubscriptionService: { GetSubscriptionsForEvent: jest.Mock };
  ProviderService: { Decrypt: jest.Mock };
  ChannelService: { Decrypt: jest.Mock };
  Dispatchers: Record<string, { Send: jest.Mock }>;
};

function makePayload(over: Partial<{
  Event: ENotificationEvent;
  Status: EDeploymentStatus;
}> = {}) {
  return {
    Event: over.Event ?? ENotificationEvent.DeploymentSucceeded,
    Status: over.Status ?? EDeploymentStatus.Success,
    ProjectId: 1,
    ProjectName: 'demo',
    DeploymentId: 100,
    Branch: 'main',
    CommitHash: 'd'.repeat(40),
  };
}

describe('NotificationService.SendForEvent — fan-out + isolation', () => {
  let svc: NotificationService;
  let getSubsSpy: jest.SpyInstance;
  let providerDecryptSpy: jest.SpyInstance;
  let channelDecryptSpy: jest.SpyInstance;
  let discordSendSpy: jest.SpyInstance;
  let slackSendSpy: jest.SpyInstance;

  beforeAll(() => {
    svc = new NotificationService();
  });

  beforeEach(() => {
    getSubsSpy = jest.spyOn(internals.SubscriptionService, 'GetSubscriptionsForEvent');
    providerDecryptSpy = jest.spyOn(internals.ProviderService, 'Decrypt');
    channelDecryptSpy = jest.spyOn(internals.ChannelService, 'Decrypt');
    discordSendSpy = jest.spyOn(internals.Dispatchers.discord!, 'Send');
    slackSendSpy = jest.spyOn(internals.Dispatchers.slack!, 'Send');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('no subscriptions → no dispatcher calls + no throw', async () => {
    getSubsSpy.mockResolvedValueOnce([]);
    await svc.SendForEvent(1, ENotificationEvent.DeploymentSucceeded, makePayload());
    expect(discordSendSpy).not.toHaveBeenCalled();
    expect(slackSendSpy).not.toHaveBeenCalled();
  });

  it('two subscriptions, one dispatcher fails → other still runs', async () => {
    const channel = (id: number, name: string) => ({
      Id: id,
      Name: name,
      ProviderId: 99,
      DeliveryConfigEncrypted: 'enc',
      Iv: 'iv',
      AuthTag: 'tag',
      IsActive: true,
    });
    const provider = (type: ENotificationProviderType) => ({
      Id: 99,
      Name: 'p',
      Type: type,
      ConfigEncrypted: 'enc',
      Iv: 'iv',
      AuthTag: 'tag',
      IsActive: true,
    });

    getSubsSpy.mockResolvedValueOnce([
      { channel: channel(1, 'discord-1'), provider: provider(ENotificationProviderType.Discord) },
      { channel: channel(2, 'slack-1'), provider: provider(ENotificationProviderType.Slack) },
    ]);
    providerDecryptSpy.mockReturnValue({ webhookRoot: 'https://x', webhookUrl: 'https://x' });
    channelDecryptSpy.mockReturnValue({ channel: '#deploys' });

    discordSendSpy.mockRejectedValueOnce(new Error('rate limited'));
    slackSendSpy.mockResolvedValueOnce(undefined);

    await svc.SendForEvent(1, ENotificationEvent.DeploymentSucceeded, makePayload());

    expect(discordSendSpy).toHaveBeenCalledTimes(1);
    expect(slackSendSpy).toHaveBeenCalledTimes(1);
  });

  it('subscription lookup throws → returns quietly without firing dispatchers', async () => {
    getSubsSpy.mockRejectedValueOnce(new Error('db down'));
    await expect(
      svc.SendForEvent(1, ENotificationEvent.DeploymentSucceeded, makePayload())
    ).resolves.toBeUndefined();
    expect(discordSendSpy).not.toHaveBeenCalled();
    expect(slackSendSpy).not.toHaveBeenCalled();
  });
});
