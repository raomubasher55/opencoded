import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { createServiceLogger } from '@opencode/shared-utils';
import routes from './routes';
import { authenticateJWT, errorHandler, notFoundHandler } from './middleware';
import { FileWatcherService } from './services';

// Create logger
const logger = createServiceLogger('file-service');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'file-service',
    timestamp: new Date().toISOString()
  });
});

// API routes - protected by JWT authentication
app.use('/api', authenticateJWT, routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Create file watcher service instance
const fileWatcherService = new FileWatcherService();

// Start server
const server = app.listen(PORT, () => {
  logger.info(`File Service running on port ${PORT}`);
  
  // Log service information
  logger.info('Service Information:');
  logger.info('- File operations API: http://localhost:' + PORT + '/api/files');
  logger.info('- File watching API: http://localhost:' + PORT + '/api/watch');
  logger.info('- Search API: http://localhost:' + PORT + '/api/search');
  logger.info('- Terminal API: http://localhost:' + PORT + '/api/terminal');
  logger.info('- Health check: http://localhost:' + PORT + '/health');
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Clean up file watchers
  await fileWatcherService.cleanup();
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Clean up file watchers
  await fileWatcherService.cleanup();
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

export default app;