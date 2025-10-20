import type { Json, MessageHandler, MessageContext, RetryConfig, PgmqMessage } from './types.js';
import type { Queue } from './Queue.js';

/**
 * Calculates retry delay based on the retry configuration
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  switch (config.strategy) {
    case 'fixed':
      return config.baseDelay;
    case 'exponential': {
      const delay = config.baseDelay * Math.pow(2, attempt - 1);
      return Math.min(delay, config.maxDelay ?? 300);
    }
  }
}

/**
 * Executes a single message handler with retry logic
 */
export class MessageExecutor<TPayload extends Json = Json> {
  constructor(
    private readonly queue: Queue<TPayload>,
    private readonly handler: MessageHandler<TPayload>,
    private readonly message: PgmqMessage<TPayload>,
    private readonly context: MessageContext<TPayload>,
    private readonly retryConfig: RetryConfig,
    private readonly signal: AbortSignal
  ) {}

  get msgId(): number {
    return this.message.msg_id;
  }

  /**
   * Executes the message handler and handles retries/archival
   */
  async execute(): Promise<void> {
    try {
      // Check if already aborted
      if (this.signal.aborted) {
        return;
      }

      // Execute the handler
      await this.handler(this.message.message, this.context);

      // Success - archive the message
      await this.queue.archive(this.msgId);
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Handles execution errors with retry logic
   */
  private async handleError(error: unknown): Promise<void> {
    // If aborted, let the message reappear for another worker
    if (this.signal.aborted) {
      return;
    }

    console.error(`Message ${this.msgId} failed:`, error);

    // Check if retries are available
    const maxAttempts = this.retryConfig.limit + 1; // +1 for initial attempt
    if (this.message.read_ct < maxAttempts) {
      // Retry is available - set visibility timeout
      const retryAttempt = this.message.read_ct;
      const delaySeconds = calculateRetryDelay(retryAttempt, this.retryConfig);
      
      console.log(
        `Retrying message ${this.msgId} in ${delaySeconds}s (attempt ${retryAttempt}/${maxAttempts - 1})`
      );
      
      await this.queue.setVisibilityTimeout(this.msgId, delaySeconds);
    } else {
      // No retries left - archive permanently
      console.log(`Message ${this.msgId} exceeded retry limit, archiving`);
      await this.queue.archive(this.msgId);
    }
  }
}
