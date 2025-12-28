/**
 * Project Service
 * Handles project CRUD operations and management
 * Following SOLID principles and PascalCase naming convention
 */

import { Project, ProjectMember, User } from '@Models/index';
import Logger from '@Utils/Logger';
import EncryptionHelper, { type IEncryptedData } from '@Utils/EncryptionHelper';
import SshKeyGenerator from '@Utils/SshKeyGenerator';
import AuditLogService from '@Services/AuditLogService';
import { IProjectConfigJson } from '@Types/IDatabase';
import { EProjectType, EDeploymentStatus } from '@Types/ICommon';
import DatabaseConnection from '@Database/DatabaseConnection';
import { QueryTypes } from 'sequelize';
import { Request } from 'express';
export interface ICreateProjectData {
  Name: string;
  RepoUrl: string;
  Branch: string;
  ProjectPath: string;
  ProjectType: EProjectType;
  Config: IProjectConfigJson;
  CreatedBy: number; // User ID of the creator
}

export interface IUpdateProjectData {
  Name?: string;
  RepoUrl?: string;
  Branch?: string;
  ProjectPath?: string;
  ProjectType?: EProjectType;
  IsActive?: boolean;
  Config?: IProjectConfigJson;
}

export class ProjectService {
  /**
   * Get all projects
   */
  public async GetAllProjects(includeInactive: boolean = false): Promise<Project[]> {
    try {
      const where: any = {};
      if (!includeInactive) {
        where.IsActive = true;
      }

      const projects = await Project.findAll({ where });
      return projects;
    } catch (error) {
      Logger.Error('Failed to get all projects', error as Error);
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  public async GetProjectById(projectId: number): Promise<Project | null> {
    try {
      const project = await Project.findByPk(projectId);
      return project;
    } catch (error) {
      Logger.Error('Failed to get project by ID', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Get project by name
   */
  public async GetProjectByName(name: string): Promise<Project | null> {
    try {
      const project = await Project.findOne({ where: { Name: name } });
      return project;
    } catch (error) {
      Logger.Error('Failed to get project by name', error as Error, { name });
      throw error;
    }
  }

  /**
   * Create a new project
   */
  public async CreateProject(data: ICreateProjectData): Promise<Project> {
    try {
      // Check if project with same name exists
      const existingProject = await this.GetProjectByName(data.Name);
      if (existingProject) {
        throw new Error('Project with this name already exists');
      }

      // Generate webhook secret
      const webhookSecret = EncryptionHelper.GenerateRandomString(32);

      // Create project
      const project = await Project.create({
        Name: data.Name,
        RepoUrl: data.RepoUrl,
        Branch: data.Branch,
        ProjectPath: data.ProjectPath,
        ProjectType: data.ProjectType,
        WebhookSecret: webhookSecret,
        IsActive: true,
        Config: data.Config,
        CreatedBy: data.CreatedBy,
      } as any);

      Logger.Info(`Project created successfully: ${project.Name}`, { projectId: project.Id });
      return project;
    } catch (error) {
      Logger.Error('Failed to create project', error as Error, { projectName: data.Name });
      throw error;
    }
  }

  /**
   * Update a project
   */
  public async UpdateProject(projectId: number, data: IUpdateProjectData): Promise<Project> {
    try {
      const project = await this.GetProjectById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Check if name is being changed and if it conflicts
      if (data.Name && data.Name !== project.Name) {
        const existingProject = await this.GetProjectByName(data.Name);
        if (existingProject) {
          throw new Error('Project with this name already exists');
        }
      }

      // Update project
      await project.update(data);

      Logger.Info(`Project updated successfully: ${project.Name}`, { projectId: project.Id });
      return project;
    } catch (error) {
      Logger.Error('Failed to update project', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Delete a project (soft delete - set inactive)
   */
  public async DeleteProject(projectId: number): Promise<void> {
    try {
      const project = await this.GetProjectById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Soft delete
      await project.update({ IsActive: false });

      Logger.Info(`Project deleted successfully: ${project.Name}`, { projectId: project.Id });
    } catch (error) {
      Logger.Error('Failed to delete project', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Regenerate webhook secret
   */
  public async RegenerateWebhookSecret(projectId: number): Promise<string> {
    try {
      const project = await this.GetProjectById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      const newSecret = EncryptionHelper.GenerateRandomString(32);
      await project.update({ WebhookSecret: newSecret });

      Logger.Info(`Webhook secret regenerated for project: ${project.Name}`, {
        projectId: project.Id,
      });

      return newSecret;
    } catch (error) {
      Logger.Error('Failed to regenerate webhook secret', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Get project statistics
   */
  // public async GetProjectStatistics(projectId: number): Promise<{
  //   TotalDeployments: number;
  //   SuccessfulDeployments: number;
  //   FailedDeployments: number;
  //   SuccessRate: number;
  //   AverageDuration: number;
  //   DeploymentsByDay: any;
  // }> {
  //   try {
  //     const project = await this.GetProjectById(projectId);

  //     if (!project) {
  //       throw new Error('Project not found');
  //     }
  //     // Get deployments for this project

  //     const allDeployments = await Deployment.findAll({
  //       where: { ProjectId: projectId },
  //     });

  //     const totalDeployments = allDeployments.length;
  //     const successfulDeployments = allDeployments.filter(
  //       (d) => d.Status === EDeploymentStatus.Success
  //     ).length;
  //     const failedDeployments = allDeployments.filter(
  //       (d) => d.Status === EDeploymentStatus.Failed
  //     ).length;
  //     const successRate =
  //       totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;
  //     const completedDeployments = allDeployments.filter((d) => d.Duration !== null);
  //     const averageDuration =
  //       completedDeployments.length > 0
  //         ? completedDeployments.reduce((sum, d) => sum + (d.Duration || 0), 0) /
  //           completedDeployments.length
  //         : 0;
  //     const DeploymentsByDay = await Deployment.findAll({
  //       where: { ProjectId: projectId },
  //       attributes: ['CreatedAt', 'Status'],
  //       group: ['CreatedAt', 'Status'],
  //     });
  //     return {
  //       TotalDeployments: totalDeployments,
  //       SuccessfulDeployments: successfulDeployments,
  //       FailedDeployments: failedDeployments,
  //       SuccessRate: Math.round(successRate * 100) / 100,
  //       AverageDuration: Math.round(averageDuration * 100) / 100,
  //       DeploymentsByDay: DeploymentsByDay,
  //     };
  //   } catch (error) {
  //     Logger.Error('Failed to get project statistics', error as Error, { projectId });
  //     throw error;
  //   }
  // }
  public async GetProjectStatistics(projectId: number): Promise<{
    TotalDeployments: number;
    SuccessfulDeployments: number;
    FailedDeployments: number;
    SuccessRate: number;
    AverageDuration: number;
    DeploymentsByDay: {
      Date: string;
      Success: number;
      Failed: number;
    }[];
  }> {
    try {
      const project = await this.GetProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const sequelize = DatabaseConnection.GetInstance();

      // 🔹 1. Global statistics
      const statsResult = await sequelize.query<{
        TotalDeployments: number;
        SuccessfulDeployments: number;
        FailedDeployments: number;
        SuccessRate: number;
        AverageDuration: number;
      }>(
        `
      SELECT
        COUNT(*)                                   AS TotalDeployments,
        SUM(Status = :success)                    AS SuccessfulDeployments,
        SUM(Status = :failed)                     AS FailedDeployments,
        ROUND(
          (SUM(Status = :success) / NULLIF(COUNT(*), 0)) * 100,
          2
        )                                         AS SuccessRate,
        ROUND(AVG(Duration), 2)                   AS AverageDuration
      FROM Deployments
      WHERE ProjectId = :projectId
      `,
        {
          replacements: {
            projectId,
            success: EDeploymentStatus.Success,
            failed: EDeploymentStatus.Failed,
          },
          type: QueryTypes.SELECT,
        }
      );

      const summary = statsResult[0] ?? {
        TotalDeployments: 0,
        SuccessfulDeployments: 0,
        FailedDeployments: 0,
        SuccessRate: 0,
        AverageDuration: 0,
      };

      // 🔹 2. Deployments by day (Chart)
      const deploymentsByDay = await sequelize.query<{
        Date: string;
        Success: number;
        Failed: number;
      }>(
        `
      SELECT
        DATE(CreatedAt)                           AS Date,
        SUM(Status = :success)                    AS Success,
        SUM(Status = :failed)                     AS Failed
      FROM Deployments
      WHERE ProjectId = :projectId
      GROUP BY DATE(CreatedAt)
      ORDER BY Date ASC
      `,
        {
          replacements: {
            projectId,
            success: EDeploymentStatus.Success,
            failed: EDeploymentStatus.Failed,
          },
          type: QueryTypes.SELECT,
        }
      );

      return {
        TotalDeployments: Number(summary.TotalDeployments),
        SuccessfulDeployments: Number(summary.SuccessfulDeployments),
        FailedDeployments: Number(summary.FailedDeployments),
        SuccessRate: Number(summary.SuccessRate),
        AverageDuration: Number(summary.AverageDuration),
        DeploymentsByDay: deploymentsByDay,
      };
    } catch (error) {
      Logger.Error('Failed to get project statistics', error as Error, { projectId });
      throw error;
    }
  }

  // ========================================
  // SSH KEY MANAGEMENT METHODS
  // ========================================

  /**
   * Generate SSH key for project
   *
   * SECURITY FLOW:
   * 1. Generate ED25519/RSA key pair
   * 2. Encrypt private key with AES-256-GCM
   * 3. Store encrypted key in database
   * 4. Return public key for user to add to GitHub
   *
   * @param projectId - Project ID
   * @param options - Generation options
   * @returns Public key, fingerprint, and key type
   */
  public async GenerateSshKey(
    projectId: number,
    options: {
      keyType?: 'ed25519' | 'rsa';
    } = {}
  ): Promise<{
    publicKey: string;
    fingerprint: string;
    keyType: 'ed25519' | 'rsa';
  }> {
    try {
      const project = await this.GetProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check if project already has SSH key
      if (project.SshKeyEncrypted) {
        throw new Error(
          'Project already has an SSH key. Use RegenerateSshKey to rotate it.'
        );
      }

      Logger.Info('Generating SSH key for project', {
        projectId,
        projectName: project.Name,
        keyType: options.keyType || 'ed25519',
      });

      // STEP 1: Generate key pair
      const keyType = options.keyType || 'ed25519';
      const keyPair =
        keyType === 'ed25519'
          ? await SshKeyGenerator.GenerateEd25519KeyPair(
              `deploy-center-${project.Name}`
            )
          : await SshKeyGenerator.GenerateRsaKeyPair(
              4096,
              `deploy-center-${project.Name}`
            );

      // STEP 2: Encrypt private key
      const encryptedKey = EncryptionHelper.Encrypt(keyPair.privateKey);

      // STEP 3: Update project with encrypted key
      await project.update({
        SshKeyEncrypted: encryptedKey.Encrypted,
        SshKeyIv: encryptedKey.Iv,
        SshKeyAuthTag: encryptedKey.AuthTag,
        SshPublicKey: keyPair.publicKey,
        SshKeyFingerprint: keyPair.fingerprint,
        SshKeyType: keyPair.keyType,
        SshKeyCreatedAt: new Date(),
        SshKeyRotatedAt: null,
        UseSshKey: true,
      });

      Logger.Info('SSH key generated successfully', {
        projectId,
        fingerprint: keyPair.fingerprint.substring(0, 16) + '...',
        keyType: keyPair.keyType,
      });

      // STEP 4: Return public key info
      return {
        publicKey: keyPair.publicKey,
        fingerprint: keyPair.fingerprint,
        keyType: keyPair.keyType,
      };
    } catch (error) {
      Logger.Error('Failed to generate SSH key', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Regenerate (rotate) SSH key for project
   *
   * This will:
   * 1. Delete old key
   * 2. Generate new key
   * 3. Update database
   * 4. Return new public key for user to update in GitHub
   *
   * @param projectId - Project ID
   * @param options - Options for key generation (keyType to override existing type)
   * @returns New public key and fingerprint
   */
  public async RegenerateSshKey(
    projectId: number,
    options: {
      keyType?: 'ed25519' | 'rsa';
    } = {}
  ): Promise<{
    publicKey: string;
    fingerprint: string;
    keyType: 'ed25519' | 'rsa';
  }> {
    try {
      const project = await this.GetProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      if (!project.SshKeyEncrypted) {
        throw new Error('Project does not have an SSH key. Use GenerateSshKey first.');
      }

      const oldFingerprint = project.SshKeyFingerprint;
      const oldKeyType = project.SshKeyType;
      // Allow overriding key type, otherwise use existing type
      const keyType = options.keyType || project.SshKeyType || 'ed25519';

      Logger.Info('Regenerating SSH key for project', {
        projectId,
        projectName: project.Name,
        oldFingerprint: oldFingerprint?.substring(0, 16) + '...',
        oldKeyType,
        newKeyType: keyType,
      });

      // Generate new key pair
      const keyPair =
        keyType === 'ed25519'
          ? await SshKeyGenerator.GenerateEd25519KeyPair(
              `deploy-center-${project.Name}`
            )
          : await SshKeyGenerator.GenerateRsaKeyPair(
              4096,
              `deploy-center-${project.Name}`
            );

      // Encrypt new private key
      const encryptedKey = EncryptionHelper.Encrypt(keyPair.privateKey);

      // Update project with new key
      await project.update({
        SshKeyEncrypted: encryptedKey.Encrypted,
        SshKeyIv: encryptedKey.Iv,
        SshKeyAuthTag: encryptedKey.AuthTag,
        SshPublicKey: keyPair.publicKey,
        SshKeyFingerprint: keyPair.fingerprint,
        SshKeyType: keyPair.keyType,
        SshKeyRotatedAt: new Date(),
      });

      Logger.Info('SSH key regenerated successfully', {
        projectId,
        oldFingerprint: oldFingerprint?.substring(0, 16) + '...',
        newFingerprint: keyPair.fingerprint.substring(0, 16) + '...',
      });

      return {
        publicKey: keyPair.publicKey,
        fingerprint: keyPair.fingerprint,
        keyType: keyPair.keyType,
      };
    } catch (error) {
      Logger.Error('Failed to regenerate SSH key', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Delete SSH key from project
   *
   * Clears all SSH key fields and disables SSH authentication
   *
   * @param projectId - Project ID
   */
  public async DeleteSshKey(projectId: number): Promise<void> {
    try {
      const project = await this.GetProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      if (!project.SshKeyEncrypted) {
        throw new Error('Project does not have an SSH key');
      }

      Logger.Info('Deleting SSH key for project', {
        projectId,
        projectName: project.Name,
        fingerprint: project.SshKeyFingerprint?.substring(0, 16) + '...',
      });

      // Clear all SSH key fields
      await project.update({
        SshKeyEncrypted: null,
        SshKeyIv: null,
        SshKeyAuthTag: null,
        SshPublicKey: null,
        SshKeyFingerprint: null,
        SshKeyType: null,
        SshKeyCreatedAt: null,
        SshKeyRotatedAt: null,
        GitHubDeployKeyId: null,
        UseSshKey: false,
      });

      Logger.Info('SSH key deleted successfully', { projectId });
    } catch (error) {
      Logger.Error('Failed to delete SSH key', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Get decrypted SSH private key (for internal use ONLY during deployment)
   *
   * SECURITY WARNING:
   * - This method should ONLY be called by DeploymentService
   * - Key must be used immediately and deleted
   * - Never expose this via API endpoints
   *
   * @param projectId - Project ID
   * @returns Decrypted private key or null if not configured
   */
  public async GetDecryptedSshKey(projectId: number): Promise<string | null> {
    try {
      const project = await this.GetProjectById(projectId);
      if (!project || !project.UseSshKey || !project.SshKeyEncrypted) {
        return null;
      }

      // Decrypt private key IN MEMORY
      const encryptedData: IEncryptedData = {
        Encrypted: project.SshKeyEncrypted,
        Iv: project.SshKeyIv!,
        AuthTag: project.SshKeyAuthTag!,
      };

      const privateKey = EncryptionHelper.Decrypt(encryptedData);

      Logger.Debug('SSH key decrypted for deployment', {
        projectId,
        fingerprint: project.SshKeyFingerprint?.substring(0, 16) + '...',
      });

      return privateKey;
    } catch (error) {
      Logger.Error('Failed to decrypt SSH key', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Get SSH public key info (safe to expose)
   *
   * @param projectId - Project ID
   * @returns Public key information
   */
  public async GetSshPublicKeyInfo(projectId: number): Promise<{
    publicKey: string;
    fingerprint: string;
    keyType: string;
    createdAt: Date;
    rotatedAt: Date | null;
  } | null> {
    try {
      const project = await this.GetProjectById(projectId);
      if (!project || !project.SshPublicKey) {
        return null;
      }

      return {
        publicKey: project.SshPublicKey,
        fingerprint: project.SshKeyFingerprint!,
        keyType: project.SshKeyType!,
        createdAt: project.SshKeyCreatedAt!,
        rotatedAt: project.SshKeyRotatedAt,
      };
    } catch (error) {
      Logger.Error('Failed to get SSH public key info', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Toggle SSH key usage for project
   *
   * @param projectId - Project ID
   * @param enabled - Enable or disable SSH authentication
   */
  public async ToggleSshKeyUsage(
    projectId: number,
    enabled: boolean
  ): Promise<void> {
    try {
      const project = await this.GetProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      if (enabled && !project.SshKeyEncrypted) {
        throw new Error(
          'Cannot enable SSH authentication: No SSH key configured for this project'
        );
      }

      await project.update({ UseSshKey: enabled });

      Logger.Info(
        `SSH authentication ${enabled ? 'enabled' : 'disabled'} for project`,
        {
          projectId,
          projectName: project.Name,
        }
      );
    } catch (error) {
      Logger.Error('Failed to toggle SSH key usage', error as Error, {
        projectId,
        enabled,
      });
      throw error;
    }
  }

  // ========================================
  // PROJECT MEMBER MANAGEMENT
  // ========================================

  /**
   * Get all members of a project
   */
  public async GetProjectMembers(projectId: number): Promise<any[]> {
    try {
      const project = await Project.findByPk(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const members = await ProjectMember.findAll({
        where: { ProjectId: projectId },
        include: [
          {
            model: User,
            as: 'User',
            attributes: ['UserId', 'Username', 'Email', 'Role'],
          },
        ],
        order: [
          ['Role', 'ASC'], // owners first
          ['AddedAt', 'ASC'],
        ],
      });

      return members.map((member) => member.toJSON());
    } catch (error) {
      Logger.Error('Failed to get project members', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Add a member to a project
   */
  public async AddProjectMember(
    projectId: number,
    userId: number,
    role: 'owner' | 'member',
    addedBy: number,
    req: Request
  ): Promise<any> {
    try {
      // Verify project exists
      const project = await Project.findByPk(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Verify user exists
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is already a member
      const existingMember = await ProjectMember.findOne({
        where: {
          ProjectId: projectId,
          UserId: userId,
        },
      });

      if (existingMember) {
        throw new Error('User is already a member of this project');
      }

      // Add member
      const member = await ProjectMember.create({
        ProjectId: projectId,
        UserId: userId,
        Role: role,
        AddedBy: addedBy,
      });

      // Record audit log
      await AuditLogService.RecordMemberAddition(
        req,
        projectId,
        userId,
        user.Email,
        role
      );

      Logger.Info('Member added to project', {
        projectId,
        userId,
        role,
        addedBy,
      });

      return member.toJSON();
    } catch (error) {
      Logger.Error('Failed to add project member', error as Error, {
        projectId,
        userId,
        role,
      });
      throw error;
    }
  }

  /**
   * Remove a member from a project
   */
  public async RemoveProjectMember(
    projectId: number,
    userId: number,
    req: Request
  ): Promise<void> {
    try {
      // Verify project exists
      const project = await Project.findByPk(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Find member
      const member = await ProjectMember.findOne({
        where: {
          ProjectId: projectId,
          UserId: userId,
        },
        include: [
          {
            model: User,
            as: 'User',
            attributes: ['Email'],
          },
        ],
      });

      if (!member) {
        throw new Error('User is not a member of this project');
      }

      const memberData = member.toJSON();

      // Prevent removing the last owner
      if (memberData.Role === 'owner') {
        const ownerCount = await ProjectMember.count({
          where: {
            ProjectId: projectId,
            Role: 'owner',
          },
        });

        if (ownerCount <= 1) {
          throw new Error('Cannot remove the last owner of the project');
        }
      }

      // Get user email for audit log
      const user = await User.findByPk(userId);
      const userEmail = user ? user.Email : 'Unknown';

      // Remove member
      await member.destroy();

      // Record audit log
      await AuditLogService.RecordMemberRemoval(req, projectId, userId, userEmail);

      Logger.Info('Member removed from project', {
        projectId,
        userId,
      });
    } catch (error) {
      Logger.Error('Failed to remove project member', error as Error, {
        projectId,
        userId,
      });
      throw error;
    }
  }
}

export default ProjectService;
