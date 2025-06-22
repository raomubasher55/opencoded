import 'dotenv/config';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import fetch from 'node-fetch';
import { createServiceLogger, errorHandler } from '@opencode/shared-utils';
import { registerDirectHandlers } from './direct-handlers';
import { loadBalancer, loadBalancerMiddleware } from './middleware/load-balancer';
import { cacheManager, cacheMiddleware, getCacheStrategy, cacheInvalidationMiddleware } from './middleware/cache';
import { rateLimiter, createRateLimitMiddleware, rateLimitStatsHandler } from './middleware/advanced-rate-limit';

const logger = createServiceLogger('api-gateway');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3003', 'http://localhost:8080'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// Advanced rate limiting with different rules for different endpoints
app.use('/api/auth', createRateLimitMiddleware('auth'));
app.use('/api/llm', createRateLimitMiddleware('llm'));
app.use('/api/files', createRateLimitMiddleware('files'));
app.use('/api/collaboration', createRateLimitMiddleware('collaboration'));
app.use('/api/', createRateLimitMiddleware('default'));

// Caching middleware with endpoint-specific strategies
app.use('/api/llm/models', cacheMiddleware(getCacheStrategy('/api/llm/models')));
app.use('/api/tools', cacheMiddleware(getCacheStrategy('/api/tools')));
app.use('/api/files', cacheMiddleware(getCacheStrategy('/api/files')));
app.use('/api/sessions', cacheMiddleware(getCacheStrategy('/api/sessions')));

// Cache invalidation for write operations
app.use('/api/files', cacheInvalidationMiddleware(['/api/files.*']));
app.use('/api/sessions', cacheInvalidationMiddleware(['/api/sessions.*']));
app.use('/api/tools', cacheInvalidationMiddleware(['/api/tools.*']));

// Health check with enhanced metrics
app.get('/health', (req, res) => {
  const serviceStats = loadBalancer.getServiceStats();
  const cacheStats = cacheManager.getStats();
  const rateLimitStats = rateLimiter.getStats();
  
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: serviceStats,
    cache: cacheStats,
    rateLimit: rateLimitStats
  });
});

// Admin endpoints for monitoring
app.get('/admin/stats', (req, res) => {
  res.json({
    loadBalancer: loadBalancer.getServiceStats(),
    cache: cacheManager.getStats(),
    rateLimit: rateLimiter.getStats()
  });
});

app.get('/admin/cache/stats', (req, res) => {
  res.json(cacheManager.getStats());
});

app.post('/admin/cache/clear', (req, res) => {
  cacheManager.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

app.get('/admin/rate-limit/stats', rateLimitStatsHandler);

// Register all direct handlers for all services
registerDirectHandlers(app);

// No need for proxy middleware anymore, but keeping commented out code for reference
// We're no longer using proxy middleware since all routes are handled directly.
// This commented out code is kept for reference only.

// const services = [
//   {
//     path: '/api/files',
//     target: process.env.FILE_SERVICE_URL || 'http://localhost:4001/api/files',
//     changeOrigin: true
//   },
//   {
//     path: '/api/watch',
//     target: process.env.FILE_SERVICE_URL || 'http://localhost:4001/api/watch',
//     changeOrigin: true
//   },
//   {
//     path: '/api/search',
//     target: process.env.FILE_SERVICE_URL || 'http://localhost:4001/api/search',
//     changeOrigin: true
//   },
//   {
//     path: '/api/llm',
//     target: process.env.LLM_SERVICE_URL || 'http://localhost:4002/api/llm',
//     changeOrigin: true
//   },
//   {
//     path: '/api/sessions',
//     target: process.env.SESSION_SERVICE_URL || 'http://localhost:4004/api/sessions',
//     changeOrigin: true
//   },
//   {
//     path: '/api/tools',
//     target: process.env.TOOLS_SERVICE_URL || 'http://localhost:4003/api/tools',
//     changeOrigin: true
//   },
//   {
//     path: '/api/executions',
//     target: process.env.TOOLS_SERVICE_URL || 'http://localhost:4003/api/executions',
//     changeOrigin: true
//   },
//   {
//     path: '/api/analysis',
//     target: process.env.TOOLS_SERVICE_URL || 'http://localhost:4003/api/analysis',
//     changeOrigin: true
//   }
// ];

// // Apply proxy middleware
// services.forEach(service => {
//   logger.info(`Setting up proxy: ${service.path} -> ${service.target}`);
  
//   const proxyMiddleware = createProxyMiddleware({
//     target: service.target,
//     changeOrigin: service.changeOrigin,
//     pathRewrite: service.pathRewrite || {
//       [`^${service.path}`]: ''
//     },
//     // Add logging for debugging
//     onProxyReq: (proxyReq, req, res) => {
//       logger.info(`Proxying request: ${req.method} ${req.url} -> ${service.target}`);
//     },
//     onError: (err, req, res) => {
//       logger.error(`Proxy error: ${err.message}`);
//       res.status(500).json({ error: 'Proxy error', message: err.message });
//     }
//   });
  
//   app.use(service.path, proxyMiddleware);
// });

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  loadBalancer.stop();
  cacheManager.stop();
  rateLimiter.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  loadBalancer.stop();
  cacheManager.stop();
  rateLimiter.stop();
  process.exit(0);
});

export default app;