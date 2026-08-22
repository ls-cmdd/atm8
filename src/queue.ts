import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import EventEmitter from 'events';

export interface WorkflowJobData {
  workflow?: any;
  workflowId?: string;
  node: any;
  userId?: string;
  context?: Record<string, any>;
}

export interface QueueAddOptions {
  delay?: number;
}

class InMemoryWorkflowQueue extends EventEmitter {
  private jobCounter = 0;
  private workerHandler: ((job: { data: WorkflowJobData; id: string }) => Promise<any>) | null = null;

  setWorker(handler: (job: { data: WorkflowJobData; id: string }) => Promise<any>) {
    this.workerHandler = handler;
  }

  async add(name: string, data: WorkflowJobData, options?: QueueAddOptions): Promise<{ id: string; data: WorkflowJobData }> {
    this.jobCounter++;
    const jobId = `job_${Date.now()}_${this.jobCounter}`;
    const job = { id: jobId, data };

    const delayMs = options?.delay || 0;
    if (delayMs > 0) {
      setTimeout(() => {
        if (this.workerHandler) {
          this.workerHandler(job).catch(err => {
            console.error(`[InMemoryQueue] Error executing job ${jobId}:`, err.message);
          });
        }
      }, delayMs);
    } else {
      setImmediate(() => {
        if (this.workerHandler) {
          this.workerHandler(job).catch(err => {
            console.error(`[InMemoryQueue] Error executing job ${jobId}:`, err.message);
          });
        }
      });
    }

    return job;
  }
}

export class QueueManager {
  private bullQueue: Queue | null = null;
  private bullWorker: Worker | null = null;
  private inMemoryQueue = new InMemoryWorkflowQueue();
  private isUsingRedis = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const client = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          retryStrategy(times) {
            return Math.min(times * 500, 5000);
          }
        });

        client.on('error', (err) => {
          console.warn('[Redis] Connection warning:', err.message);
        });

        this.bullQueue = new Queue('workflow-queue', { connection: client });
        this.isUsingRedis = true;
        console.log('[QueueManager] Initialized with Redis/BullMQ connection');
      } catch (err: any) {
        console.warn('[QueueManager] Redis initialization failed, using In-Memory Queue:', err.message);
        this.isUsingRedis = false;
      }
    } else {
      console.log('[QueueManager] No REDIS_URL provided, running In-Memory Queue engine');
    }
  }

  async add(name: string, data: WorkflowJobData, options?: QueueAddOptions) {
    if (this.isUsingRedis && this.bullQueue) {
      try {
        return await this.bullQueue.add(name, data, options);
      } catch (err: any) {
        console.warn('[QueueManager] BullMQ add failed, falling back to in-memory queue:', err.message);
        return await this.inMemoryQueue.add(name, data, options);
      }
    }
    return await this.inMemoryQueue.add(name, data, options);
  }

  initWorker(handler: (job: { data: WorkflowJobData; id?: string }) => Promise<any>) {
    this.inMemoryQueue.setWorker(handler);

    if (this.isUsingRedis && process.env.REDIS_URL) {
      try {
        const workerClient = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false
        });
        workerClient.on('error', (err) => {
          console.warn('[Redis Worker] Connection warning:', err.message);
        });

        this.bullWorker = new Worker('workflow-queue', async (job: Job) => {
          return await handler(job);
        }, { connection: workerClient });
      } catch (err: any) {
        console.warn('[QueueManager] BullWorker creation failed:', err.message);
      }
    }
  }
}

export const workflowQueue = new QueueManager();
