/**
 * Migration 017: create ProjectTemplates table + seed 5 built-ins — v3.0 F-008.
 *
 * - Schema matches data-model.md §8.
 * - Up: creates the table, then INSERTs 5 read-only built-ins
 *   (IsBuiltIn=true, CreatedBy=NULL). Built-ins must be re-seedable safely;
 *   we de-duplicate by Name.
 * - Down: drops the table (seeds disappear with it).
 *
 * IsBuiltIn semantics: enforced at the service layer (built-ins can be read
 * but not updated/deleted). The migration only marks them.
 */

import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'ProjectTemplates';

interface ISeedTemplate {
  Name: string;
  Description: string;
  Icon: string;
  Category: 'backend' | 'frontend' | 'static' | 'other';
  DefaultConfig: Record<string, unknown>;
}

const SEED_TEMPLATES: ISeedTemplate[] = [
  {
    Name: 'Node.js Backend',
    Description: 'Express / Fastify API with PM2 process manager and npm install + restart pipeline.',
    Icon: 'NodeJS',
    Category: 'backend',
    DefaultConfig: {
      Branch: 'main',
      AutoDeploy: true,
      Variables: { NODE_ENV: 'production' },
      Pipeline: [
        { Name: 'Install dependencies', Run: ['npm ci --omit=dev'] },
        { Name: 'Stop existing', Run: ['pm2 stop {{ProjectName}} || true'] },
      ],
      PostDeploymentPipeline: [
        { Name: 'Start service', Run: ['pm2 start npm --name {{ProjectName}} -- start'] },
      ],
      SyncIgnorePatterns: ['node_modules', '.git', 'logs', 'tmp', '.env'],
    },
  },
  {
    Name: 'React SPA (Vite)',
    Description: 'Vite-built React single-page app served as static files (Nginx / Apache).',
    Icon: 'React',
    Category: 'frontend',
    DefaultConfig: {
      Branch: 'main',
      AutoDeploy: true,
      Variables: {},
      Pipeline: [
        { Name: 'Install', Run: ['npm ci'] },
        { Name: 'Build', Run: ['npm run build'] },
      ],
      BuildOutput: 'dist',
      SyncIgnorePatterns: ['node_modules', 'src', 'public', '.git', '.env'],
    },
  },
  {
    Name: 'Next.js',
    Description: 'Next.js production deployment with build, PM2 process, and standalone output sync.',
    Icon: 'NextJS',
    Category: 'frontend',
    DefaultConfig: {
      Branch: 'main',
      AutoDeploy: true,
      Variables: { NODE_ENV: 'production' },
      Pipeline: [
        { Name: 'Install', Run: ['npm ci'] },
        { Name: 'Build', Run: ['npm run build'] },
      ],
      PostDeploymentPipeline: [
        { Name: 'Restart Next', Run: ['pm2 restart {{ProjectName}} || pm2 start npm --name {{ProjectName}} -- start'] },
      ],
      SyncIgnorePatterns: ['node_modules', '.git', '.next/cache', '.env'],
    },
  },
  {
    Name: 'Static HTML',
    Description: 'Plain HTML/CSS/JS — no build step. Files are synced as-is to the deployment path.',
    Icon: 'HTML',
    Category: 'static',
    DefaultConfig: {
      Branch: 'main',
      AutoDeploy: true,
      Variables: {},
      Pipeline: [],
      SyncIgnorePatterns: ['.git', 'README.md', '.env'],
    },
  },
  {
    Name: 'Astro',
    Description: 'Astro static site (or SSR via adapter). Builds with `npm run build` and ships dist/.',
    Icon: 'Astro',
    Category: 'frontend',
    DefaultConfig: {
      Branch: 'main',
      AutoDeploy: true,
      Variables: {},
      Pipeline: [
        { Name: 'Install', Run: ['npm ci'] },
        { Name: 'Build', Run: ['npm run build'] },
      ],
      BuildOutput: 'dist',
      SyncIgnorePatterns: ['node_modules', 'src', 'public', '.git', '.env'],
    },
  },
];

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const tables = await queryInterface.showAllTables();
    const exists = tables.includes(TABLE) || tables.includes(TABLE.toLowerCase());

    if (!exists) {
      await queryInterface.createTable(
        TABLE,
        {
          Id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          Name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
          },
          Description: { type: DataTypes.TEXT, allowNull: true },
          Icon: { type: DataTypes.STRING(50), allowNull: true },
          Category: {
            type: DataTypes.ENUM('backend', 'frontend', 'static', 'other'),
            allowNull: false,
          },
          DefaultConfig: {
            type: DataTypes.JSON,
            allowNull: false,
            comment: 'Pre-filled IProjectConfigJson — pipeline, variables, ignore patterns.',
          },
          IsBuiltIn: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Built-ins are read-only — service layer rejects update/delete.',
          },
          CreatedBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            references: { model: 'Users', key: 'Id' },
            onDelete: 'SET NULL',
            comment: 'NULL for built-ins.',
          },
          CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
          UpdatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        },
        { transaction }
      );

      try {
        await queryInterface.addIndex(TABLE, ['Category'], {
          name: 'idx_project_templates_category',
          transaction,
        });
      } catch (e) {
        if (!(e as Error).message?.includes('Duplicate key name')) throw e;
      }

      console.log(`✅ Migration 017: ${TABLE} created`);
    } else {
      console.log(`ℹ️  Migration 017: ${TABLE} already exists, skipping table create`);
    }

    // ---- seed built-ins (idempotent by Name) ------------------------------
    const existingNames = (
      (await queryInterface.sequelize.query(
        `SELECT Name FROM \`${TABLE}\` WHERE IsBuiltIn = true`,
        { transaction, type: (await import('sequelize')).QueryTypes.SELECT }
      )) as Array<{ Name: string }>
    ).map((r) => r.Name);

    const toInsert = SEED_TEMPLATES.filter((t) => !existingNames.includes(t.Name)).map((t) => ({
      Name: t.Name,
      Description: t.Description,
      Icon: t.Icon,
      Category: t.Category,
      DefaultConfig: JSON.stringify(t.DefaultConfig),
      IsBuiltIn: true,
      CreatedBy: null,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
    }));

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert(TABLE, toInsert, { transaction });
      console.log(`✅ Migration 017: inserted ${toInsert.length} built-in template(s)`);
    } else {
      console.log('ℹ️  Migration 017: all built-in templates already seeded');
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 017 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.dropTable(TABLE, { transaction });
    console.log(`✅ Migration 017: ${TABLE} dropped`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 017 rollback failed:', error);
    throw error;
  }
};
