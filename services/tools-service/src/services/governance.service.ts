import { createServiceLogger } from '@opencode/shared-utils';
import { ToolModel } from '../models/tool.model';

const logger = createServiceLogger('governance-service');

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'quality' | 'licensing' | 'data' | 'accessibility' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  configuration: {
    [key: string]: any;
  };
  appliesTo: {
    fileTypes: string[];
    directories: string[];
    excludePatterns: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  column?: number;
  message: string;
  details: string;
  suggestion?: string;
  autoFixable: boolean;
  detectedAt: Date;
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  assignedTo?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  suppressedReason?: string;
}

export interface ComplianceReport {
  id: string;
  projectId: string;
  teamId: string;
  generatedAt: Date;
  generatedBy: string;
  scope: {
    filesScanned: number;
    linesOfCode: number;
    rulesApplied: number;
  };
  summary: {
    overallScore: number; // 0-100
    totalViolations: number;
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
    lowViolations: number;
    compliancePercentage: number;
  };
  violationsByCategory: {
    [category: string]: number;
  };
  violationsByFile: {
    [file: string]: ComplianceViolation[];
  };
  trends: {
    previousScore?: number;
    scoreChange?: number;
    newViolations: number;
    resolvedViolations: number;
  };
  recommendations: string[];
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'draft' | 'active' | 'deprecated';
  rules: string[]; // Rule IDs
  applicableTeams: string[];
  enforcementLevel: 'advisory' | 'warning' | 'blocking';
  approvers: string[];
  approvedAt?: Date;
  effectiveDate: Date;
  expirationDate?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  description: string;
  handlingRequirements: string[];
  retentionPeriod?: number; // days
  encryptionRequired: boolean;
  accessControls: {
    roles: string[];
    permissions: string[];
  };
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  username: string;
  action: string;
  resource: string;
  resourceId: string;
  details: {
    [key: string]: any;
  };
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  result: 'success' | 'failure' | 'partial';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class GovernanceService {
  private complianceRules: Map<string, ComplianceRule> = new Map();
  private policies: Map<string, GovernancePolicy> = new Map();
  private auditLog: AuditEntry[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default compliance rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: ComplianceRule[] = [
      {
        id: 'security-001',
        name: 'No Hardcoded Secrets',
        description: 'Detect hardcoded passwords, API keys, and tokens',
        category: 'security',
        severity: 'critical',
        enabled: true,
        configuration: {
          patterns: [
            'password\\s*=\\s*["\'][^"\']+["\']',
            'api[_-]?key\\s*=\\s*["\'][^"\']+["\']',
            'secret\\s*=\\s*["\'][^"\']+["\']',
            'token\\s*=\\s*["\'][^"\']+["\']'
          ],
          exceptions: ['test', 'example', 'placeholder']
        },
        appliesTo: {
          fileTypes: ['.js', '.ts', '.py', '.java', '.cs', '.php', '.rb'],
          directories: ['*'],
          excludePatterns: ['**/test/**', '**/tests/**', '**/*.test.*']
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        id: 'security-002',
        name: 'SQL Injection Prevention',
        description: 'Detect potential SQL injection vulnerabilities',
        category: 'security',
        severity: 'high',
        enabled: true,
        configuration: {
          patterns: [
            'execute\\s*\\(.*\\+.*\\)',
            'query\\s*\\(.*\\+.*\\)',
            '\\.sql\\s*\\(.*\\+.*\\)'
          ]
        },
        appliesTo: {
          fileTypes: ['.js', '.ts', '.py', '.java', '.cs', '.php'],
          directories: ['*'],
          excludePatterns: []
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        id: 'licensing-001',
        name: 'License Header Required',
        description: 'Ensure all source files contain license headers',
        category: 'licensing',
        severity: 'medium',
        enabled: true,
        configuration: {
          requiredText: 'Copyright',
          position: 'top',
          maxLines: 20
        },
        appliesTo: {
          fileTypes: ['.js', '.ts', '.py', '.java', '.cs'],
          directories: ['src/**'],
          excludePatterns: ['**/node_modules/**', '**/vendor/**']
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        id: 'quality-001',
        name: 'Code Complexity',
        description: 'Enforce maximum cyclomatic complexity',
        category: 'quality',
        severity: 'medium',
        enabled: true,
        configuration: {
          maxComplexity: 10,
          measureFunctions: true,
          measureClasses: true
        },
        appliesTo: {
          fileTypes: ['.js', '.ts', '.py', '.java', '.cs'],
          directories: ['*'],
          excludePatterns: ['**/test/**']
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      },
      {
        id: 'data-001',
        name: 'PII Detection',
        description: 'Detect potential personally identifiable information',
        category: 'data',
        severity: 'high',
        enabled: true,
        configuration: {
          patterns: [
            '\\b\\d{3}-\\d{2}-\\d{4}\\b', // SSN
            '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', // Email
            '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b' // Credit card
          ],
          excludeComments: true,
          excludeStrings: false
        },
        appliesTo: {
          fileTypes: ['*'],
          directories: ['*'],
          excludePatterns: ['**/test/**', '**/*.md']
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      }
    ];

    defaultRules.forEach(rule => {
      this.complianceRules.set(rule.id, rule);
    });

    logger.info(`Initialized ${defaultRules.length} default compliance rules`);
  }

  /**
   * Run compliance scan on code
   */
  async runComplianceScan(
    files: { path: string; content: string }[],
    teamId: string,
    projectId: string,
    userId: string
  ): Promise<ComplianceReport> {
    logger.info(`Starting compliance scan for project ${projectId}`);
    
    const reportId = this.generateReportId();
    const violations: ComplianceViolation[] = [];
    let totalLines = 0;
    let rulesApplied = 0;

    // Get applicable rules for team
    const applicableRules = this.getApplicableRules(teamId);
    
    // Scan each file
    for (const file of files) {
      totalLines += file.content.split('\n').length;
      
      for (const rule of applicableRules) {
        if (this.fileMatchesRule(file.path, rule)) {
          const fileViolations = await this.scanFileWithRule(file, rule);
          violations.push(...fileViolations);
          rulesApplied++;
        }
      }
    }

    // Calculate summary
    const summary = this.calculateComplianceSummary(violations, totalLines);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(violations, teamId);

    // Create report
    const report: ComplianceReport = {
      id: reportId,
      projectId,
      teamId,
      generatedAt: new Date(),
      generatedBy: userId,
      scope: {
        filesScanned: files.length,
        linesOfCode: totalLines,
        rulesApplied
      },
      summary,
      violationsByCategory: this.groupViolationsByCategory(violations),
      violationsByFile: this.groupViolationsByFile(violations),
      trends: {
        newViolations: violations.length,
        resolvedViolations: 0
      },
      recommendations
    };

    // Log audit entry
    await this.logAuditEntry({
      userId,
      action: 'compliance_scan',
      resource: 'project',
      resourceId: projectId,
      details: {
        filesScanned: files.length,
        violationsFound: violations.length,
        reportId
      },
      result: 'success',
      riskLevel: 'low'
    });

    logger.info(`Compliance scan completed. Found ${violations.length} violations`);
    return report;
  }

  /**
   * Scan a single file with a rule
   */
  private async scanFileWithRule(
    file: { path: string; content: string },
    rule: ComplianceRule
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const lines = file.content.split('\n');

    switch (rule.category) {
      case 'security':
        violations.push(...this.scanSecurityRule(file, rule, lines));
        break;
      case 'licensing':
        violations.push(...this.scanLicensingRule(file, rule, lines));
        break;
      case 'quality':
        violations.push(...this.scanQualityRule(file, rule, lines));
        break;
      case 'data':
        violations.push(...this.scanDataRule(file, rule, lines));
        break;
    }

    return violations;
  }

  /**
   * Scan for security rule violations
   */
  private scanSecurityRule(
    file: { path: string; content: string },
    rule: ComplianceRule,
    lines: string[]
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const patterns = rule.configuration.patterns as string[];
    const exceptions = rule.configuration.exceptions as string[] || [];

    patterns.forEach(patternStr => {
      const pattern = new RegExp(patternStr, 'gi');
      
      lines.forEach((line, index) => {
        const matches = line.match(pattern);
        if (matches) {
          // Check exceptions
          const hasException = exceptions.some(exception => 
            line.toLowerCase().includes(exception.toLowerCase())
          );
          
          if (!hasException) {
            violations.push({
              id: this.generateViolationId(),
              ruleId: rule.id,
              ruleName: rule.name,
              category: rule.category,
              severity: rule.severity,
              file: file.path,
              line: index + 1,
              message: `${rule.name} violation detected`,
              details: `Found pattern: ${matches[0]}`,
              suggestion: 'Move sensitive data to environment variables or secure configuration',
              autoFixable: false,
              detectedAt: new Date(),
              status: 'open'
            });
          }
        }
      });
    });

    return violations;
  }

  /**
   * Scan for licensing rule violations
   */
  private scanLicensingRule(
    file: { path: string; content: string },
    rule: ComplianceRule,
    lines: string[]
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const requiredText = rule.configuration.requiredText as string;
    const maxLines = rule.configuration.maxLines as number || 20;

    // Check first maxLines for license header
    const headerContent = lines.slice(0, maxLines).join('\n');
    
    if (!headerContent.includes(requiredText)) {
      violations.push({
        id: this.generateViolationId(),
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        severity: rule.severity,
        file: file.path,
        line: 1,
        message: 'Missing license header',
        details: `File does not contain required text: ${requiredText}`,
        suggestion: 'Add appropriate license header to the beginning of the file',
        autoFixable: true,
        detectedAt: new Date(),
        status: 'open'
      });
    }

    return violations;
  }

  /**
   * Scan for code quality rule violations
   */
  private scanQualityRule(
    file: { path: string; content: string },
    rule: ComplianceRule,
    lines: string[]
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    // Simplified complexity analysis
    // In practice, this would use proper AST parsing
    
    const maxComplexity = rule.configuration.maxComplexity as number || 10;
    let complexity = 1;
    let functionStartLine = 0;
    
    lines.forEach((line, index) => {
      // Detect function start
      if (line.match(/function\s+\w+|^\s*\w+\s*\(/)) {
        if (complexity > maxComplexity && functionStartLine > 0) {
          violations.push({
            id: this.generateViolationId(),
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            file: file.path,
            line: functionStartLine,
            message: `Function complexity too high: ${complexity}`,
            details: `Cyclomatic complexity is ${complexity}, maximum allowed is ${maxComplexity}`,
            suggestion: 'Consider breaking this function into smaller functions',
            autoFixable: false,
            detectedAt: new Date(),
            status: 'open'
          });
        }
        complexity = 1;
        functionStartLine = index + 1;
      }
      
      // Count complexity indicators
      if (line.match(/if\s*\(|else\s+if|while\s*\(|for\s*\(|catch\s*\(|case\s+.*:/)) {
        complexity++;
      }
    });

    return violations;
  }

  /**
   * Scan for data protection rule violations
   */
  private scanDataRule(
    file: { path: string; content: string },
    rule: ComplianceRule,
    lines: string[]
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const patterns = rule.configuration.patterns as string[];
    
    patterns.forEach(patternStr => {
      const pattern = new RegExp(patternStr, 'g');
      
      lines.forEach((line, index) => {
        // Skip comments if configured
        if (rule.configuration.excludeComments && line.trim().startsWith('//')) {
          return;
        }
        
        const matches = line.match(pattern);
        if (matches) {
          violations.push({
            id: this.generateViolationId(),
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            file: file.path,
            line: index + 1,
            message: 'Potential PII detected',
            details: `Found pattern that may contain personally identifiable information`,
            suggestion: 'Review and ensure PII is properly handled according to data protection policies',
            autoFixable: false,
            detectedAt: new Date(),
            status: 'open'
          });
        }
      });
    });

    return violations;
  }

  /**
   * Create or update governance policy
   */
  async createGovernancePolicy(policy: Omit<GovernancePolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<GovernancePolicy> {
    const policyId = this.generatePolicyId();
    const newPolicy: GovernancePolicy = {
      ...policy,
      id: policyId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.policies.set(policyId, newPolicy);
    
    logger.info(`Created governance policy: ${policy.name}`);
    return newPolicy;
  }

  /**
   * Data classification
   */
  async classifyData(content: string, context: string): Promise<DataClassification> {
    // Simplified data classification logic
    // In practice, this would use ML models or more sophisticated analysis
    
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('ssn') || lowerContent.includes('social security') ||
        lowerContent.includes('credit card') || lowerContent.includes('password')) {
      return {
        level: 'restricted',
        description: 'Contains highly sensitive personal or financial information',
        handlingRequirements: [
          'Encryption at rest and in transit required',
          'Access logging mandatory',
          'Regular access reviews',
          'Secure deletion procedures'
        ],
        retentionPeriod: 2555, // 7 years
        encryptionRequired: true,
        accessControls: {
          roles: ['data-owner', 'privacy-officer'],
          permissions: ['read', 'decrypt']
        }
      };
    }
    
    if (lowerContent.includes('email') || lowerContent.includes('phone') ||
        lowerContent.includes('address')) {
      return {
        level: 'confidential',
        description: 'Contains personal information requiring protection',
        handlingRequirements: [
          'Access controls required',
          'Audit trail maintained',
          'Data minimization principles'
        ],
        retentionPeriod: 1825, // 5 years
        encryptionRequired: true,
        accessControls: {
          roles: ['authorized-personnel'],
          permissions: ['read']
        }
      };
    }
    
    return {
      level: 'internal',
      description: 'Internal business information',
      handlingRequirements: [
        'Standard access controls',
        'Regular backup procedures'
      ],
      encryptionRequired: false,
      accessControls: {
        roles: ['employee'],
        permissions: ['read', 'write']
      }
    };
  }

  /**
   * Log audit entry
   */
  async logAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'username' | 'ipAddress' | 'userAgent'>): Promise<void> {
    const auditEntry: AuditEntry = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: new Date(),
      username: 'system', // Would be resolved from userId
      ipAddress: '127.0.0.1', // Would be extracted from request
      userAgent: 'OpenCode-System'
    };

    this.auditLog.push(auditEntry);
    
    // Keep only last 10000 entries in memory
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }

    // In production, this would be persisted to a secure audit database
    logger.debug(`Audit entry logged: ${entry.action} on ${entry.resource}`);
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    riskLevel?: string;
  }): Promise<AuditEntry[]> {
    let filteredEntries = this.auditLog;

    if (filters.userId) {
      filteredEntries = filteredEntries.filter(entry => entry.userId === filters.userId);
    }
    
    if (filters.action) {
      filteredEntries = filteredEntries.filter(entry => entry.action === filters.action);
    }
    
    if (filters.resource) {
      filteredEntries = filteredEntries.filter(entry => entry.resource === filters.resource);
    }
    
    if (filters.startDate) {
      filteredEntries = filteredEntries.filter(entry => entry.timestamp >= filters.startDate!);
    }
    
    if (filters.endDate) {
      filteredEntries = filteredEntries.filter(entry => entry.timestamp <= filters.endDate!);
    }
    
    if (filters.riskLevel) {
      filteredEntries = filteredEntries.filter(entry => entry.riskLevel === filters.riskLevel);
    }

    return filteredEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Generate compliance recommendations
   */
  private async generateRecommendations(violations: ComplianceViolation[], teamId: string): Promise<string[]> {
    const recommendations: string[] = [];
    const violationsByCategory = this.groupViolationsByCategory(violations);

    // Generate category-specific recommendations
    Object.entries(violationsByCategory).forEach(([category, count]) => {
      switch (category) {
        case 'security':
          if (count > 0) {
            recommendations.push(`Address ${count} security violations to improve code security posture`);
            recommendations.push('Consider implementing automated security scanning in CI/CD pipeline');
          }
          break;
        case 'licensing':
          if (count > 0) {
            recommendations.push(`Add license headers to ${count} files to ensure proper licensing compliance`);
          }
          break;
        case 'quality':
          if (count > 0) {
            recommendations.push(`Refactor ${count} complex functions to improve maintainability`);
          }
          break;
        case 'data':
          if (count > 0) {
            recommendations.push(`Review ${count} potential PII instances for data protection compliance`);
            recommendations.push('Implement data classification and handling procedures');
          }
          break;
      }
    });

    // General recommendations based on violation severity
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;

    if (criticalCount > 0) {
      recommendations.push('Address critical violations immediately - they pose significant security or compliance risks');
    }
    
    if (highCount > 5) {
      recommendations.push('Consider implementing additional code review processes to catch high-severity issues');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private getApplicableRules(teamId: string): ComplianceRule[] {
    // For now, return all enabled rules
    // In practice, this would filter based on team policies
    return Array.from(this.complianceRules.values()).filter(rule => rule.enabled);
  }

  private fileMatchesRule(filePath: string, rule: ComplianceRule): boolean {
    const { fileTypes, directories, excludePatterns } = rule.appliesTo;
    
    // Check file types
    if (fileTypes.length > 0 && !fileTypes.includes('*')) {
      const hasMatchingExtension = fileTypes.some(type => filePath.endsWith(type));
      if (!hasMatchingExtension) return false;
    }
    
    // Check exclude patterns
    for (const pattern of excludePatterns) {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      if (regex.test(filePath)) return false;
    }
    
    return true;
  }

  private calculateComplianceSummary(violations: ComplianceViolation[], totalLines: number): ComplianceReport['summary'] {
    const totalViolations = violations.length;
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const highViolations = violations.filter(v => v.severity === 'high').length;
    const mediumViolations = violations.filter(v => v.severity === 'medium').length;
    const lowViolations = violations.filter(v => v.severity === 'low').length;

    // Calculate score based on violation severity and density
    let score = 100;
    score -= criticalViolations * 20;
    score -= highViolations * 10;
    score -= mediumViolations * 5;
    score -= lowViolations * 1;
    
    // Adjust for code density (violations per 1000 lines)
    const violationDensity = (totalViolations / totalLines) * 1000;
    score -= Math.floor(violationDensity * 2);
    
    score = Math.max(0, Math.min(100, score));
    
    const compliancePercentage = totalViolations === 0 ? 100 : Math.max(0, 100 - (totalViolations * 2));

    return {
      overallScore: score,
      totalViolations,
      criticalViolations,
      highViolations,
      mediumViolations,
      lowViolations,
      compliancePercentage
    };
  }

  private groupViolationsByCategory(violations: ComplianceViolation[]): { [category: string]: number } {
    const grouped: { [category: string]: number } = {};
    violations.forEach(violation => {
      grouped[violation.category] = (grouped[violation.category] || 0) + 1;
    });
    return grouped;
  }

  private groupViolationsByFile(violations: ComplianceViolation[]): { [file: string]: ComplianceViolation[] } {
    const grouped: { [file: string]: ComplianceViolation[] } = {};
    violations.forEach(violation => {
      if (!grouped[violation.file]) {
        grouped[violation.file] = [];
      }
      grouped[violation.file].push(violation);
    });
    return grouped;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateViolationId(): string {
    return `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePolicyId(): string {
    return `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}