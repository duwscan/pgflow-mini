import type { Queue } from './Queue.js';
import type { Json, PgmqMessage } from './types.js';

/**
 * Configuration for the poller
 */
export interface PollerConfig {
  batchSize: number;
  maxPollSeconds: number;
  pollIntervalMs: number;
  visibilityTimeout: number;
}

/**
 * Polls the queue for new messages
 */
export class Poller<TPayload extends Json = Json> {
  constructor(
    private readonly queue: Queue<TPayload>,
    private readonly config: PollerConfig,
    private readonly signal: AbortSignal
  ) {}

  /**
   * Polls for a batch of messages
   */
  async poll(): Promise<PgmqMessage<TPayload>[]> {
    if (this.signal.aborted) {
      return [];
    }

    const messages = await this.queue.readWithPoll(
      this.config.batchSize,
      this.config.visibilityTimeout,
      this.config.maxPollSeconds,
      this.config.pollIntervalMs
    );

    return messages;
  }
}
