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
 *
 * NOTE on atomicity: we do NOT wrap enqueue + UPDATE + AuditLog in a SQL
 * transaction because the enqueue side-effect (BullMQ → Redis) is not
 * rollback-able from SQL. If we tried, an audit-INSERT failure would roll
 * back the UPDATE, and the next migration retry would re-enqueue the same
 * job into BullMQ — duplicating work. Instead, audit failures are swallowed
 * here (logged but not thrown) so the migration as a whole completes and
 * SequelizeMeta records it, preventing the duplicate-enqueue scenario.
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
    // Wrapped in try/catch so audit failure does not fail the migration —
    // see file-header NOTE on atomicity.
    try {
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
    } catch (auditErr) {
      console.warn(
        `⚠️  Migration 999: audit row insert failed (non-fatal): ${(auditErr as Error).message}`
      );
    }
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

  // Audit insert wrapped in try/catch — see file-header NOTE on atomicity.
  // We never want an audit failure to fail the migration because that would
  // cause SequelizeMeta to NOT record it, and the next run would try to
  // re-enqueue rows that are already in BullMQ.
  try {
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
  } catch (auditErr) {
    console.warn(
      `⚠️  Migration 999: audit row insert failed (non-fatal): ${(auditErr as Error).message}`
    );
  }

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
