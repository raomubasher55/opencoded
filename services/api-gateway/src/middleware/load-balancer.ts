import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('load-balancer');

export interface ServiceInstance {
  url: string;
  weight: number;
  healthy: boolean;
  lastCheck: Date;
  responseTime: number;
  activeConnections: number;
}

export class LoadBalancer {
  private instances: Map<string, ServiceInstance[]> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeInstances();
    this.startHealthChecks();
  }

  private initializeInstances(): void {
    // Initialize service instances from environment variables
    const services = {
      'auth': this.parseServiceInstances(process.env.AUTH_SERVICE_INSTANCES || 'http://localhost:3003:1'),
      'file': this.parseServiceInstances(process.env.FILE_SERVICE_INSTANCES || 'http://localhost:4001:1'),
      'llm': this.parseServiceInstances(process.env.LLM_SERVICE_INSTANCES || 'http://localhost:4002:1'),
      'session': this.parseServiceInstances(process.env.SESSION_SERVICE_INSTANCES || 'http://localhost:4004:1'),
      'tools': this.parseServiceInstances(process.env.TOOLS_SERVICE_INSTANCES || 'http://localhost:4003:1'),
      'collaboration': this.parseServiceInstances(process.env.COLLABORATION_SERVICE_INSTANCES || 'http://localhost:4005:1')
    };

    for (const [serviceName, instances] of Object.entries(services)) {
      this.instances.set(serviceName, instances);
      this.roundRobinCounters.set(serviceName, 0);
      logger.info(`Initialized ${instances.length} instances for ${serviceName} service`);
    }
  }

  private parseServiceInstances(instancesStr: string): ServiceInstance[] {
    return instancesStr.split(',').map(instance => {
      const [url, weight = '1'] = instance.trim().split(':');
      return {
        url: url.includes('://') ? url : `http://${url}`,
        weight: parseInt(weight, 10),
        healthy: true,
        lastCheck: new Date(),
        responseTime: 0,
        activeConnections: 0
      };
    });
  }

  public getServiceInstance(serviceName: string, strategy: 'round-robin' | 'weighted' | 'least-connections' = 'round-robin'): ServiceInstance | null {
    const instances = this.instances.get(serviceName);
    if (!instances || instances.length === 0) {
      logger.warn(`No instances available for service: ${serviceName}`);
      return null;
    }

    const healthyInstances = instances.filter(instance => instance.healthy);
    if (healthyInstances.length === 0) {
      logger.warn(`No healthy instances available for service: ${serviceName}`);
      return instances[0]; // Fallback to first instance
    }

    switch (strategy) {
      case 'round-robin':
        return this.getRoundRobinInstance(serviceName, healthyInstances);
      case 'weighted':
        return this.getWeightedInstance(healthyInstances);
      case 'least-connections':
        return this.getLeastConnectionsInstance(healthyInstances);
      default:
        return this.getRoundRobinInstance(serviceName, healthyInstances);
    }
  }

  private getRoundRobinInstance(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const instance = instances[counter % instances.length];
    this.roundRobinCounters.set(serviceName, counter + 1);
    return instance;
  }

  private getWeightedInstance(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0]; // Fallback
  }

  private getLeastConnectionsInstance(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((prev, current) => 
      current.activeConnections < prev.activeConnections ? current : prev
    );
  }

  public incrementConnections(serviceName: string, instanceUrl: string): void {
    const instances = this.instances.get(serviceName);
    if (instances) {
      const instance = instances.find(i => i.url === instanceUrl);
      if (instance) {
        instance.activeConnections++;
      }
    }
  }

  public decrementConnections(serviceName: string, instanceUrl: string): void {
    const instances = this.instances.get(serviceName);
    if (instances) {
      const instance = instances.find(i => i.url === instanceUrl);
      if (instance) {
        instance.activeConnections = Math.max(0, instance.activeConnections - 1);
      }
    }
  }

  public updateResponseTime(serviceName: string, instanceUrl: string, responseTime: number): void {
    const instances = this.instances.get(serviceName);
    if (instances) {
      const instance = instances.find(i => i.url === instanceUrl);
      if (instance) {
        // Exponential moving average
        instance.responseTime = instance.responseTime === 0 ? responseTime : 
          (instance.responseTime * 0.7) + (responseTime * 0.3);
      }
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthChecks(): Promise<void> {
    for (const [serviceName, instances] of this.instances.entries()) {
      for (const instance of instances) {
        try {
          const startTime = Date.now();
          const response = await fetch(`${instance.url}/health`, {
            method: 'GET',
            timeout: 5000
          });
          
          const responseTime = Date.now() - startTime;
          instance.responseTime = responseTime;
          instance.healthy = response.ok;
          instance.lastCheck = new Date();
          
          if (!response.ok) {
            logger.warn(`Health check failed for ${serviceName} instance: ${instance.url}`);
          }
        } catch (error) {
          instance.healthy = false;
          instance.lastCheck = new Date();
          logger.error(`Health check error for ${serviceName} instance ${instance.url}:`, error);
        }
      }
    }
  }

  public getServiceStats(): { [serviceName: string]: any } {
    const stats: { [serviceName: string]: any } = {};
    
    for (const [serviceName, instances] of this.instances.entries()) {
      const healthyCount = instances.filter(i => i.healthy).length;
      const totalConnections = instances.reduce((sum, i) => sum + i.activeConnections, 0);
      const avgResponseTime = instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length;
      
      stats[serviceName] = {
        totalInstances: instances.length,
        healthyInstances: healthyCount,
        totalConnections,
        averageResponseTime: Math.round(avgResponseTime),
        instances: instances.map(i => ({
          url: i.url,
          healthy: i.healthy,
          responseTime: i.responseTime,
          activeConnections: i.activeConnections,
          lastCheck: i.lastCheck
        }))
      };
    }
    
    return stats;
  }

  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const loadBalancer = new LoadBalancer();

export const loadBalancerMiddleware = (serviceName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const instance = loadBalancer.getServiceInstance(serviceName, 'least-connections');
    if (!instance) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: `No healthy instances available for ${serviceName} service`
      });
    }
    
    req.targetServiceUrl = instance.url;
    req.targetServiceName = serviceName;
    
    // Track connections
    loadBalancer.incrementConnections(serviceName, instance.url);
    
    // Clean up on response end
    res.on('finish', () => {
      loadBalancer.decrementConnections(serviceName, instance.url);
    });
    
    next();
  };
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      targetServiceUrl?: string;
      targetServiceName?: string;
    }
  }
}