/**
 * Migration 023 (v3.0.1 — SEC-H4): give every project creator an explicit
 * owner membership.
 *
 * Access used to fall back to Projects.CreatedBy for projects created before
 * ProjectMembers existed, so removing the creator from a project did not take
 * their access away. After this backfill, access is decided by membership
 * alone. Idempotent: only creators without a membership row get one.
 */

import { QueryInterface, QueryTypes } from 'sequelize';
import Logger from '@Utils/Logger';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const [, inserted] = (await queryInterface.sequelize.query(
    `INSERT INTO ProjectMembers (ProjectId, UserId, Role, AddedBy, AddedAt, CreatedAt, UpdatedAt)
     SELECT p.Id, p.CreatedBy, 'owner', p.CreatedBy, NOW(), NOW(), NOW()
     FROM Projects p
     JOIN Users u ON u.Id = p.CreatedBy
     WHERE p.CreatedBy IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM ProjectMembers m WHERE m.ProjectId = p.Id AND m.UserId = p.CreatedBy
       )`,
    { type: QueryTypes.INSERT }
  )) as [unknown, number];
  Logger.Info(`Migration 023: added ${inserted ?? 0} creator memberships`);
};

export const down = async (): Promise<void> => {
  // The backfilled rows cannot be told apart from memberships added later, so
  // they stay. Access without them would fall back to nothing, not to more.
  Logger.Info('Migration 023: down keeps the creator memberships');
};
