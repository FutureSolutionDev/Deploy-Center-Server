/**
 * Migration 999: one-shot v2.1 → v3.0 queue migration (F-001 FR-005).
 * Re-enqueues every Deployment whose Status is 'pending' or 'queued' and
 * whose QueueJobId is still NULL into BullMQ, then sets QueueJobId.
 *
 * Idempotent — the `QueueJobId IS NULL` WHERE clause means re-running
 * the migration (manually or after restore) skips rows already enqueued.
 * Writes ONE AuditLogs row reporting the count.
 *
 * Runs ONLY once per environment via MigrationRunner's SequelizeMeta tracking.
 * down() is a no-op (we cannot un-enqueue cleanly; documented).
 */

import { QueryInterface, QueryTypes } from 'sequelize';
import QueueService from '@Services/QueueService';

interface IPendingRow {
  Id: number;
  ProjectId: number;
}

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const sequelize = queryInterface.sequelize;

  const rows = (await sequelize.query(
    `SELECT Id, ProjectId
       FROM Deployments
      WHERE Status IN ('pending','queued')
        AND QueueJobId IS NULL`,
    { type: QueryTypes.SELECT }
  )) as IPendingRow[];

  if (rows.length === 0) {
    console.log('ℹ️  Migration 999: no v2.1 pending deployments to migrate');
    // Still write the audit row so we have a record the migration executed.
    await sequelize.query(
      `INSERT INTO AuditLogs
         (UserId, Action, ResourceType, ResourceId, Details, CreatedAt)
       VALUES
         (NULL, 'SystemMigration', 'Deployment', NULL,
          JSON_OBJECT('migration','999_migrate_pending_deployments','count',0,
                      'message','no pending rows'),
          NOW())`,
      { type: QueryTypes.INSERT }
    );
    return;
  }

  const queue = QueueService.GetInstance();
  let enqueued = 0;
  const failures: Array<{ Id: number; error: string }> = [];

  for (const row of rows) {
    try {
      const jobId = await queue.Enqueue(row.Id, row.ProjectId, 0);
      await sequelize.query(
        `UPDATE Deployments SET QueueJobId = :jobId WHERE Id = :id AND QueueJobId IS NULL`,
        {
          type: QueryTypes.UPDATE,
          replacements: { jobId, id: row.Id },
        }
      );
      enqueued += 1;
    } catch (err) {
      const msg = (err as Error).message;
      failures.push({ Id: row.Id, error: msg });
      console.error(`❌ Migration 999: failed to enqueue deployment ${row.Id}: ${msg}`);
    }
  }

  await sequelize.query(
    `INSERT INTO AuditLogs
       (UserId, Action, ResourceType, ResourceId, Details, CreatedAt)
     VALUES
       (NULL, 'SystemMigration', 'Deployment', NULL,
        JSON_OBJECT('migration','999_migrate_pending_deployments',
                    'count', :count,
                    'failures', CAST(:failuresJson AS JSON),
                    'message','Migrated from v2.1 in-memory queue'),
        NOW())`,
    {
      type: QueryTypes.INSERT,
      replacements: {
        count: enqueued,
        failuresJson: JSON.stringify(failures),
      },
    }
  );

  console.log(`✅ Migration 999: re-enqueued ${enqueued}/${rows.length} pending deployments`);
};

/**
 * down() is intentionally a no-op — once jobs are in BullMQ, removing them
 * here would lose work. If a rollback to v2.1 is needed, the operator should
 * pause the worker and let in-flight jobs drain, then rollback the binary.
 */
export const down = async (_queryInterface: QueryInterface): Promise<void> => {
  console.log(
    'ℹ️  Migration 999: down() is a no-op (cannot un-enqueue BullMQ jobs safely)'
  );
};
