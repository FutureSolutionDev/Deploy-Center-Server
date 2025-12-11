-- Fix All ENUM values to match application code
-- This script updates ENUM columns to match the TypeScript enum definitions
-- Run this script against your MySQL/MariaDB database

-- 1. Fix Deployments.Status ENUM
ALTER TABLE `Deployments`
MODIFY COLUMN `Status` ENUM(
  'queued',
  'pending',
  'inProgress',
  'success',
  'failed',
  'cancelled',
  'rolled_back'
) NOT NULL;

-- 2. Fix Deployments.TriggerType ENUM
ALTER TABLE `Deployments`
MODIFY COLUMN `TriggerType` ENUM(
  'webhook',
  'manual',
  'scheduled'
) NOT NULL;

-- 3. Fix Projects.ProjectType ENUM
ALTER TABLE `Projects`
MODIFY COLUMN `ProjectType` ENUM(
  'node',
  'react',
  'static',
  'docker',
  'nextjs',
  'other'
) NOT NULL;

-- 4. Fix DeploymentSteps.Status ENUM
ALTER TABLE `DeploymentSteps`
MODIFY COLUMN `Status` ENUM(
  'pending',
  'running',
  'success',
  'failed',
  'skipped'
) NOT NULL;

-- 5. Fix Users.Role ENUM
ALTER TABLE `Users`
MODIFY COLUMN `Role` ENUM(
  'admin',
  'developer',
  'viewer'
) NOT NULL DEFAULT 'viewer';

-- Verify all changes
SELECT
  'Deployments.Status' as TableColumn,
  COLUMN_TYPE as EnumValues
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Deployments' AND COLUMN_NAME = 'Status'
UNION ALL
SELECT
  'Deployments.TriggerType',
  COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Deployments' AND COLUMN_NAME = 'TriggerType'
UNION ALL
SELECT
  'Projects.ProjectType',
  COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Projects' AND COLUMN_NAME = 'ProjectType'
UNION ALL
SELECT
  'DeploymentSteps.Status',
  COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DeploymentSteps' AND COLUMN_NAME = 'Status'
UNION ALL
SELECT
  'Users.Role',
  COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Role';
