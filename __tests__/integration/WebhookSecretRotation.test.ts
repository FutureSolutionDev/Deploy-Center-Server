/**
 * Webhook secret rotation helper — v3.0.1 (post-SEC-C2 operational step).
 */

import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeProject } from '../helpers/factories';
import WebhookSecretRotationService, {
  WEBHOOK_SECRET_ROTATED,
} from '@Services/WebhookSecretRotationService';
import { AuditLog, Project } from '@Models/index';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('WebhookSecretRotationService', () => {
  let dbUp = false;

  beforeAll(async () => {
    dbUp = await dbReachable();
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (dbUp) await truncateAll();
  });

  const secretOf = async (id: number): Promise<string> =>
    (await Project.findByPk(id))!.get('WebhookSecret') as string;

  it('rotates a single project by id or name and audits it', async () => {
    if (!dbUp) return;
    const a = await makeProject();
    const b = await makeProject();
    const [beforeA, beforeB] = [await secretOf(a.Id), await secretOf(b.Id)];

    const byId = await WebhookSecretRotationService.Rotate({ Project: String(a.Id) });
    expect(byId).toHaveLength(1);
    expect(byId[0]!.WebhookSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(await secretOf(a.Id)).toBe(byId[0]!.WebhookSecret);
    expect(await secretOf(a.Id)).not.toBe(beforeA);
    expect(await secretOf(b.Id)).toBe(beforeB);

    await WebhookSecretRotationService.Rotate({ Project: b.Name });
    expect(await secretOf(b.Id)).not.toBe(beforeB);
    expect(await AuditLog.count({ where: { Action: WEBHOOK_SECRET_ROTATED } })).toBe(2);
  });

  it('rotates every project with distinct secrets', async () => {
    if (!dbUp) return;
    await makeProject();
    await makeProject();
    const rotated = await WebhookSecretRotationService.Rotate({ All: true });
    expect(rotated).toHaveLength(2);
    expect(new Set(rotated.map((r) => r.WebhookSecret)).size).toBe(2);
  });

  it('dry run changes nothing', async () => {
    if (!dbUp) return;
    const a = await makeProject();
    const before = await secretOf(a.Id);
    const result = await WebhookSecretRotationService.Rotate({ All: true, DryRun: true });
    expect(result[0]!.WebhookSecret).toBeNull();
    expect(await secretOf(a.Id)).toBe(before);
  });

  it('plans new secrets without changing any project', async () => {
    if (!dbUp) return;
    const a = await makeProject();
    const before = await secretOf(a.Id);
    const plan = await WebhookSecretRotationService.Plan({ Project: String(a.Id) });
    expect(plan[0]!.WebhookSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(await secretOf(a.Id)).toBe(before);
    await WebhookSecretRotationService.Apply(plan);
    expect(await secretOf(a.Id)).toBe(plan[0]!.WebhookSecret);
  });

  it('applies all planned secrets or none of them', async () => {
    if (!dbUp) return;
    const a = await makeProject();
    const before = await secretOf(a.Id);
    const plan = await WebhookSecretRotationService.Plan({ Project: String(a.Id) });
    const broken = [...plan, { ...plan[0]!, ProjectId: 2147483000 }];
    await expect(WebhookSecretRotationService.Apply(broken)).rejects.toThrow('no longer exists');
    expect(await secretOf(a.Id)).toBe(before);
  });

  it('requires an explicit target and a match', async () => {
    if (!dbUp) return;
    await expect(WebhookSecretRotationService.Rotate({})).rejects.toThrow();
    await expect(WebhookSecretRotationService.Rotate({ Project: 'nope' })).rejects.toThrow('No matching');
  });
});
