import { createServiceLogger } from '@opencode/shared-utils';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'events';

const logger = createServiceLogger('worker-pool');

/**
 * Task to be executed by a worker
 */
export interface Task {
  id: string;
  type: string;
  data: any;
  priority: number;
  createdAt: Date;
}

/**
 * Task result
 */
export interface TaskResult {
  taskId: string;
  result: any;
  error?: string;
  executionTime: number;
}

/**
 * Worker status
 */
enum WorkerStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  TERMINATED = 'terminated'
}

/**
 * Worker information
 */
interface WorkerInfo {
  id: string;
  worker: Worker;
  status: WorkerStatus;
  currentTask?: Task;
  taskCount: number;
  errors: number;
  createdAt: Date;
  lastActiveAt: Date;
}

/**
 * Worker pool configuration
 */
interface WorkerPoolConfig {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeout?: number;
  maxTasksPerWorker?: number;
  taskTimeout?: number;
}

/**
 * Worker pool service for distributed computing
 */
export class WorkerPool extends EventEmitter {
  private workers: Map<string, WorkerInfo> = new Map();
  private taskQueue: Task[] = [];
  private taskResults: Map<string, TaskResult> = new Map();
  private taskCallbacks: Map<string, { resolve: Function; reject: Function }> = new Map();
  private taskTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private workerScriptPath: string;
  private config: Required<WorkerPoolConfig>;
  private isShuttingDown: boolean = false;
  private monitorInterval?: NodeJS.Timeout;
  
  /**
   * Create a new worker pool
   * @param workerScriptPath Path to worker script
   * @param config Worker pool configuration
   */
  constructor(workerScriptPath: string, config?: WorkerPoolConfig) {
    super();
    
    this.workerScriptPath = workerScriptPath;
    
    // Default configuration
    this.config = {
      minWorkers: config?.minWorkers ?? Math.max(1, Math.floor(os.cpus().length / 2)),
      maxWorkers: config?.maxWorkers ?? os.cpus().length,
      idleTimeout: config?.idleTimeout ?? 60000, // 1 minute
      maxTasksPerWorker: config?.maxTasksPerWorker ?? 100,
      taskTimeout: config?.taskTimeout ?? 30000 // 30 seconds
    };
    
    // Initialize worker pool
    this.initialize();
    
    logger.info('Worker pool initialized', {
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
      cpus: os.cpus().length
    });
  }
  
  /**
   * Initialize the worker pool
   */
  private initialize(): void {
    // Create initial workers
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.createWorker();
    }
    
    // Start monitoring interval
    this.monitorInterval = setInterval(() => this.monitorPool(), 10000);
  }
  
  /**
   * Create a new worker
   */
  private createWorker(): WorkerInfo {
    const workerId = uuidv4();
    
    const worker = new Worker(this.workerScriptPath, {
      workerData: { workerId }
    });
    
    // Create worker info
    const workerInfo: WorkerInfo = {
      id: workerId,
      worker,
      status: WorkerStatus.IDLE,
      taskCount: 0,
      errors: 0,
      createdAt: new Date(),
      lastActiveAt: new Date()
    };
    
    // Set up event handlers
    worker.on('message', (message) => this.handleWorkerMessage(workerId, message));
    worker.on('error', (error) => this.handleWorkerError(workerId, error));
    worker.on('exit', (code) => this.handleWorkerExit(workerId, code));
    
    // Store worker info
    this.workers.set(workerId, workerInfo);
    
    logger.debug('Created worker', { workerId });
    
    return workerInfo;
  }
  
  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    // Update worker status
    workerInfo.lastActiveAt = new Date();
    
    // Handle different message types
    if (message.type === 'task_result') {
      this.handleTaskResult(message.taskId, message.result, message.error, message.executionTime);
      
      // Mark worker as idle
      workerInfo.status = WorkerStatus.IDLE;
      workerInfo.currentTask = undefined;
      
      // Process next task if queue is not empty
      if (this.taskQueue.length > 0) {
        setImmediate(() => this.processNextTask());
      }
    } else if (message.type === 'task_progress') {
      // Emit progress event
      this.emit('task_progress', {
        taskId: message.taskId,
        progress: message.progress
      });
    } else if (message.type === 'ready') {
      // Worker is ready
      workerInfo.status = WorkerStatus.IDLE;
      
      // Process next task if queue is not empty
      if (this.taskQueue.length > 0) {
        setImmediate(() => this.processNextTask());
      }
    }
  }
  
  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, error: Error): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    logger.error('Worker error', {
      workerId,
      error: error.message,
      stack: error.stack
    });
    
    // Update worker status
    workerInfo.status = WorkerStatus.ERROR;
    workerInfo.errors++;
    
    // Handle current task if any
    if (workerInfo.currentTask) {
      this.handleTaskResult(
        workerInfo.currentTask.id,
        null,
        `Worker error: ${error.message}`,
        0
      );
      workerInfo.currentTask = undefined;
    }
    
    // Terminate worker
    this.terminateWorker(workerId);
    
    // Create new worker if not shutting down
    if (!this.isShuttingDown) {
      this.createWorker();
    }
  }
  
  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: string, code: number): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    logger.info('Worker exited', {
      workerId,
      code
    });
    
    // Update worker status
    workerInfo.status = WorkerStatus.TERMINATED;
    
    // Handle current task if any
    if (workerInfo.currentTask) {
      this.handleTaskResult(
        workerInfo.currentTask.id,
        null,
        `Worker exited with code ${code}`,
        0
      );
      workerInfo.currentTask = undefined;
    }
    
    // Remove worker
    this.workers.delete(workerId);
    
    // Create new worker if not shutting down and below minimum
    if (!this.isShuttingDown && this.workers.size < this.config.minWorkers) {
      this.createWorker();
    }
  }
  
  /**
   * Handle task result
   */
  private handleTaskResult(
    taskId: string,
    result: any,
    error?: string,
    executionTime: number = 0
  ): void {
    // Clear task timeout
    if (this.taskTimeouts.has(taskId)) {
      clearTimeout(this.taskTimeouts.get(taskId)!);
      this.taskTimeouts.delete(taskId);
    }
    
    // Store task result
    const taskResult: TaskResult = {
      taskId,
      result,
      error,
      executionTime
    };
    
    this.taskResults.set(taskId, taskResult);
    
    // Resolve or reject promise
    const callback = this.taskCallbacks.get(taskId);
    if (callback) {
      if (error) {
        callback.reject(new Error(error));
      } else {
        callback.resolve(result);
      }
      
      this.taskCallbacks.delete(taskId);
    }
    
    // Emit events
    if (error) {
      this.emit('task_error', { taskId, error });
    } else {
      this.emit('task_complete', { taskId, result, executionTime });
    }
  }
  
  /**
   * Terminate a worker
   */
  private terminateWorker(workerId: string): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    try {
      workerInfo.worker.terminate();
      workerInfo.status = WorkerStatus.TERMINATED;
      
      logger.debug('Terminated worker', { workerId });
    } catch (error) {
      logger.error('Error terminating worker', {
        workerId,
        error
      });
    }
  }
  
  /**
   * Monitor the worker pool
   */
  private monitorPool(): void {
    if (this.isShuttingDown) return;
    
    try {
      const now = Date.now();
      
      // Check for idle workers to terminate
      for (const [workerId, workerInfo] of this.workers.entries()) {
        if (
          workerInfo.status === WorkerStatus.IDLE &&
          this.workers.size > this.config.minWorkers &&
          (now - workerInfo.lastActiveAt.getTime()) > this.config.idleTimeout
        ) {
          logger.debug('Terminating idle worker', {
            workerId,
            idleTime: Math.round((now - workerInfo.lastActiveAt.getTime()) / 1000) + 's'
          });
          
          this.terminateWorker(workerId);
          this.workers.delete(workerId);
        }
        
        // Check if worker has processed too many tasks
        if (
          workerInfo.taskCount >= this.config.maxTasksPerWorker &&
          workerInfo.status === WorkerStatus.IDLE
        ) {
          logger.debug('Replacing worker that reached max tasks', {
            workerId,
            taskCount: workerInfo.taskCount
          });
          
          this.terminateWorker(workerId);
          this.workers.delete(workerId);
          this.createWorker();
        }
      }
      
      // Log statistics
      logger.info('Worker pool status', {
        workers: this.workers.size,
        idle: Array.from(this.workers.values()).filter(w => w.status === WorkerStatus.IDLE).length,
        busy: Array.from(this.workers.values()).filter(w => w.status === WorkerStatus.BUSY).length,
        queueLength: this.taskQueue.length
      });
      
      // Scale pool based on queue length
      this.scalePool();
    } catch (error) {
      logger.error('Error monitoring worker pool', error);
    }
  }
  
  /**
   * Scale the worker pool based on demand
   */
  private scalePool(): void {
    // If queue is empty, no need to scale up
    if (this.taskQueue.length === 0) return;
    
    // Count idle workers
    const idleWorkers = Array.from(this.workers.values())
      .filter(w => w.status === WorkerStatus.IDLE).length;
    
    // If no idle workers and queue has tasks, scale up
    if (idleWorkers === 0 && this.workers.size < this.config.maxWorkers) {
      const numToCreate = Math.min(
        this.config.maxWorkers - this.workers.size,
        Math.ceil(this.taskQueue.length / 2)
      );
      
      logger.debug(`Scaling up worker pool, creating ${numToCreate} new workers`);
      
      for (let i = 0; i < numToCreate; i++) {
        this.createWorker();
      }
    }
  }
  
  /**
   * Enqueue a task
   * @param type Task type
   * @param data Task data
   * @param priority Task priority (higher number = higher priority)
   * @returns Promise that resolves with task result
   */
  async enqueueTask(
    type: string,
    data: any,
    priority: number = 0
  ): Promise<any> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }
    
    // Create task
    const task: Task = {
      id: uuidv4(),
      type,
      data,
      priority,
      createdAt: new Date()
    };
    
    // Add to queue
    this.addToQueue(task);
    
    // Create promise for task result
    const promise = new Promise((resolve, reject) => {
      this.taskCallbacks.set(task.id, { resolve, reject });
      
      // Set timeout for task
      const timeout = setTimeout(() => {
        this.handleTaskResult(
          task.id,
          null,
          `Task timed out after ${this.config.taskTimeout}ms`,
          this.config.taskTimeout
        );
      }, this.config.taskTimeout);
      
      this.taskTimeouts.set(task.id, timeout);
    });
    
    // Process next task
    setImmediate(() => this.processNextTask());
    
    return promise;
  }
  
  /**
   * Add a task to the queue
   */
  private addToQueue(task: Task): void {
    // Insert task in priority order
    const index = this.taskQueue.findIndex(t => t.priority < task.priority);
    
    if (index === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(index, 0, task);
    }
    
    logger.debug('Task added to queue', {
      taskId: task.id,
      type: task.type,
      queueLength: this.taskQueue.length
    });
    
    // Emit event
    this.emit('task_queued', {
      taskId: task.id,
      type: task.type,
      queueLength: this.taskQueue.length
    });
  }
  
  /**
   * Process the next task in the queue
   */
  private processNextTask(): void {
    if (this.isShuttingDown || this.taskQueue.length === 0) return;
    
    // Find an idle worker
    const idleWorker = Array.from(this.workers.values())
      .find(w => w.status === WorkerStatus.IDLE);
    
    if (!idleWorker) {
      // No idle workers, scale up if possible
      this.scalePool();
      return;
    }
    
    // Get next task
    const task = this.taskQueue.shift();
    if (!task) return;
    
    // Update worker status
    idleWorker.status = WorkerStatus.BUSY;
    idleWorker.currentTask = task;
    idleWorker.taskCount++;
    idleWorker.lastActiveAt = new Date();
    
    // Send task to worker
    idleWorker.worker.postMessage({
      type: 'execute_task',
      task
    });
    
    logger.debug('Task assigned to worker', {
      taskId: task.id,
      workerId: idleWorker.id,
      type: task.type
    });
    
    // Emit event
    this.emit('task_started', {
      taskId: task.id,
      workerId: idleWorker.id,
      type: task.type
    });
  }
  
  /**
   * Get a task result
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.taskResults.get(taskId);
  }
  
  /**
   * Get all task results
   */
  getAllTaskResults(): TaskResult[] {
    return Array.from(this.taskResults.values());
  }
  
  /**
   * Clear task results
   */
  clearTaskResults(): void {
    this.taskResults.clear();
  }
  
  /**
   * Get worker pool statistics
   */
  getStats(): {
    workers: number;
    idle: number;
    busy: number;
    queueLength: number;
    completedTasks: number;
    avgExecutionTime: number;
  } {
    // Calculate average execution time
    let totalTime = 0;
    let count = 0;
    
    for (const result of this.taskResults.values()) {
      if (result.executionTime > 0) {
        totalTime += result.executionTime;
        count++;
      }
    }
    
    const avgExecutionTime = count > 0 ? totalTime / count : 0;
    
    return {
      workers: this.workers.size,
      idle: Array.from(this.workers.values()).filter(w => w.status === WorkerStatus.IDLE).length,
      busy: Array.from(this.workers.values()).filter(w => w.status === WorkerStatus.BUSY).length,
      queueLength: this.taskQueue.length,
      completedTasks: this.taskResults.size,
      avgExecutionTime
    };
  }
  
  /**
   * Shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    logger.info('Shutting down worker pool');
    
    this.isShuttingDown = true;
    
    // Clear monitoring interval
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
    
    // Reject all pending tasks
    for (const task of this.taskQueue) {
      this.handleTaskResult(
        task.id,
        null,
        'Worker pool is shutting down',
        0
      );
    }
    
    this.taskQueue = [];
    
    // Terminate all workers
    const terminationPromises = Array.from(this.workers.keys()).map(workerId => {
      return new Promise<void>(resolve => {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) {
          resolve();
          return;
        }
        
        // Set a timeout to force termination
        const timeout = setTimeout(() => {
          logger.warn('Force terminating worker', { workerId });
          this.terminateWorker(workerId);
          this.workers.delete(workerId);
          resolve();
        }, 5000);
        
        // Try graceful termination first
        workerInfo.worker.postMessage({ type: 'shutdown' });
        
        workerInfo.worker.once('exit', () => {
          clearTimeout(timeout);
          this.workers.delete(workerId);
          resolve();
        });
      });
    });
    
    // Wait for all workers to terminate
    await Promise.all(terminationPromises);
    
    logger.info('Worker pool shutdown complete');
  }
}

// Worker thread code
if (!isMainThread) {
  const { workerId } = workerData;
  
  // Send ready message
  parentPort!.postMessage({ type: 'ready', workerId });
  
  // Listen for messages
  parentPort!.on('message', async (message) => {
    if (message.type === 'execute_task') {
      const { task } = message;
      
      // Execute task
      try {
        const startTime = Date.now();
        
        // Send progress updates
        const sendProgress = (progress: number) => {
          parentPort!.postMessage({
            type: 'task_progress',
            taskId: task.id,
            progress
          });
        };
        
        // Execute task based on type
        let result;
        
        switch (task.type) {
          case 'compute':
            result = await computeTask(task.data, sendProgress);
            break;
            
          case 'process':
            result = await processTask(task.data, sendProgress);
            break;
            
          default:
            throw new Error(`Unknown task type: ${task.type}`);
        }
        
        const executionTime = Date.now() - startTime;
        
        // Send result
        parentPort!.postMessage({
          type: 'task_result',
          taskId: task.id,
          result,
          executionTime
        });
      } catch (error) {
        // Send error
        parentPort!.postMessage({
          type: 'task_result',
          taskId: task.id,
          result: null,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else if (message.type === 'shutdown') {
      // Exit gracefully
      process.exit(0);
    }
  });
  
  // Example task handlers
  async function computeTask(data: any, sendProgress: (progress: number) => void): Promise<any> {
    // Simulate CPU-intensive task
    const { iterations = 1000000 } = data;
    
    let result = 0;
    
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i);
      
      if (i % (iterations / 10) === 0) {
        sendProgress(i / iterations * 100);
      }
    }
    
    return { result };
  }
  
  async function processTask(data: any, sendProgress: (progress: number) => void): Promise<any> {
    // Simulate data processing task
    const { items = [] } = data;
    
    const results = [];
    
    for (let i = 0; i < items.length; i++) {
      results.push(processItem(items[i]));
      sendProgress(i / items.length * 100);
    }
    
    return { results };
  }
  
  function processItem(item: any): any {
    // Example processing function
    return {
      id: item.id,
      processed: true,
      value: item.value * 2
    };
  }
}

// Example usage:
/*
const pool = new WorkerPool(path.join(__dirname, 'worker-pool.js'), {
  minWorkers: 2,
  maxWorkers: 4
});

pool.on('task_queued', (event) => {
  console.log(`Task queued: ${event.taskId}`);
});

pool.on('task_started', (event) => {
  console.log(`Task started: ${event.taskId}`);
});

pool.on('task_progress', (event) => {
  console.log(`Task progress: ${event.taskId} - ${event.progress}%`);
});

pool.on('task_complete', (event) => {
  console.log(`Task completed: ${event.taskId} in ${event.executionTime}ms`);
});

pool.on('task_error', (event) => {
  console.error(`Task error: ${event.taskId} - ${event.error}`);
});

// Example tasks
const results = await Promise.all([
  pool.enqueueTask('compute', { iterations: 1000000 }, 2),
  pool.enqueueTask('process', { items: Array(100).fill(0).map((_, i) => ({ id: i, value: i })) }, 1)
]);

console.log('Results:', results);

await pool.shutdown();
*/