/**
 * EmailDispatcher unit tests — Deploy Center v3.0 / F-002 (T075).
 * nodemailer.createTransport is mocked.
 */

import { EmailDispatcher } from '@Services/Notifications/EmailDispatcher';
import {
  ENotificationEvent,
  EDeploymentStatus,
} from '@Types/ICommon';
import type {
  INotificationPayload,
} from '@Services/Notifications/INotificationDispatcher';

const sendMailMock = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

const samplePayload: INotificationPayload = {
  Event: ENotificationEvent.DeploymentStarted,
  Status: EDeploymentStatus.InProgress,
  ProjectId: 3,
  ProjectName: 'web',
  DeploymentId: 18,
  Branch: 'main',
  CommitHash: 'c'.repeat(40),
};

const baseProvider = {
  host: 'smtp.test',
  port: 587,
  secure: false,
  user: 'u',
  password: 'p',
  from: 'noreply@test.local',
};

describe('EmailDispatcher', () => {
  beforeEach(() => {
    sendMailMock.mockReset();
  });

  it('sends one email when recipient count ≤ batch size', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'abc' });
    const d = new EmailDispatcher();
    await d.Send(baseProvider, { recipients: ['a@x.test', 'b@x.test'] }, samplePayload);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0]![0].to).toBe('a@x.test, b@x.test');
  });

  it('chunks at 50 recipients per send', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'x' });
    const recipients = Array.from({ length: 120 }, (_, i) => `r${i}@test`);
    const d = new EmailDispatcher();
    await d.Send(baseProvider, { recipients }, samplePayload);
    expect(sendMailMock).toHaveBeenCalledTimes(3); // 50 + 50 + 20
  });

  it('throws when recipients list is empty', async () => {
    const d = new EmailDispatcher();
    await expect(
      d.Send(baseProvider, { recipients: [] }, samplePayload)
    ).rejects.toThrow(/recipients/);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('throws when provider host/from are missing', async () => {
    const d = new EmailDispatcher();
    await expect(
      d.Send(
        { ...baseProvider, host: '' },
        { recipients: ['a@x.test'] },
        samplePayload
      )
    ).rejects.toThrow(/host or from/);
  });
});
