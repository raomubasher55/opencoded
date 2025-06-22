import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import helmet from 'helmet';
import http from 'http';
import mongoose from 'mongoose';
import apiRoutes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { initializeDefaultTools } from './models/tool.model';
import { EnterpriseMiddleware } from './middleware/enterprise.middleware';
import { EnterpriseSecurityMiddleware, SecurityLevel } from './middleware/enterprise-security.middleware';
import auditLogger, { AuditCategory, AuditSeverity } from './utils/audit-logger';
import { createRateLimiter } from './utils/rate-limiter';
import RealTimeAnalyticsService from './services/realtime-analytics.service';
import connectToDatabase from './config/database';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 4003;

// Connect to MongoDB
connectToDatabase()
  .then(() => {
    console.log('Connected to MongoDB successfully');
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
  });

// Create HTTP server for socket.io
const server = http.createServer(app);

// Initialize default tools
initializeDefaultTools();

// Basic middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev'));

// Enterprise security middleware
const isEnterpriseMode = process.env.ENTERPRISE_MODE === 'true';
const securityLevel = (process.env.SECURITY_LEVEL || 'standard') as SecurityLevel;

if (isEnterpriseMode) {
  console.log(`🔒 Running in Enterprise mode with ${securityLevel} security level`);
  
  // Add enterprise security headers
  app.use(EnterpriseSecurityMiddleware.securityHeaders(securityLevel));
  
  // Add request sanitization
  app.use(EnterpriseSecurityMiddleware.sanitizeRequests());
  
  // Add security logging
  app.use(EnterpriseSecurityMiddleware.securityLogging());
  
  // Add API rate limiting
  app.use(EnterpriseMiddleware.rateLimiter);
  
  // Add telemetry
  app.use(EnterpriseMiddleware.telemetry);
  
  // Encrypt sensitive fields in requests
  app.use(EnterpriseSecurityMiddleware.encryptSensitiveData(['apiKey', 'secret', 'password', 'token']));
  
  // Configure allowed IPs if defined in environment
  const allowedIPs = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];
  if (allowedIPs.length > 0) {
    app.use(EnterpriseSecurityMiddleware.ipRestriction(allowedIPs));
  }
} else {
  // For non-enterprise mode, still apply basic rate limiting
  app.use(createRateLimiter.standard());
}

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'tools-service',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Initialize real-time analytics service
let realTimeAnalytics: RealTimeAnalyticsService | null = null;

// Start server
server.listen(PORT, () => {
  console.log(`🔧 Tools Service running on port ${PORT}`);
  
  // Initialize real-time analytics if in enterprise mode
  if (isEnterpriseMode) {
    realTimeAnalytics = new RealTimeAnalyticsService(server);
    console.log('📊 Real-time analytics service initialized');
  }
  
  // Log service information
  console.log('Service Information:');
  console.log('- Tool management API: http://localhost:' + PORT + '/api/tools');
  console.log('- Tool execution API: http://localhost:' + PORT + '/api/executions');
  console.log('- Code analysis API: http://localhost:' + PORT + '/api/analysis');
  console.log('- Extension marketplace API: http://localhost:' + PORT + '/api/extensions');
  console.log('- Analytics API: http://localhost:' + PORT + '/api/analytics');
  console.log('- Health check: http://localhost:' + PORT + '/health');
  
  // Audit server start
  auditLogger.log({
    action: 'service_start',
    actor: {
      id: 'system',
      role: 'system'
    },
    category: AuditCategory.SYSTEM,
    severity: AuditSeverity.INFO,
    target: {
      type: 'service',
      name: 'tools-service'
    },
    details: { 
      port: PORT, 
      enterpriseMode: isEnterpriseMode, 
      securityLevel,
      realTimeAnalytics: realTimeAnalytics !== null
    },
    outcome: 'success'
  });
  
  console.log('\nAvailable endpoints:');
  console.log('GET    /api/tools                - Get all available tools');
  console.log('GET    /api/tools/:id            - Get tool by ID');
  console.log('POST   /api/tools                - Create a new tool (admin only)');
  console.log('PUT    /api/tools/:id            - Update a tool (admin only)');
  console.log('DELETE /api/tools/:id            - Delete a tool (admin only)');
  console.log('POST   /api/executions/tools/:id - Execute a tool');
  console.log('GET    /api/executions/:id       - Get execution status');
  console.log('GET    /api/executions           - Get all executions for current user');
  console.log('DELETE /api/executions/:id       - Cancel execution');
  console.log('POST   /api/analysis/ast         - Parse code into AST');
  console.log('POST   /api/analysis/quality     - Analyze code quality');
  console.log('POST   /api/analysis/dependencies - Analyze dependencies');
  console.log('POST   /api/analysis/security    - Scan for security vulnerabilities');
  console.log('POST   /api/analytics/track      - Track analytics event');
  console.log('GET    /api/analytics/users/:id  - Get user insights');
  console.log('GET    /api/analytics/teams/:id  - Get team insights');
  console.log('GET    /api/analytics/tools      - Get tools usage insights');
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('Shutting down tools-service...');
  
  // Shutdown real-time analytics service
  if (realTimeAnalytics) {
    realTimeAnalytics.stop();
    console.log('📊 Real-time analytics service stopped');
  }
  
  // Audit server shutdown
  auditLogger.log({
    action: 'service_shutdown',
    actor: {
      id: 'system',
      role: 'system'
    },
    category: AuditCategory.SYSTEM,
    severity: AuditSeverity.INFO,
    target: {
      type: 'service',
      name: 'tools-service'
    },
    outcome: 'success'
  });
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  
  // Audit server error
  auditLogger.log({
    action: 'uncaught_exception',
    actor: {
      id: 'system',
      role: 'system'
    },
    category: AuditCategory.SYSTEM,
    severity: AuditSeverity.CRITICAL,
    target: {
      type: 'service',
      name: 'tools-service'
    },
    details: { error: error.message, stack: error.stack },
    outcome: 'failure',
    reason: error.message
  });
  
  process.exit(1);
});

// Export app for testing
export default app;