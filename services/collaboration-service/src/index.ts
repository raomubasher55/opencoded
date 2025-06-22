import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketServer } from 'socket.io';
import { createServer } from 'http';
import { StatusCodes } from 'http-status-codes';
import { createServiceLogger } from '@opencode/shared-utils';

// Import routes
import { collaborationRoutes } from './routes';
import { initSocketServer } from './services/socket.service';
import { connectToDatabase } from './config/database';

const logger = createServiceLogger('collaboration-service');

// Create Express application
const app = express();
const PORT = process.env.PORT || 4005;

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Initialize Socket.IO
initSocketServer(io);

// Routes
app.use('/api', collaborationRoutes);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: 'UP',
    service: 'collaboration-service',
    timestamp: new Date().toISOString()
  });
});

// Connect to the database and start the server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Start the server
    httpServer.listen(PORT, () => {
      logger.info(`Collaboration Service running on port ${PORT}`);
      logger.info('Service Information:');
      logger.info(`- Collaboration API: http://localhost:${PORT}/api`);
      logger.info(`- WebSocket endpoint: ws://localhost:${PORT}/ws/collaboration`);
      logger.info(`- Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down server...');
  httpServer.close(() => {
    logger.info('Server shut down');
    process.exit(0);
  });
});

// Start the server
startServer();