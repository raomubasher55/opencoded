import { Request, Response } from 'express';
import { GovernanceService } from '../services/governance.service';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('governance-controller');

export class GovernanceController {
  private governanceService: GovernanceService;

  constructor() {
    this.governanceService = new GovernanceService();
  }

  /**
   * Run compliance scan
   * POST /api/tools/governance/compliance-scan
   */
  public runComplianceScan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { files, teamId, projectId } = req.body;
      const userId = (req as any).user?.id;

      if (!files || !Array.isArray(files)) {
        res.status(400).json({
          success: false,
          message: 'Files array is required'
        });
        return;
      }

      if (!teamId || !projectId) {
        res.status(400).json({
          success: false,
          message: 'Team ID and Project ID are required'
        });
        return;
      }

      // Validate files structure
      const validatedFiles = files.map((file: any) => {
        if (!file.path || !file.content) {
          throw new Error('Each file must have path and content properties');
        }
        return {
          path: file.path,
          content: file.content
        };
      });

      logger.info(`Starting compliance scan for project ${projectId} with ${validatedFiles.length} files`);

      const report = await this.governanceService.runComplianceScan(
        validatedFiles,
        teamId,
        projectId,
        userId
      );

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Failed to run compliance scan', error);
      res.status(500).json({
        success: false,
        message: 'Failed to run compliance scan',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Create governance policy
   * POST /api/tools/governance/policies
   */
  public createPolicy = async (req: Request, res: Response): Promise<void> => {
    try {
      const policyData = req.body;
      const userId = (req as any).user?.id;

      if (!policyData.name || !policyData.description) {
        res.status(400).json({
          success: false,
          message: 'Policy name and description are required'
        });
        return;
      }

      const policy = await this.governanceService.createGovernancePolicy({
        ...policyData,
        createdBy: userId
      });

      res.status(201).json({
        success: true,
        data: policy
      });

    } catch (error) {
      logger.error('Failed to create governance policy', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create policy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Classify data
   * POST /api/tools/governance/data-classification
   */
  public classifyData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { content, context } = req.body;

      if (!content) {
        res.status(400).json({
          success: false,
          message: 'Content is required for data classification'
        });
        return;
      }

      const classification = await this.governanceService.classifyData(
        content,
        context || 'general'
      );

      res.json({
        success: true,
        data: classification
      });

    } catch (error) {
      logger.error('Failed to classify data', error);
      res.status(500).json({
        success: false,
        message: 'Failed to classify data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get audit trail
   * GET /api/tools/governance/audit-trail
   */
  public getAuditTrail = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        userId,
        action,
        resource,
        startDate,
        endDate,
        riskLevel,
        page = 1,
        limit = 100
      } = req.query;

      const filters: any = {};
      
      if (userId) filters.userId = userId as string;
      if (action) filters.action = action as string;
      if (resource) filters.resource = resource as string;
      if (riskLevel) filters.riskLevel = riskLevel as string;
      
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const auditEntries = await this.governanceService.getAuditTrail(filters);

      // Implement pagination
      const pageNumber = parseInt(page as string, 10);
      const pageSize = Math.min(parseInt(limit as string, 10), 1000); // Max 1000 per page
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      
      const paginatedEntries = auditEntries.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          entries: paginatedEntries,
          pagination: {
            page: pageNumber,
            limit: pageSize,
            total: auditEntries.length,
            totalPages: Math.ceil(auditEntries.length / pageSize)
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get audit trail', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit trail',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Log audit entry
   * POST /api/tools/governance/audit-log
   */
  public logAuditEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { action, resource, resourceId, details, result, riskLevel } = req.body;
      const userId = (req as any).user?.id;

      if (!action || !resource || !resourceId) {
        res.status(400).json({
          success: false,
          message: 'Action, resource, and resourceId are required'
        });
        return;
      }

      await this.governanceService.logAuditEntry({
        userId,
        action,
        resource,
        resourceId,
        details: details || {},
        result: result || 'success',
        riskLevel: riskLevel || 'low'
      });

      res.json({
        success: true,
        message: 'Audit entry logged successfully'
      });

    } catch (error) {
      logger.error('Failed to log audit entry', error);
      res.status(500).json({
        success: false,
        message: 'Failed to log audit entry',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get compliance dashboard data
   * GET /api/tools/governance/dashboard
   */
  public getComplianceDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId, timeRange = '30d' } = req.query;

      // This would typically aggregate data from stored compliance reports
      // For now, return mock dashboard data
      const dashboardData = {
        overview: {
          overallScore: 85,
          totalViolations: 23,
          criticalViolations: 2,
          trendDirection: 'improving', // improving, declining, stable
          scoreChange: +5 // points change from previous period
        },
        violationsByCategory: {
          security: 8,
          quality: 10,
          licensing: 3,
          data: 2,
          accessibility: 0,
          performance: 0
        },
        violationsBySeverity: {
          critical: 2,
          high: 6,
          medium: 10,
          low: 5
        },
        topViolatedRules: [
          { name: 'Code Complexity', violations: 6, category: 'quality' },
          { name: 'No Hardcoded Secrets', violations: 4, category: 'security' },
          { name: 'License Header Required', violations: 3, category: 'licensing' },
          { name: 'SQL Injection Prevention', violations: 2, category: 'security' },
          { name: 'PII Detection', violations: 2, category: 'data' }
        ],
        complianceTrends: {
          // Last 30 days of scores
          daily: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            score: Math.floor(Math.random() * 20) + 80 // Mock scores between 80-100
          }))
        },
        recentActivity: [
          {
            timestamp: new Date(),
            action: 'Compliance scan completed',
            details: '15 files scanned, 3 new violations found',
            user: 'john.doe'
          },
          {
            timestamp: new Date(Date.now() - 60 * 60 * 1000),
            action: 'Policy updated',
            details: 'Security policy v2.1 activated',
            user: 'admin'
          }
        ]
      };

      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      logger.error('Failed to get compliance dashboard', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get compliance reports
   * GET /api/tools/governance/reports
   */
  public getComplianceReports = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId, projectId, startDate, endDate, page = 1, limit = 20 } = req.query;

      // This would typically query stored compliance reports
      // For now, return mock reports list
      const reports = [
        {
          id: 'report_1',
          projectId: projectId || 'project_1',
          teamId: teamId || 'team_1',
          generatedAt: new Date(),
          generatedBy: 'john.doe',
          summary: {
            overallScore: 88,
            totalViolations: 15,
            criticalViolations: 1,
            compliancePercentage: 92
          },
          scope: {
            filesScanned: 150,
            linesOfCode: 15000,
            rulesApplied: 25
          }
        }
      ];

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            page: parseInt(page as string, 10),
            limit: parseInt(limit as string, 10),
            total: reports.length,
            totalPages: 1
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get compliance reports', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve compliance reports',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Export compliance report
   * GET /api/tools/governance/reports/:reportId/export
   */
  public exportComplianceReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId } = req.params;
      const { format = 'json' } = req.query;

      if (!reportId) {
        res.status(400).json({
          success: false,
          message: 'Report ID is required'
        });
        return;
      }

      // This would typically fetch the report and export in requested format
      // For now, return mock export
      const reportData = {
        id: reportId,
        exportedAt: new Date(),
        format,
        data: {
          // Mock report data
          summary: 'Compliance report data would be here',
          violations: [],
          recommendations: []
        }
      };

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${reportId}.csv"`);
        res.send('CSV report data would be here');
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${reportId}.pdf"`);
        res.send('PDF report data would be here');
      } else {
        res.json({
          success: true,
          data: reportData
        });
      }

    } catch (error) {
      logger.error('Failed to export compliance report', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export report',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}