/**
 * @pgflow/queue-worker
 * 
 * A lightweight queue worker for processing PGMQ messages.
 * This is a simplified version that focuses only on queue operations,
 * without the complexity of flow orchestration.
 */

export { QueueWorker } from './QueueWorker.js';
export { Queue } from './Queue.js';

export type {
  Json,
  MessageHandler,
  MessageContext,
  PgmqMessage,
  QueueWorkerConfig,
  RetryConfig,
} from './types.js';
