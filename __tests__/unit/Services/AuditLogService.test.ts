/**
 * AuditLogService unit tests — Deploy Center v3.0 / F-002 (T078).
 *
 * Verifies the project-scoped audit log API:
 *   - RecordAuditLog persists a row through the ProjectAuditLog model
 *   - Failures are swallowed (audit must never break the main flow)
 *   - RecordFromRequest aborts when req.user is missing (no crash, just warn)
 *
 * The ProjectAuditLog model is mocked end-to-end so no DB is required.
 */

jest.mock('@Models/index', () => ({
  ProjectAuditLog: { create: jest.fn() },
}));

import { AuditLogService } from '@Services/AuditLogService';
import { ProjectAuditLog } from '@Models/index';

const createMock = ProjectAuditLog.create as jest.Mock;

describe('AuditLogService', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('RecordAuditLog persists a project audit row with stringified Changes', async () => {
    createMock.mockResolvedValueOnce({ Id: 1 });
    await AuditLogService.RecordAuditLog({
      ProjectId: 7,
      UserId: 12,
      Action: 'create',
      EntityType: 'project',
      Changes: { description: 'Created', after: { x: 1 } },
      IpAddress: '127.0.0.1',
      UserAgent: 'jest',
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const row = createMock.mock.calls[0]![0];
    expect(row.ProjectId).toBe(7);
    expect(row.UserId).toBe(12);
    expect(row.Action).toBe('create');
    expect(typeof row.Changes).toBe('string');
    expect(JSON.parse(row.Changes).description).toBe('Created');
  });

  it('does not throw when the model.create rejects (audit must not break callers)', async () => {
    createMock.mockRejectedValueOnce(new Error('db down'));
    await expect(
      AuditLogService.RecordAuditLog({
        ProjectId: 1,
        UserId: 1,
        Action: 'update',
        EntityType: 'config',
        Changes: { description: 'noop' },
      })
    ).resolves.toBeUndefined();
  });

  it('RecordFromRequest aborts cleanly when req.user is missing', async () => {
    const req = { headers: {} } as unknown as Parameters<
      typeof AuditLogService.RecordFromRequest
    >[0];
    await AuditLogService.RecordFromRequest(req, 1, 'update', 'config', {
      description: 'no user',
    });
    expect(createMock).not.toHaveBeenCalled();
  });
});
