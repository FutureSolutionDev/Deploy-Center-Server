/**
 * Project Model
 * Following PascalCase naming convention and Sequelize best practices
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { IProjectAttributes, IProjectConfigJson } from '@Types/IDatabase';
import { EProjectType } from '@Types/ICommon';

export class Project extends Model<IProjectAttributes> {
  declare Id: number;
  declare Name: string;
  declare RepoUrl: string;
  declare Branch: string;
  declare ProjectPath: string;
  declare ProjectType: EProjectType;
  declare WebhookSecret: string;
  declare IsActive: boolean;
  declare Config: IProjectConfigJson;
  declare CreatedBy: number;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;

  // SSH Key Management Fields
  declare UseSshKey: boolean;
  declare SshKeyEncrypted: string | null;
  declare SshKeyIv: string | null;
  declare SshKeyAuthTag: string | null;
  declare SshPublicKey: string | null;
  declare SshKeyFingerprint: string | null;
  declare SshKeyType: 'ed25519' | 'rsa' | null;
  declare SshKeyCreatedAt: Date | null;
  declare SshKeyRotatedAt: Date | null;
  declare GitHubDeployKeyId: number | null;
}

Project.init(
  {
    Id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    Name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'Name',
    },
    RepoUrl: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'RepoUrl',
      validate: {
        isValidGitUrl(value: string) {
          // Accept HTTPS URLs: https://github.com/user/repo.git
          const httpsPattern = /^https?:\/\/.+\/.+\.git$/;
          // Accept SSH URLs: git@github.com:user/repo.git
          const sshPattern = /^git@.+:.+\.git$/;
          // Accept GitHub shorthand: git@github.com:user/repo (without .git)
          const sshPatternNoGit = /^git@.+:.+$/;
          // Accept HTTPS without .git extension
          const httpsPatternNoGit = /^https?:\/\/.+\/.+$/;

          if (
            !httpsPattern.test(value) &&
            !sshPattern.test(value) &&
            !sshPatternNoGit.test(value) &&
            !httpsPatternNoGit.test(value)
          ) {
            throw new Error(
              'Repository URL must be a valid Git URL (HTTPS or SSH format). ' +
                'Examples: https://github.com/user/repo.git OR git@github.com:user/repo.git'
            );
          }
        },
      },
    },
    Branch: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'master',
      field: 'Branch',
    },
    ProjectPath: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'ProjectPath',
    },
    ProjectType: {
      type: DataTypes.ENUM(...Object.values(EProjectType)),
      allowNull: false,
      field: 'ProjectType',
    },
    WebhookSecret: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'WebhookSecret',
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'IsActive',
    },
    Config: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'Config',
    },
    CreatedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'CreatedBy',
      references: {
        model: 'Users',
        key: 'Id',
      },
    },
    // SSH Key Management Fields
    UseSshKey: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'UseSshKey',
    },
    SshKeyEncrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'SshKeyEncrypted',
    },
    SshKeyIv: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'SshKeyIv',
    },
    SshKeyAuthTag: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'SshKeyAuthTag',
    },
    SshPublicKey: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'SshPublicKey',
    },
    SshKeyFingerprint: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'SshKeyFingerprint',
    },
    SshKeyType: {
      type: DataTypes.ENUM('ed25519', 'rsa'),
      allowNull: true,
      defaultValue: 'ed25519',
      field: 'SshKeyType',
    },
    SshKeyCreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'SshKeyCreatedAt',
    },
    SshKeyRotatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'SshKeyRotatedAt',
    },
    GitHubDeployKeyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'GitHubDeployKeyId',
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt',
    },
    UpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'UpdatedAt',
    },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'Projects',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      {
        name: 'idx_projects_name',
        unique: true,
        fields: ['Name'],
      },
      {
        name: 'idx_projects_is_active',
        fields: ['IsActive'],
      },
    ],
  }
);

export default Project;
