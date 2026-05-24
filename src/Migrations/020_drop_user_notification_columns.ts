/**
 * Migration 020: drop legacy per-user notification columns from UserSettings.
 *
 * v3.0 removes:
 *   - EmailNotifications
 *   - DiscordWebhookUrl
 *   - SlackWebhookUrl
 *   - NotifyOnSuccess
 *   - NotifyOnFailure
 *   - NotifyOnProjectUpdate
 *   - NotifyOnSystemAlert
 *
 * These were never read by the deployment notification fan-out path —
 * only the deleted /me/settings/notifications/test endpoint touched
 * the two webhook URLs (for ad-hoc test sends). All real notifications
 * now flow through NotificationProvider → NotificationChannel →
 * ProjectNotificationSubscription (F-006).
 *
 * Why raw SQL instead of queryInterface.removeColumn/addColumn:
 *   sequelize 6.x + the `mariadb` driver triggers
 *   `TypeError: Cannot delete property 'meta' of [object Array]`
 *   inside dialect's formatResults() when the column-mutation statement
 *   returns an array (rather than a meta-bearing object). Using
 *   sequelize.query() with QueryTypes.RAW bypasses that result-format
 *   step entirely. Same workaround as MigrationRunner.GetExecutedMigrations.
 *
 * Down: restores the columns with their original v2.1 defaults so a
 * rollback to v2.1 still works. Any data that was previously stored is
 * GONE — restoring is a schema-only operation. Webhook URLs would need
 * to be re-entered in the v2.1 UI.
 */

import { QueryInterface, QueryTypes } from 'sequelize';

const TABLE = 'UserSettings';

const COLUMNS_TO_DROP = [
  'EmailNotifications',
  'DiscordWebhookUrl',
  'SlackWebhookUrl',
  'NotifyOnSuccess',
  'NotifyOnFailure',
  'NotifyOnProjectUpdate',
  'NotifyOnSystemAlert',
];

/** v2.1 column DDL — used to rebuild dropped columns in down(). */
const COLUMN_DEFINITIONS: Record<string, string> = {
  EmailNotifications: 'BOOLEAN NOT NULL DEFAULT 1',
  DiscordWebhookUrl: 'VARCHAR(500) NULL',
  SlackWebhookUrl: 'VARCHAR(500) NULL',
  NotifyOnSuccess: 'BOOLEAN NOT NULL DEFAULT 1',
  NotifyOnFailure: 'BOOLEAN NOT NULL DEFAULT 1',
  NotifyOnProjectUpdate: 'BOOLEAN NOT NULL DEFAULT 1',
  NotifyOnSystemAlert: 'BOOLEAN NOT NULL DEFAULT 1',
};

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const sequelize = queryInterface.sequelize;
  const transaction = await sequelize.transaction();
  try {
    // Idempotency: describeTable returns a plain object, no mariadb bug here.
    const existing = (await queryInterface.describeTable(TABLE)) as Record<string, unknown>;

    for (const col of COLUMNS_TO_DROP) {
      if (existing[col]) {
        // Raw ALTER bypasses sequelize's mariadb formatResults bug.
        await sequelize.query(
          `ALTER TABLE \`${TABLE}\` DROP COLUMN \`${col}\``,
          { transaction, type: QueryTypes.RAW }
        );
        console.log(`✅ Migration 020: dropped ${TABLE}.${col}`);
      } else {
        console.log(`ℹ️  Migration 020: ${TABLE}.${col} already absent, skipping`);
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 020 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const sequelize = queryInterface.sequelize;
  const transaction = await sequelize.transaction();
  try {
    const existing = (await queryInterface.describeTable(TABLE)) as Record<string, unknown>;

    for (const col of COLUMNS_TO_DROP) {
      if (existing[col]) {
        console.log(`ℹ️  Migration 020 down: ${TABLE}.${col} already present, skipping`);
        continue;
      }
      const ddl = COLUMN_DEFINITIONS[col]!;
      await sequelize.query(
        `ALTER TABLE \`${TABLE}\` ADD COLUMN \`${col}\` ${ddl}`,
        { transaction, type: QueryTypes.RAW }
      );
      console.log(`✅ Migration 020 down: re-added ${TABLE}.${col}`);
    }

    console.log('✅ Migration 020: rollback re-added 7 legacy columns (data is empty)');
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 020 rollback failed:', error);
    throw error;
  }
};
