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
 * ProjectNotificationSubscription (F-006), which are global to the
 * deployment, not per-user.
 *
 * Down: restores the columns with their original v2.1 defaults so a
 * rollback to v2.1 still works. Any data that was previously stored is
 * GONE — restoring is a schema-only operation. Webhook URLs would need
 * to be re-entered in the v2.1 UI.
 */

import { QueryInterface, DataTypes } from 'sequelize';

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

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    // Use describeTable to make the migration idempotent — only drop a
    // column if it's still present. Re-running on a fresh schema (no
    // legacy columns) is a no-op.
    const existing = (await queryInterface.describeTable(TABLE)) as Record<string, unknown>;

    for (const col of COLUMNS_TO_DROP) {
      if (existing[col]) {
        await queryInterface.removeColumn(TABLE, col, { transaction });
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
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const existing = (await queryInterface.describeTable(TABLE)) as Record<string, unknown>;

    if (!existing.EmailNotifications) {
      await queryInterface.addColumn(
        TABLE,
        'EmailNotifications',
        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        { transaction }
      );
    }
    if (!existing.DiscordWebhookUrl) {
      await queryInterface.addColumn(
        TABLE,
        'DiscordWebhookUrl',
        { type: DataTypes.STRING(500), allowNull: true },
        { transaction }
      );
    }
    if (!existing.SlackWebhookUrl) {
      await queryInterface.addColumn(
        TABLE,
        'SlackWebhookUrl',
        { type: DataTypes.STRING(500), allowNull: true },
        { transaction }
      );
    }
    if (!existing.NotifyOnSuccess) {
      await queryInterface.addColumn(
        TABLE,
        'NotifyOnSuccess',
        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        { transaction }
      );
    }
    if (!existing.NotifyOnFailure) {
      await queryInterface.addColumn(
        TABLE,
        'NotifyOnFailure',
        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        { transaction }
      );
    }
    if (!existing.NotifyOnProjectUpdate) {
      await queryInterface.addColumn(
        TABLE,
        'NotifyOnProjectUpdate',
        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        { transaction }
      );
    }
    if (!existing.NotifyOnSystemAlert) {
      await queryInterface.addColumn(
        TABLE,
        'NotifyOnSystemAlert',
        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        { transaction }
      );
    }

    console.log('✅ Migration 020: rollback re-added 7 legacy columns (data is empty)');
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 020 rollback failed:', error);
    throw error;
  }
};
