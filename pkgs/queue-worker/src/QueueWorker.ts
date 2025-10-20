import postgres from 'postgres';
import { Queue } from './Queue.js';
import { Poller } from './Poller.js';
import { ExecutionController } from './ExecutionController.js';
import { MessageExecutor } from './MessageExecutor.js';
import type {
  Json,
  MessageHandler,
  QueueWorkerConfig,
  ResolvedQueueWorkerConfig,
  MessageContext,
  RetryConfig,
} from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  queueName: 'tasks',
  maxConcurrent: 10,
  maxPgConnections: 4,
  maxPollSeconds: 5,
  pollIntervalMs: 200,
  visibilityTimeout: 10,
  batchSize: 10,
  env: {},
} as const;

const DEFAULT_RETRY: RetryConfig = {
  strategy: 'exponential' as const,
  limit: 5,
  baseDelay: 3,
  maxDelay: 300,
};

/**
 * Main queue worker that processes messages from PGMQ
 */
export class QueueWorker<TPayload extends Json = Json> {
  private sql: postgres.Sql;
  private queue: Queue<TPayload>;
  private poller: Poller<TPayload>;
  private controller: ExecutionController<TPayload>;
  private config: ResolvedQueueWorkerConfig;
  private abortController: AbortController;
  private isRunning = false;

  constructor(
    private readonly handler: MessageHandler<TPayload>,
    config: QueueWorkerConfig
  ) {
    // Resolve configuration with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      retry: config.retry ?? DEFAULT_RETRY,
    };

    // Initialize abort controller
    this.abortController = new AbortController();

    // Create SQL connection
    this.sql = postgres(this.config.connectionString, {
      max: this.config.maxPgConnections,
      prepare: false,
    });

    // Create queue
    this.queue = new Queue<TPayload>(this.sql, this.config.queueName);

    // Create poller
    this.poller = new Poller<TPayload>(
      this.queue,
      {
        batchSize: this.config.batchSize,
        maxPollSeconds: this.config.maxPollSeconds,
        pollIntervalMs: this.config.pollIntervalMs,
        visibilityTimeout: this.config.visibilityTimeout,
      },
      this.abortController.signal
    );

    // Create execution controller
    this.controller = new ExecutionController<TPayload>(
      this.config.maxConcurrent,
      this.abortController.signal
    );
  }

  /**
   * Starts the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Worker is already running');
    }

    this.isRunning = true;
    console.log(`Starting queue worker for queue: ${this.config.queueName}`);

    // Ensure queue exists
    await this.queue.create();

    // Main processing loop
    while (!this.abortController.signal.aborted) {
      try {
        await this.processBatch();
      } catch (error) {
        console.error('Error in processing batch:', error);
        // Continue processing even if a batch fails
      }
    }

    // Wait for all pending executions to complete
    await this.controller.awaitCompletion();
    
    console.log('Queue worker stopped');
    this.isRunning = false;
  }

  /**
   * Processes a single batch of messages
   */
  private async processBatch(): Promise<void> {
    // Poll for messages
    const messages = await this.poller.poll();

    if (this.abortController.signal.aborted) {
      return;
    }

    // Schedule all messages for execution
    const schedulePromises = messages.map((message) => {
      // Create context for this message
      const context: MessageContext<TPayload> = {
        rawMessage: message,
        env: this.config.env,
        shutdownSignal: this.abortController.signal,
      };

      // Create executor
      const executor = new MessageExecutor<TPayload>(
        this.queue,
        this.handler,
        message,
        context,
        this.config.retry,
        this.abortController.signal
      );

      // Schedule execution
      return this.controller.schedule(executor);
    });

    // Wait for all messages to be scheduled
    await Promise.all(schedulePromises);
  }

  /**
   * Stops the worker gracefully
   */
  async stop(): Promise<void> {
    console.log('Stopping queue worker...');
    this.abortController.abort();
    
    // The main loop will exit and wait for completion
    // External callers may also want to await completion
    await this.controller.awaitCompletion();
  }

  /**
   * Closes the database connection
   */
  async close(): Promise<void> {
    await this.sql.end();
  }
}
