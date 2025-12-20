/**
 * Dashboard Controller
 * Handles dashboard summary and statistics HTTP requests
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response } from 'express';
import { Project, Deployment } from '@Models/index';
import { EDeploymentStatus } from '@Types/ICommon';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { Op } from 'sequelize';

export class DashboardController {
  /**
   * Get dashboard summary
   * GET /api/dashboard/summary
   *
   * Returns optimized summary data for dashboard:
   * - Total projects count
   * - Total deployments count
   * - Successful deployments count
   * - Failed deployments count
   * - Recent 5 deployments with project details
   */
  public GetDashboardSummary = async (_req: Request, res: Response): Promise<void> => {
    try {
      // Get counts in parallel
      const [
        totalProjects,
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        recentDeployments,
      ] = await Promise.all([
        // Count active projects only
        Project.count({
          where: { IsActive: true },
        }),

        // Count all deployments
        Deployment.count(),

        // Count successful deployments
        Deployment.count({
          where: { Status: EDeploymentStatus.Success },
        }),

        // Count failed deployments
        Deployment.count({
          where: { Status: EDeploymentStatus.Failed },
        }),

        // Get recent 5 deployments with project info
        Deployment.findAll({
          include: [
            {
              model: Project,
              as: 'Project',
              attributes: ['Id', 'Name', 'RepoUrl'],
            },
          ],
          order: [['CreatedAt', 'DESC']],
          limit: 5,
          attributes: [
            'Id',
            'ProjectId',
            'Status',
            'Branch',
            'CommitHash',
            'CommitMessage',
            'Author',
            'StartedAt',
            'CompletedAt',
            'Duration',
            'CreatedAt',
          ],
        }),
      ]);

      ResponseHelper.Success(res, 'Dashboard summary retrieved successfully', {
        Stats: {
          TotalProjects: totalProjects,
          TotalDeployments: totalDeployments,
          SuccessfulDeployments: successfulDeployments,
          FailedDeployments: failedDeployments,
        },
        RecentDeployments: recentDeployments,
      });
    } catch (error) {
      Logger.Error('Failed to get dashboard summary', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve dashboard summary');
    }
  };

  /**
   * Get deployment statistics for a specific time range
   * GET /api/dashboard/stats
   *
   * Query params:
   * - startDate: ISO date string (optional, defaults to 30 days ago)
   * - endDate: ISO date string (optional, defaults to now)
   */
  public GetDeploymentStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      // Default to last 30 days if not specified
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Get deployments in date range grouped by status
      const deployments = await Deployment.findAll({
        where: {
          CreatedAt: {
            [Op.between]: [start, end],
          },
        },
        attributes: ['Status', 'CreatedAt'],
        order: [['CreatedAt', 'ASC']],
      });

      // Group by status
      const stats = {
        Total: deployments.length,
        Success: deployments.filter(d => d.Status === EDeploymentStatus.Success).length,
        Failed: deployments.filter(d => d.Status === EDeploymentStatus.Failed).length,
        InProgress: deployments.filter(d => d.Status === EDeploymentStatus.InProgress).length,
        Queued: deployments.filter(d => d.Status === EDeploymentStatus.Queued).length,
        Pending: deployments.filter(d => d.Status === EDeploymentStatus.Pending).length,
        Cancelled: deployments.filter(d => d.Status === EDeploymentStatus.Cancelled).length,
      };

      ResponseHelper.Success(res, 'Deployment statistics retrieved successfully', {
        Stats: stats,
        StartDate: start,
        EndDate: end,
      });
    } catch (error) {
      Logger.Error('Failed to get deployment statistics', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve deployment statistics');
    }
  };

  /**
   * Get project activity summary
   * GET /api/dashboard/project-activity
   *
   * Returns deployment counts per project for the last 30 days
   */
  public GetProjectActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { limit = 10 } = req.query;
      const limitNum = parseInt(limit as string, 10);

      // Get projects with their deployment counts
      const projects = await Project.findAll({
        where: { IsActive: true },
        include: [
          {
            model: Deployment,
            as: 'Deployments',
            attributes: ['Id', 'Status', 'CreatedAt'],
            where: {
              CreatedAt: {
                [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
            required: false, // LEFT JOIN to include projects with no deployments
          },
        ],
        attributes: ['Id', 'Name', 'RepoUrl', 'ProjectType'],
        limit: limitNum,
      });

      // Transform data for frontend
      const activity = projects.map(project => {
        const jsonProject = project.toJSON() as any;
        const deployments = jsonProject.Deployments || [];

        return {
          ProjectId: jsonProject.Id,
          ProjectName: jsonProject.Name,
          ProjectType: jsonProject.ProjectType,
          TotalDeployments: deployments.length,
          SuccessfulDeployments: deployments.filter((d: any) => d.Status === EDeploymentStatus.Success).length,
          FailedDeployments: deployments.filter((d: any) => d.Status === EDeploymentStatus.Failed).length,
          LastDeploymentAt: deployments.length > 0
            ? deployments.sort((a: any, b: any) =>
                new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()
              )[0].CreatedAt
            : null,
        };
      });

      // Sort by total deployments descending
      activity.sort((a, b) => b.TotalDeployments - a.TotalDeployments);

      ResponseHelper.Success(res, 'Project activity retrieved successfully', {
        Activity: activity,
      });
    } catch (error) {
      Logger.Error('Failed to get project activity', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve project activity');
    }
  };
}

export default DashboardController;
