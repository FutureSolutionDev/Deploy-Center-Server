/**
 * Migration 012: add Deployment.QueueJobId column (v3.0 F-001).
 * Adds a nullable VARCHAR(100) + reverse-lookup index.
 * Pre-v3.0 rows get NULL on up(); migration 999 backfills the
 * Pending/Queued subset by re-enqueueing into BullMQ.
 */

import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'Deployments';
const COLUMN = 'QueueJobId';
const INDEX = 'idx_deployments_queue_job_id';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const columns = (await queryInterface.describeTable(TABLE)) as Record<string, unknown>;
    if (!columns[COLUMN]) {
      await queryInterface.addColumn(
        TABLE,
        COLUMN,
        {
          type: DataTypes.STRING(100),
          allowNull: true,
          comment: 'BullMQ job id correlating this deployment to a queue job (v3.0 F-001)',
        },
        { transaction }
      );
      console.log(`✅ Migration 012: ${TABLE}.${COLUMN} added`);
    } else {
      console.log(`ℹ️  Migration 012: ${TABLE}.${COLUMN} already exists, skipping addColumn`);
    }

    try {
      await queryInterface.addIndex(TABLE, [COLUMN], {
        name: INDEX,
        transaction,
      });
      console.log(`✅ Migration 012: index ${INDEX} added`);
    } catch (error: unknown) {
      const msg = (error as Error).message ?? '';
      if (!msg.includes('Duplicate key name') && !msg.includes('already exists')) {
        throw error;
      }
      console.log(`ℹ️  Migration 012: index ${INDEX} already exists, skipping`);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 012 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    try {
      await queryInterface.removeIndex(TABLE, INDEX, { transaction });
      console.log(`✅ Migration 012: index ${INDEX} dropped`);
    } catch (err) {
      console.log(`ℹ️  Migration 012: index ${INDEX} not present, skipping`);
    }
    const columns = (await queryInterface.describeTable(TABLE)) as Record<string, unknown>;
    if (columns[COLUMN]) {
      await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
      console.log(`✅ Migration 012: ${TABLE}.${COLUMN} dropped`);
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 012 rollback failed:', error);
    throw error;
  }
};
