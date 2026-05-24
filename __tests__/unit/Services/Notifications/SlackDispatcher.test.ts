/**
 * SlackDispatcher unit tests — Deploy Center v3.0 / F-002 (T075).
 * The @slack/webhook IncomingWebhook class is mocked.
 */

import { SlackDispatcher } from '@Services/Notifications/SlackDispatcher';
import {
  ENotificationEvent,
  EDeploymentStatus,
} from '@Types/ICommon';
import type {
  INotificationPayload,
} from '@Services/Notifications/INotificationDispatcher';

const sendMock = jest.fn();
jest.mock('@slack/webhook', () => ({
  IncomingWebhook: jest.fn().mockImplementation(() => ({ send: sendMock })),
}));

const samplePayload: INotificationPayload = {
  Event: ENotificationEvent.DeploymentFailed,
  Status: EDeploymentStatus.Failed,
  ProjectId: 7,
  ProjectName: 'api',
  DeploymentId: 9,
  Branch: 'main',
  CommitHash: 'b'.repeat(40),
  CommitMessage: 'broken build',
  Author: 'sabry',
  Duration: 3,
  Error: 'exit code 1',
};

describe('SlackDispatcher', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('sends an attachment with channel + project fields', async () => {
    sendMock.mockResolvedValueOnce({ text: 'ok' });
    const d = new SlackDispatcher();

    await d.Send(
      { webhookUrl: 'https://hooks.slack.test/T/B/X' },
      { channel: '#deploys' },
      samplePayload
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0]![0] as {
      channel: string;
      attachments: Array<{ fields: Array<{ title: string }> }>;
    };
    expect(arg.channel).toBe('#deploys');
    const titles = arg.attachments[0]!.fields.map((f) => f.title);
    expect(titles).toEqual(expect.arrayContaining(['Project', 'Branch', 'Commit', 'Error']));
  });

  it('throws when webhookUrl is missing (bot-token-only path not supported in v3.0)', async () => {
    const d = new SlackDispatcher();
    await expect(
      d.Send({}, { channel: '#deploys' }, samplePayload)
    ).rejects.toThrow(/webhookUrl/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('propagates webhook send failure', async () => {
    sendMock.mockRejectedValueOnce(new Error('invalid_payload'));
    const d = new SlackDispatcher();
    await expect(
      d.Send(
        { webhookUrl: 'https://hooks.slack.test/T/B/X' },
        { channel: '#deploys' },
        samplePayload
      )
    ).rejects.toThrow(/invalid_payload/);
  });
});
