import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('advanced-team-metrics-service');

export interface TeamMember {
  id: string;
  username: string;
  role: string;
  joinedAt: Date;
  lastActive: Date;
  skills: string[];
  level: 'junior' | 'mid' | 'senior' | 'lead';
}

export interface CollaborationMetric {
  userId: string;
  metric: string;
  value: number;
  timestamp: Date;
  context?: {
    sessionId?: string;
    fileId?: string;
    toolId?: string;
    projectId?: string;
  };
}

export interface TeamPerformanceMetrics {
  teamId: string;
  period: {
    start: Date;
    end: Date;
  };
  overview: {
    totalMembers: number;
    activeMembers: number;
    averageExperience: number; // months
    teamVelocity: number;
    collaborationScore: number; // 0-100
    codeQualityScore: number; // 0-100
    knowledgeDistribution: number; // 0-100
  };
  productivity: {
    linesOfCodePerMember: { [userId: string]: number };
    commitsPerMember: { [userId: string]: number };
    reviewsPerMember: { [userId: string]: number };
    averageSessionLength: number; // minutes
    peakActivityHours: number[];
    codeReusability: number; // 0-100
  };
  collaboration: {
    pairProgrammingSessions: number;
    crossTeamInteractions: number;
    mentorshipSessions: number;
    knowledgeSharingEvents: number;
    averageResponseTime: number; // minutes
    collaborationNetworkDensity: number; // 0-1
  };
  codeQuality: {
    averageCodeReviewScore: number;
    testCoverage: number;
    bugDensity: number; // bugs per KLOC
    technicalDebtRatio: number;
    complianceScore: number;
    documentationCoverage: number;
  };
  skills: {
    skillGaps: SkillGap[];
    expertiseAreas: ExpertiseArea[];
    learningProgress: LearningProgress[];
    crossTrainingOpportunities: string[];
  };
  trends: {
    velocityTrend: TrendData[];
    qualityTrend: TrendData[];
    collaborationTrend: TrendData[];
    skillDevelopmentTrend: TrendData[];
  };
  recommendations: TeamRecommendation[];
}

export interface SkillGap {
  skill: string;
  requiredLevel: number; // 1-5
  currentLevel: number; // 1-5
  affectedMembers: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
}

export interface ExpertiseArea {
  skill: string;
  experts: string[];
  proficiencyLevel: number; // 1-5
  utilization: number; // 0-100%
  demandLevel: number; // 1-5
}

export interface LearningProgress {
  userId: string;
  skill: string;
  startLevel: number;
  currentLevel: number;
  targetLevel: number;
  progressRate: number; // level increase per month
  completionETA: Date;
}

export interface TrendData {
  date: Date;
  value: number;
  change?: number; // change from previous period
}

export interface TeamRecommendation {
  id: string;
  category: 'productivity' | 'collaboration' | 'quality' | 'skills' | 'process';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  suggestedActions: string[];
  expectedOutcome: string;
  metrics: string[]; // Which metrics this would improve
}

export interface IndividualPerformanceMetrics {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  productivity: {
    linesOfCode: number;
    commits: number;
    pullRequests: number;
    codeReviews: number;
    issuesResolved: number;
    averageTaskComplexity: number;
    focusTime: number; // hours of uninterrupted work
  };
  collaboration: {
    pairProgrammingSessions: number;
    helpRequestsGiven: number;
    helpRequestsReceived: number;
    mentoringSessions: number;
    averageResponseTime: number; // minutes
    collaborationScore: number; // 0-100
  };
  codeQuality: {
    averageReviewScore: number;
    bugsIntroduced: number;
    testCoverage: number;
    refactoringContributions: number;
    documentationUpdates: number;
    complianceViolations: number;
  };
  skills: {
    currentSkills: { [skill: string]: number }; // 1-5 proficiency
    skillsImproved: string[];
    learningGoals: string[];
    certifications: string[];
    trainingHours: number;
  };
  wellbeing: {
    workLifeBalance: number; // 0-100
    burnoutRisk: 'low' | 'medium' | 'high';
    satisfactionScore: number; // 0-100
    stressLevel: number; // 0-100
    engagementLevel: number; // 0-100
  };
  careerDevelopment: {
    goalsProgress: { [goal: string]: number }; // 0-100%
    promotionReadiness: number; // 0-100
    leadershipActivities: number;
    crossFunctionalExperience: string[];
    recommendationsReceived: number;
  };
}

export class AdvancedTeamMetricsService {
  private metrics: Map<string, CollaborationMetric[]> = new Map();
  private teamMembers: Map<string, TeamMember[]> = new Map();

  /**
   * Record a team performance metric
   */
  async recordMetric(metric: CollaborationMetric): Promise<void> {
    const key = `${metric.userId}_${metric.metric}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push(metric);
    
    // Keep only last 10000 metrics per user/metric combination
    const userMetrics = this.metrics.get(key)!;
    if (userMetrics.length > 10000) {
      this.metrics.set(key, userMetrics.slice(-10000));
    }
    
    logger.debug(`Recorded metric: ${metric.metric} = ${metric.value} for user ${metric.userId}`);
  }

  /**
   * Calculate comprehensive team performance metrics
   */
  async calculateTeamPerformanceMetrics(
    teamId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeamPerformanceMetrics> {
    logger.info(`Calculating team performance metrics for team ${teamId}`);

    const teamMembers = this.teamMembers.get(teamId) || [];
    const activeMembers = teamMembers.filter(member => 
      member.lastActive >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Active in last 7 days
    );

    // Calculate overview metrics
    const overview = await this.calculateOverviewMetrics(teamMembers, activeMembers, startDate, endDate);
    
    // Calculate productivity metrics
    const productivity = await this.calculateProductivityMetrics(teamMembers, startDate, endDate);
    
    // Calculate collaboration metrics
    const collaboration = await this.calculateCollaborationMetrics(teamMembers, startDate, endDate);
    
    // Calculate code quality metrics
    const codeQuality = await this.calculateCodeQualityMetrics(teamMembers, startDate, endDate);
    
    // Calculate skills metrics
    const skills = await this.calculateSkillsMetrics(teamMembers, startDate, endDate);
    
    // Calculate trends
    const trends = await this.calculateTrends(teamId, startDate, endDate);
    
    // Generate recommendations
    const recommendations = await this.generateTeamRecommendations(
      teamId,
      overview,
      productivity,
      collaboration,
      codeQuality,
      skills
    );

    return {
      teamId,
      period: { start: startDate, end: endDate },
      overview,
      productivity,
      collaboration,
      codeQuality,
      skills,
      trends,
      recommendations
    };
  }

  /**
   * Calculate individual performance metrics
   */
  async calculateIndividualPerformanceMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IndividualPerformanceMetrics> {
    logger.info(`Calculating individual performance metrics for user ${userId}`);

    // Get user metrics for the period
    const userMetrics = this.getUserMetricsForPeriod(userId, startDate, endDate);

    // Calculate individual metrics
    const productivity = this.calculateIndividualProductivity(userMetrics);
    const collaboration = this.calculateIndividualCollaboration(userMetrics);
    const codeQuality = this.calculateIndividualCodeQuality(userMetrics);
    const skills = this.calculateIndividualSkills(userMetrics);
    const wellbeing = this.calculateIndividualWellbeing(userMetrics);
    const careerDevelopment = this.calculateCareerDevelopment(userMetrics);

    return {
      userId,
      period: { start: startDate, end: endDate },
      productivity,
      collaboration,
      codeQuality,
      skills,
      wellbeing,
      careerDevelopment
    };
  }

  /**
   * Generate AI-powered insights for team performance
   */
  async generateTeamInsights(teamId: string, metrics: TeamPerformanceMetrics): Promise<{
    strengths: string[];
    opportunities: string[];
    risks: string[];
    predictions: string[];
  }> {
    const insights = {
      strengths: [] as string[],
      opportunities: [] as string[],
      risks: [] as string[],
      predictions: [] as string[]
    };

    // Analyze strengths
    if (metrics.overview.collaborationScore > 80) {
      insights.strengths.push('Excellent team collaboration and communication');
    }
    
    if (metrics.codeQuality.averageCodeReviewScore > 85) {
      insights.strengths.push('High code quality standards maintained');
    }
    
    if (metrics.overview.knowledgeDistribution > 75) {
      insights.strengths.push('Good knowledge distribution across team members');
    }

    // Analyze opportunities
    if (metrics.productivity.codeReusability < 60) {
      insights.opportunities.push('Increase code reusability through better component design');
    }
    
    if (metrics.collaboration.mentorshipSessions < 5) {
      insights.opportunities.push('Establish more structured mentorship programs');
    }
    
    if (metrics.codeQuality.documentationCoverage < 70) {
      insights.opportunities.push('Improve code documentation and knowledge sharing');
    }

    // Analyze risks
    if (metrics.codeQuality.technicalDebtRatio > 30) {
      insights.risks.push('High technical debt may impact future development velocity');
    }
    
    const skillGaps = metrics.skills.skillGaps.filter(gap => gap.priority === 'critical' || gap.priority === 'high');
    if (skillGaps.length > 0) {
      insights.risks.push(`Critical skill gaps identified in: ${skillGaps.map(g => g.skill).join(', ')}`);
    }
    
    if (metrics.overview.teamVelocity < 70) {
      insights.risks.push('Team velocity below optimal level - investigate blockers');
    }

    // Generate predictions
    const velocityTrend = this.analyzeTrend(metrics.trends.velocityTrend);
    if (velocityTrend === 'increasing') {
      insights.predictions.push('Team velocity likely to continue improving over next quarter');
    } else if (velocityTrend === 'decreasing') {
      insights.predictions.push('Team velocity may decline without intervention');
    }
    
    const qualityTrend = this.analyzeTrend(metrics.trends.qualityTrend);
    if (qualityTrend === 'increasing') {
      insights.predictions.push('Code quality improvements should continue with current practices');
    }

    return insights;
  }

  /**
   * Calculate team collaboration network analysis
   */
  async calculateCollaborationNetwork(teamId: string, period: { start: Date; end: Date }): Promise<{
    nodes: { id: string; name: string; centrality: number; influence: number }[];
    edges: { source: string; target: string; weight: number; type: string }[];
    metrics: {
      density: number;
      clustering: number;
      centralMembers: string[];
      isolatedMembers: string[];
      communicationPatterns: { [pattern: string]: number };
    };
  }> {
    const teamMembers = this.teamMembers.get(teamId) || [];
    
    // Build collaboration network based on interactions
    const nodes = teamMembers.map(member => ({
      id: member.id,
      name: member.username,
      centrality: this.calculateCentrality(member.id, teamMembers),
      influence: this.calculateInfluence(member.id, teamMembers)
    }));

    const edges = this.calculateCollaborationEdges(teamMembers, period);
    
    const metrics = {
      density: this.calculateNetworkDensity(nodes, edges),
      clustering: this.calculateClusteringCoefficient(nodes, edges),
      centralMembers: nodes.filter(n => n.centrality > 0.7).map(n => n.id),
      isolatedMembers: nodes.filter(n => n.centrality < 0.2).map(n => n.id),
      communicationPatterns: this.analyzeCommunicationPatterns(edges)
    };

    return { nodes, edges, metrics };
  }

  /**
   * Generate personalized development recommendations
   */
  async generatePersonalizedRecommendations(
    userId: string,
    individualMetrics: IndividualPerformanceMetrics,
    teamMetrics: TeamPerformanceMetrics
  ): Promise<{
    skillDevelopment: string[];
    careerGrowth: string[];
    collaboration: string[];
    wellbeing: string[];
  }> {
    const recommendations = {
      skillDevelopment: [] as string[],
      careerGrowth: [] as string[],
      collaboration: [] as string[],
      wellbeing: [] as string[]
    };

    // Skill development recommendations
    const skillGaps = teamMetrics.skills.skillGaps.filter(gap => 
      gap.affectedMembers.includes(userId)
    );
    
    skillGaps.forEach(gap => {
      recommendations.skillDevelopment.push(
        `Focus on improving ${gap.skill} skills - consider ${gap.suggestedActions.join(', ')}`
      );
    });

    // Career growth recommendations
    if (individualMetrics.careerDevelopment.promotionReadiness > 70) {
      recommendations.careerGrowth.push('You\'re ready for increased responsibilities - discuss advancement opportunities');
    }
    
    if (individualMetrics.careerDevelopment.leadershipActivities < 3) {
      recommendations.careerGrowth.push('Take on more leadership roles in projects to develop management skills');
    }

    // Collaboration recommendations
    if (individualMetrics.collaboration.collaborationScore < 70) {
      recommendations.collaboration.push('Increase participation in pair programming and code reviews');
    }
    
    if (individualMetrics.collaboration.mentoringSessions === 0) {
      recommendations.collaboration.push('Consider mentoring junior team members to strengthen leadership skills');
    }

    // Wellbeing recommendations
    if (individualMetrics.wellbeing.burnoutRisk === 'high') {
      recommendations.wellbeing.push('Take time to rest and consider workload redistribution');
    }
    
    if (individualMetrics.wellbeing.workLifeBalance < 60) {
      recommendations.wellbeing.push('Focus on improving work-life balance - set boundaries and take regular breaks');
    }

    return recommendations;
  }

  /**
   * Helper methods for calculations
   */
  private async calculateOverviewMetrics(
    teamMembers: TeamMember[],
    activeMembers: TeamMember[],
    startDate: Date,
    endDate: Date
  ): Promise<TeamPerformanceMetrics['overview']> {
    const totalMembers = teamMembers.length;
    const activeMembersCount = activeMembers.length;
    
    const averageExperience = teamMembers.reduce((sum, member) => {
      const experience = Math.floor((Date.now() - member.joinedAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
      return sum + experience;
    }, 0) / totalMembers || 0;

    // These would be calculated from actual metrics in a real implementation
    const teamVelocity = await this.calculateRealTeamVelocity(teamMembers, startDate, endDate);
    const collaborationScore = await this.calculateRealCollaborationScore(teamMembers, startDate, endDate);
    const codeQualityScore = await this.calculateRealCodeQualityScore(teamMembers, startDate, endDate);
    const knowledgeDistribution = await this.calculateRealKnowledgeDistribution(teamMembers);

    return {
      totalMembers,
      activeMembers: activeMembersCount,
      averageExperience,
      teamVelocity,
      collaborationScore,
      codeQualityScore,
      knowledgeDistribution
    };
  }

  private async calculateProductivityMetrics(
    teamMembers: TeamMember[],
    startDate: Date,
    endDate: Date
  ): Promise<TeamPerformanceMetrics['productivity']> {
    // Mock implementation - in practice, this would aggregate real metrics
    const linesOfCodePerMember: { [userId: string]: number } = {};
    const commitsPerMember: { [userId: string]: number } = {};
    const reviewsPerMember: { [userId: string]: number } = {};

    teamMembers.forEach(member => {
      linesOfCodePerMember[member.id] = Math.floor(Math.random() * 5000) + 1000;
      commitsPerMember[member.id] = Math.floor(Math.random() * 50) + 10;
      reviewsPerMember[member.id] = Math.floor(Math.random() * 20) + 5;
    });

    return {
      linesOfCodePerMember,
      commitsPerMember,
      reviewsPerMember,
      averageSessionLength: Math.floor(Math.random() * 120) + 60, // 60-180 minutes
      peakActivityHours: [9, 10, 11, 14, 15, 16], // Mock peak hours
      codeReusability: Math.floor(Math.random() * 30) + 60 // 60-90%
    };
  }

  private async calculateCollaborationMetrics(
    teamMembers: TeamMember[],
    startDate: Date,
    endDate: Date
  ): Promise<TeamPerformanceMetrics['collaboration']> {
    return {
      pairProgrammingSessions: Math.floor(Math.random() * 20) + 10,
      crossTeamInteractions: Math.floor(Math.random() * 15) + 5,
      mentorshipSessions: Math.floor(Math.random() * 10) + 2,
      knowledgeSharingEvents: Math.floor(Math.random() * 8) + 2,
      averageResponseTime: Math.floor(Math.random() * 60) + 15, // 15-75 minutes
      collaborationNetworkDensity: Math.random() * 0.3 + 0.6 // 0.6-0.9
    };
  }

  private async calculateCodeQualityMetrics(
    teamMembers: TeamMember[],
    startDate: Date,
    endDate: Date
  ): Promise<TeamPerformanceMetrics['codeQuality']> {
    return {
      averageCodeReviewScore: Math.floor(Math.random() * 15) + 85, // 85-100
      testCoverage: Math.floor(Math.random() * 20) + 75, // 75-95%
      bugDensity: Math.random() * 2 + 0.5, // 0.5-2.5 bugs per KLOC
      technicalDebtRatio: Math.floor(Math.random() * 25) + 10, // 10-35%
      complianceScore: Math.floor(Math.random() * 10) + 90, // 90-100
      documentationCoverage: Math.floor(Math.random() * 30) + 60 // 60-90%
    };
  }

  private async calculateSkillsMetrics(
    teamMembers: TeamMember[],
    startDate: Date,
    endDate: Date
  ): Promise<TeamPerformanceMetrics['skills']> {
    // Mock skill gaps
    const skillGaps: SkillGap[] = [
      {
        skill: 'React',
        requiredLevel: 4,
        currentLevel: 2,
        affectedMembers: teamMembers.slice(0, 2).map(m => m.id),
        priority: 'high',
        suggestedActions: ['React training course', 'Pair programming with React expert']
      },
      {
        skill: 'DevOps',
        requiredLevel: 3,
        currentLevel: 1,
        affectedMembers: teamMembers.slice(1, 3).map(m => m.id),
        priority: 'medium',
        suggestedActions: ['Docker certification', 'CI/CD workshop']
      }
    ];

    const expertiseAreas: ExpertiseArea[] = [
      {
        skill: 'JavaScript',
        experts: teamMembers.slice(0, 3).map(m => m.id),
        proficiencyLevel: 4,
        utilization: 85,
        demandLevel: 5
      }
    ];

    const learningProgress: LearningProgress[] = teamMembers.map(member => ({
      userId: member.id,
      skill: 'TypeScript',
      startLevel: 2,
      currentLevel: 3,
      targetLevel: 4,
      progressRate: 0.5,
      completionETA: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 2 months
    }));

    return {
      skillGaps,
      expertiseAreas,
      learningProgress,
      crossTrainingOpportunities: ['Frontend-Backend knowledge sharing', 'DevOps training for developers']
    };
  }

  private async calculateTrends(
    teamId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeamPerformanceMetrics['trends']> {
    // Generate mock trend data for the last 30 days
    const days = 30;
    const generateTrend = (baseValue: number, variance: number): TrendData[] => {
      const data: TrendData[] = [];
      let currentValue = baseValue;
      
      for (let i = 0; i < days; i++) {
        const change = (Math.random() - 0.5) * variance;
        currentValue = Math.max(0, Math.min(100, currentValue + change));
        
        data.push({
          date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000),
          value: Math.round(currentValue * 100) / 100,
          change: i > 0 ? change : undefined
        });
      }
      
      return data;
    };

    return {
      velocityTrend: generateTrend(80, 5),
      qualityTrend: generateTrend(85, 3),
      collaborationTrend: generateTrend(75, 8),
      skillDevelopmentTrend: generateTrend(70, 4)
    };
  }

  private async generateTeamRecommendations(
    teamId: string,
    overview: TeamPerformanceMetrics['overview'],
    productivity: TeamPerformanceMetrics['productivity'],
    collaboration: TeamPerformanceMetrics['collaboration'],
    codeQuality: TeamPerformanceMetrics['codeQuality'],
    skills: TeamPerformanceMetrics['skills']
  ): Promise<TeamRecommendation[]> {
    const recommendations: TeamRecommendation[] = [];

    // Code quality recommendations
    if (codeQuality.averageCodeReviewScore < 80) {
      recommendations.push({
        id: 'improve-code-review',
        category: 'quality',
        priority: 'high',
        title: 'Improve Code Review Process',
        description: 'Code review scores are below target. Enhance review guidelines and training.',
        impact: 'high',
        effort: 'medium',
        suggestedActions: [
          'Create comprehensive code review checklist',
          'Provide code review training sessions',
          'Implement automated code quality gates'
        ],
        expectedOutcome: 'Increase average code review score by 15-20%',
        metrics: ['averageCodeReviewScore', 'bugDensity', 'technicalDebtRatio']
      });
    }

    // Collaboration recommendations
    if (collaboration.averageResponseTime > 60) {
      recommendations.push({
        id: 'improve-response-time',
        category: 'collaboration',
        priority: 'medium',
        title: 'Reduce Response Time',
        description: 'Team response time to questions and requests is above optimal range.',
        impact: 'medium',
        effort: 'low',
        suggestedActions: [
          'Establish communication SLAs',
          'Implement notification systems',
          'Schedule regular check-ins'
        ],
        expectedOutcome: 'Reduce average response time to under 30 minutes',
        metrics: ['averageResponseTime', 'collaborationScore']
      });
    }

    // Skills recommendations
    const criticalSkillGaps = skills.skillGaps.filter(gap => gap.priority === 'critical' || gap.priority === 'high');
    if (criticalSkillGaps.length > 0) {
      recommendations.push({
        id: 'address-skill-gaps',
        category: 'skills',
        priority: 'high',
        title: 'Address Critical Skill Gaps',
        description: `Critical skill gaps identified in: ${criticalSkillGaps.map(g => g.skill).join(', ')}`,
        impact: 'high',
        effort: 'high',
        suggestedActions: [
          'Prioritize training for critical skills',
          'Consider hiring specialists',
          'Establish mentorship programs'
        ],
        expectedOutcome: 'Close skill gaps and improve team capability',
        metrics: ['knowledgeDistribution', 'teamVelocity']
      });
    }

    return recommendations;
  }

  private getUserMetricsForPeriod(userId: string, startDate: Date, endDate: Date): CollaborationMetric[] {
    const allUserMetrics: CollaborationMetric[] = [];
    
    // Collect all metrics for this user
    for (const [key, metrics] of this.metrics.entries()) {
      if (key.startsWith(userId + '_')) {
        const filteredMetrics = metrics.filter(metric => 
          metric.timestamp >= startDate && metric.timestamp <= endDate
        );
        allUserMetrics.push(...filteredMetrics);
      }
    }
    
    return allUserMetrics;
  }

  private calculateIndividualProductivity(userMetrics: CollaborationMetric[]): IndividualPerformanceMetrics['productivity'] {
    // Mock implementation based on available metrics
    return {
      linesOfCode: this.getMetricSum(userMetrics, 'lines_of_code'),
      commits: this.getMetricSum(userMetrics, 'commits'),
      pullRequests: this.getMetricSum(userMetrics, 'pull_requests'),
      codeReviews: this.getMetricSum(userMetrics, 'code_reviews'),
      issuesResolved: this.getMetricSum(userMetrics, 'issues_resolved'),
      averageTaskComplexity: this.getMetricAverage(userMetrics, 'task_complexity'),
      focusTime: this.getMetricSum(userMetrics, 'focus_time')
    };
  }

  private calculateIndividualCollaboration(userMetrics: CollaborationMetric[]): IndividualPerformanceMetrics['collaboration'] {
    return {
      pairProgrammingSessions: this.getMetricSum(userMetrics, 'pair_programming'),
      helpRequestsGiven: this.getMetricSum(userMetrics, 'help_requests_given'),
      helpRequestsReceived: this.getMetricSum(userMetrics, 'help_requests_received'),
      mentoringSessions: this.getMetricSum(userMetrics, 'mentoring_sessions'),
      averageResponseTime: this.getMetricAverage(userMetrics, 'response_time'),
      collaborationScore: this.getMetricAverage(userMetrics, 'collaboration_score')
    };
  }

  private calculateIndividualCodeQuality(userMetrics: CollaborationMetric[]): IndividualPerformanceMetrics['codeQuality'] {
    return {
      averageReviewScore: this.getMetricAverage(userMetrics, 'review_score'),
      bugsIntroduced: this.getMetricSum(userMetrics, 'bugs_introduced'),
      testCoverage: this.getMetricAverage(userMetrics, 'test_coverage'),
      refactoringContributions: this.getMetricSum(userMetrics, 'refactoring_contributions'),
      documentationUpdates: this.getMetricSum(userMetrics, 'documentation_updates'),
      complianceViolations: this.getMetricSum(userMetrics, 'compliance_violations')
    };
  }

  private calculateIndividualSkills(userMetrics: CollaborationMetric[]): IndividualPerformanceMetrics['skills'] {
    return {
      currentSkills: {
        'JavaScript': 4,
        'TypeScript': 3,
        'React': 4,
        'Node.js': 3
      },
      skillsImproved: ['TypeScript', 'Testing'],
      learningGoals: ['DevOps', 'System Design'],
      certifications: ['AWS Developer'],
      trainingHours: this.getMetricSum(userMetrics, 'training_hours')
    };
  }

  private calculateIndividualWellbeing(userMetrics: CollaborationMetric[]): IndividualPerformanceMetrics['wellbeing'] {
    return {
      workLifeBalance: this.getMetricAverage(userMetrics, 'work_life_balance') || 75,
      burnoutRisk: this.getBurnoutRisk(userMetrics),
      satisfactionScore: this.getMetricAverage(userMetrics, 'satisfaction_score') || 80,
      stressLevel: this.getMetricAverage(userMetrics, 'stress_level') || 30,
      engagementLevel: this.getMetricAverage(userMetrics, 'engagement_level') || 85
    };
  }

  private calculateCareerDevelopment(userMetrics: CollaborationMetric[]): IndividualPerformanceMetrics['careerDevelopment'] {
    return {
      goalsProgress: {
        'Technical Leadership': 75,
        'System Architecture': 60,
        'Team Management': 40
      },
      promotionReadiness: 70,
      leadershipActivities: this.getMetricSum(userMetrics, 'leadership_activities'),
      crossFunctionalExperience: ['Frontend', 'Backend', 'DevOps'],
      recommendationsReceived: this.getMetricSum(userMetrics, 'recommendations_received')
    };
  }

  // Helper methods for metric calculations
  private getMetricSum(metrics: CollaborationMetric[], metricName: string): number {
    return metrics
      .filter(m => m.metric === metricName)
      .reduce((sum, m) => sum + m.value, 0);
  }

  private getMetricAverage(metrics: CollaborationMetric[], metricName: string): number {
    const relevant = metrics.filter(m => m.metric === metricName);
    if (relevant.length === 0) return 0;
    return relevant.reduce((sum, m) => sum + m.value, 0) / relevant.length;
  }

  private getBurnoutRisk(metrics: CollaborationMetric[]): 'low' | 'medium' | 'high' {
    const focusTime = this.getMetricSum(metrics, 'focus_time');
    const stressLevel = this.getMetricAverage(metrics, 'stress_level');
    
    if (focusTime > 8 * 60 || stressLevel > 70) return 'high';
    if (focusTime > 6 * 60 || stressLevel > 50) return 'medium';
    return 'low';
  }

  private analyzeTrend(trendData: TrendData[]): 'increasing' | 'decreasing' | 'stable' {
    if (trendData.length < 2) return 'stable';
    
    const start = trendData[0].value;
    const end = trendData[trendData.length - 1].value;
    const change = ((end - start) / start) * 100;
    
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  private calculateCentrality(userId: string, teamMembers: TeamMember[]): number {
    // Simplified centrality calculation
    return Math.random(); // Mock implementation
  }

  private calculateInfluence(userId: string, teamMembers: TeamMember[]): number {
    // Simplified influence calculation
    return Math.random(); // Mock implementation
  }

  private calculateCollaborationEdges(teamMembers: TeamMember[], period: { start: Date; end: Date }): any[] {
    // Mock collaboration edges
    const edges = [];
    for (let i = 0; i < teamMembers.length; i++) {
      for (let j = i + 1; j < teamMembers.length; j++) {
        if (Math.random() > 0.5) { // 50% chance of collaboration
          edges.push({
            source: teamMembers[i].id,
            target: teamMembers[j].id,
            weight: Math.random(),
            type: 'collaboration'
          });
        }
      }
    }
    return edges;
  }

  private calculateNetworkDensity(nodes: any[], edges: any[]): number {
    const maxPossibleEdges = (nodes.length * (nodes.length - 1)) / 2;
    return edges.length / maxPossibleEdges;
  }

  private calculateClusteringCoefficient(nodes: any[], edges: any[]): number {
    // Simplified clustering coefficient
    return Math.random() * 0.5 + 0.3; // Mock: 0.3-0.8
  }

  private analyzeCommunicationPatterns(edges: any[]): { [pattern: string]: number } {
    return {
      'direct_messages': edges.filter(e => e.type === 'direct').length,
      'group_discussions': edges.filter(e => e.type === 'group').length,
      'code_reviews': edges.filter(e => e.type === 'review').length,
      'pair_programming': edges.filter(e => e.type === 'pairing').length
    };
  }

  /**
   * Real calculation methods to replace mock data
   */
  private async calculateRealTeamVelocity(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let totalCompletedTasks = 0;
    let totalStoryPoints = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      const completedTasks = userMetrics.filter(m => m.metric === 'task_completed').length;
      const storyPoints = userMetrics
        .filter(m => m.metric === 'story_points_completed')
        .reduce((sum, m) => sum + m.value, 0);
      
      totalCompletedTasks += completedTasks;
      totalStoryPoints += storyPoints;
    }
    
    // Calculate velocity as story points per sprint (assuming 2-week sprints)
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const sprintCount = Math.max(1, daysDiff / 14);
    
    return Math.min(100, Math.max(0, (totalStoryPoints / sprintCount) * 10)); // Scale to 0-100
  }

  private async calculateRealCollaborationScore(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let totalInteractions = 0;
    let pairProgrammingSessions = 0;
    let codeReviews = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      totalInteractions += userMetrics.filter(m => m.metric === 'collaboration_event').length;
      pairProgrammingSessions += userMetrics.filter(m => m.metric === 'pair_programming_session').length;
      codeReviews += userMetrics.filter(m => m.metric === 'code_review_given').length;
    }
    
    const baseScore = Math.min(50, totalInteractions);
    const pairBonus = Math.min(25, pairProgrammingSessions * 2);
    const reviewBonus = Math.min(25, codeReviews);
    
    return Math.min(100, baseScore + pairBonus + reviewBonus);
  }

  private async calculateRealCodeQualityScore(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let totalReviewScores = 0;
    let reviewCount = 0;
    let bugCount = 0;
    let testCoverage = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      
      const reviewScores = userMetrics.filter(m => m.metric === 'code_review_score');
      totalReviewScores += reviewScores.reduce((sum, m) => sum + m.value, 0);
      reviewCount += reviewScores.length;
      
      bugCount += userMetrics.filter(m => m.metric === 'bug_introduced').length;
      
      const coverageMetrics = userMetrics.filter(m => m.metric === 'test_coverage');
      testCoverage += coverageMetrics.reduce((sum, m) => sum + m.value, 0) / coverageMetrics.length || 0;
    }
    
    const averageReviewScore = reviewCount > 0 ? totalReviewScores / reviewCount : 85;
    const bugPenalty = Math.min(20, bugCount * 2);
    const coverageBonus = Math.min(15, (testCoverage / teamMembers.length) * 0.15);
    
    return Math.min(100, Math.max(0, averageReviewScore - bugPenalty + coverageBonus));
  }

  private async calculateRealKnowledgeDistribution(teamMembers: TeamMember[]): Promise<number> {
    const allSkills = new Set<string>();
    const memberSkillCounts = new Map<string, number>();
    
    for (const member of teamMembers) {
      member.skills.forEach(skill => {
        allSkills.add(skill);
        memberSkillCounts.set(skill, (memberSkillCounts.get(skill) || 0) + 1);
      });
    }
    
    // Calculate skill distribution score
    let distributionScore = 0;
    for (const [skill, count] of memberSkillCounts.entries()) {
      const coverage = count / teamMembers.length;
      // Ideal is having 2-3 people per skill (not everyone, not just one)
      if (coverage >= 0.2 && coverage <= 0.6) {
        distributionScore += 10;
      } else if (coverage >= 0.1) {
        distributionScore += 5;
      }
    }
    
    return Math.min(100, distributionScore);
  }

  private calculateLinesOfCode(userMetrics: CollaborationMetric[]): number {
    return userMetrics
      .filter(m => m.metric === 'lines_of_code_written')
      .reduce((sum, m) => sum + m.value, 0);
  }

  private calculateCommits(userMetrics: CollaborationMetric[]): number {
    return userMetrics
      .filter(m => m.metric === 'commit_created')
      .length;
  }

  private calculateReviews(userMetrics: CollaborationMetric[]): number {
    return userMetrics
      .filter(m => m.metric === 'code_review_given')
      .length;
  }

  private async calculateAverageSessionLength(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let totalSessionTime = 0;
    let sessionCount = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      const sessionMetrics = userMetrics.filter(m => m.metric === 'session_duration');
      totalSessionTime += sessionMetrics.reduce((sum, m) => sum + m.value, 0);
      sessionCount += sessionMetrics.length;
    }
    
    return sessionCount > 0 ? totalSessionTime / sessionCount : 90; // Default 90 minutes
  }

  private async calculatePeakActivityHours(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number[]> {
    const hourCounts = new Array(24).fill(0);
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      for (const metric of userMetrics) {
        const hour = metric.timestamp.getHours();
        hourCounts[hour]++;
      }
    }
    
    // Return top 6 most active hours
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(item => item.hour)
      .sort((a, b) => a - b);
  }

  private async calculateCodeReusability(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let reusedComponents = 0;
    let totalComponents = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      reusedComponents += userMetrics.filter(m => m.metric === 'component_reused').length;
      totalComponents += userMetrics.filter(m => m.metric === 'component_created').length;
    }
    
    return totalComponents > 0 ? Math.min(100, (reusedComponents / totalComponents) * 100) : 70;
  }

  private async countPairProgrammingSessions(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let sessions = 0;
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      sessions += userMetrics.filter(m => m.metric === 'pair_programming_session').length;
    }
    return sessions / 2; // Divide by 2 as each session involves 2 people
  }

  private async countCrossTeamInteractions(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let interactions = 0;
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      interactions += userMetrics.filter(m => m.metric === 'cross_team_interaction').length;
    }
    return interactions;
  }

  private async countMentorshipSessions(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let sessions = 0;
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      sessions += userMetrics.filter(m => m.metric === 'mentorship_session').length;
    }
    return sessions;
  }

  private async countKnowledgeSharingEvents(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let events = 0;
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      events += userMetrics.filter(m => m.metric === 'knowledge_sharing_event').length;
    }
    return events;
  }

  private async calculateAverageResponseTime(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      const responseMetrics = userMetrics.filter(m => m.metric === 'response_time');
      totalResponseTime += responseMetrics.reduce((sum, m) => sum + m.value, 0);
      responseCount += responseMetrics.length;
    }
    
    return responseCount > 0 ? totalResponseTime / responseCount : 45; // Default 45 minutes
  }

  private async calculateNetworkDensity(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    const interactions = new Set<string>();
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      userMetrics
        .filter(m => m.metric === 'collaboration_event' && m.context?.sessionId)
        .forEach(m => {
          if (m.context?.sessionId) {
            interactions.add(`${member.id}-${m.context.sessionId}`);
          }
        });
    }
    
    const maxPossibleConnections = (teamMembers.length * (teamMembers.length - 1)) / 2;
    return maxPossibleConnections > 0 ? Math.min(1, interactions.size / maxPossibleConnections) : 0.5;
  }

  private async calculateAverageReviewScore(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let totalScore = 0;
    let reviewCount = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      const reviewScores = userMetrics.filter(m => m.metric === 'code_review_score');
      totalScore += reviewScores.reduce((sum, m) => sum + m.value, 0);
      reviewCount += reviewScores.length;
    }
    
    return reviewCount > 0 ? totalScore / reviewCount : 85;
  }

  private async calculateTestCoverage(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let totalCoverage = 0;
    let memberCount = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      const coverageMetrics = userMetrics.filter(m => m.metric === 'test_coverage');
      if (coverageMetrics.length > 0) {
        totalCoverage += coverageMetrics.reduce((sum, m) => sum + m.value, 0) / coverageMetrics.length;
        memberCount++;
      }
    }
    
    return memberCount > 0 ? totalCoverage / memberCount : 80;
  }

  private async calculateBugDensity(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let bugCount = 0;
    let linesOfCode = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      bugCount += userMetrics.filter(m => m.metric === 'bug_introduced').length;
      linesOfCode += userMetrics
        .filter(m => m.metric === 'lines_of_code_written')
        .reduce((sum, m) => sum + m.value, 0);
    }
    
    return linesOfCode > 0 ? (bugCount / linesOfCode) * 1000 : 1.0; // Bugs per KLOC
  }

  private async calculateTechnicalDebt(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let debtPoints = 0;
    let totalCodePoints = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      debtPoints += userMetrics
        .filter(m => m.metric === 'technical_debt_introduced')
        .reduce((sum, m) => sum + m.value, 0);
      totalCodePoints += userMetrics
        .filter(m => m.metric === 'code_complexity_points')
        .reduce((sum, m) => sum + m.value, 0);
    }
    
    return totalCodePoints > 0 ? Math.min(50, (debtPoints / totalCodePoints) * 100) : 15;
  }

  private async calculateComplianceScore(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let complianceViolations = 0;
    let complianceChecks = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      complianceViolations += userMetrics.filter(m => m.metric === 'compliance_violation').length;
      complianceChecks += userMetrics.filter(m => m.metric === 'compliance_check_run').length;
    }
    
    if (complianceChecks === 0) return 95;
    const violationRate = complianceViolations / complianceChecks;
    return Math.max(60, 100 - (violationRate * 100));
  }

  private async calculateDocumentationCoverage(teamMembers: TeamMember[], startDate: Date, endDate: Date): Promise<number> {
    let documentedItems = 0;
    let totalItems = 0;
    
    for (const member of teamMembers) {
      const userMetrics = this.getUserMetricsForPeriod(member.id, startDate, endDate);
      documentedItems += userMetrics.filter(m => m.metric === 'documentation_created').length;
      totalItems += userMetrics.filter(m => m.metric === 'code_item_created').length;
    }
    
    return totalItems > 0 ? Math.min(100, (documentedItems / totalItems) * 100) : 75;
  }
}