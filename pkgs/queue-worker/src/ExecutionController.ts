import { newQueue, type Queue as PromiseQueue } from '@henrygd/queue';
import type { MessageExecutor } from './MessageExecutor.js';
import type { Json } from './types.js';

/**
 * Controls concurrent execution of message handlers
 */
export class ExecutionController<TPayload extends Json = Json> {
  private promiseQueue: PromiseQueue;

  constructor(
    maxConcurrent: number,
    _signal: AbortSignal
  ) {
    this.promiseQueue = newQueue(maxConcurrent);
  }

  /**
   * Schedules a message executor to run
   */
  async schedule(executor: MessageExecutor<TPayload>): Promise<void> {
    return await this.promiseQueue.add(async () => {
      try {
        await executor.execute();
      } catch (error) {
        console.error(`Executor failed for message ${executor.msgId}:`, error);
        throw error;
      }
    });
  }

  /**
   * Waits for all scheduled executions to complete
   */
  async awaitCompletion(): Promise<void> {
    await this.promiseQueue.done();
  }
}
