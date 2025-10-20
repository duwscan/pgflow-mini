/**
 * Core types for the queue worker
 */

// Simple JSON type definition
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

/**
 * Message structure from PGMQ
 */
export interface PgmqMessage<TPayload extends Json = Json> {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: TPayload;
}

/**
 * Handler function that processes messages
 */
export type MessageHandler<TPayload extends Json = Json> = (
  message: TPayload,
  context: MessageContext<TPayload>
) => Promise<void> | void;

/**
 * Context provided to message handlers
 */
export interface MessageContext<TPayload extends Json = Json> {
  /** The raw PGMQ message with metadata */
  rawMessage: PgmqMessage<TPayload>;
  /** Environment variables */
  env: Record<string, string | undefined>;
  /** Abort signal for graceful shutdown */
  shutdownSignal: AbortSignal;
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 5) */
  limit: number;
  /** Strategy for calculating retry delay */
  strategy: 'fixed' | 'exponential';
  /** Base delay in seconds between retries */
  baseDelay: number;
  /** Maximum delay for exponential backoff (only for exponential strategy) */
  maxDelay?: number;
}

/**
 * Configuration for the queue worker
 */
export interface QueueWorkerConfig {
  /** Name of the PGMQ queue to process (default: 'tasks') */
  queueName?: string;
  /** PostgreSQL connection string */
  connectionString: string;
  /** Maximum number of concurrent message handlers (default: 10) */
  maxConcurrent?: number;
  /** Maximum number of PostgreSQL connections (default: 4) */
  maxPgConnections?: number;
  /** Maximum time to poll for messages in seconds (default: 5) */
  maxPollSeconds?: number;
  /** Interval between polls in milliseconds (default: 200) */
  pollIntervalMs?: number;
  /** Visibility timeout for messages in seconds (default: 10) */
  visibilityTimeout?: number;
  /** Number of messages to fetch in each batch (default: 10) */
  batchSize?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Environment variables to pass to handlers */
  env?: Record<string, string | undefined>;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedQueueWorkerConfig extends Required<Omit<QueueWorkerConfig, 'retry'>> {
  retry: RetryConfig;
}
