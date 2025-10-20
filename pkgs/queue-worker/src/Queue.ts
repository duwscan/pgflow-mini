import type postgres from 'postgres';
import type { Json, PgmqMessage } from './types.js';

/**
 * Queue class that wraps PGMQ operations
 */
export class Queue<TPayload extends Json = Json> {
  constructor(
    private readonly sql: postgres.Sql,
    readonly queueName: string
  ) {}

  /**
   * Creates a queue if it doesn't exist
   */
  async create(): Promise<void> {
    await this.sql`
      SELECT * FROM pgmq.create(${this.queueName})
      WHERE NOT EXISTS (
        SELECT 1 FROM pgmq.list_queues() WHERE queue_name = ${this.queueName}
      );
    `;
  }

  /**
   * Sends a message to the queue
   */
  async send(message: TPayload): Promise<void> {
    const msgJson = JSON.stringify(message);
    await this.sql`
      SELECT pgmq.send(
        queue_name => ${this.queueName},
        msg => ${msgJson}::jsonb
      )
    `;
  }

  /**
   * Polls for messages with long polling support
   */
  async readWithPoll(
    batchSize: number,
    visibilityTimeout: number,
    maxPollSeconds: number,
    pollIntervalMs: number
  ): Promise<PgmqMessage<TPayload>[]> {
    return await this.sql<PgmqMessage<TPayload>[]>`
      SELECT *
      FROM pgflow.read_with_poll(
        queue_name => ${this.queueName},
        vt => ${visibilityTimeout},
        qty => ${batchSize},
        max_poll_seconds => ${maxPollSeconds},
        poll_interval_ms => ${pollIntervalMs}
      );
    `;
  }

  /**
   * Archives a message (marks it as processed)
   */
  async archive(msgId: number): Promise<void> {
    await this.sql`
      SELECT pgmq.archive(
        queue_name => ${this.queueName},
        msg_id => ${msgId}::bigint
      );
    `;
  }

  /**
   * Sets the visibility timeout for a message
   * This is used for retry delays
   */
  async setVisibilityTimeout(
    msgId: number,
    offsetSeconds: number
  ): Promise<void> {
    await this.sql`
      UPDATE ${this.sql('pgmq.q_' + this.queueName)}
      SET vt = (clock_timestamp() + make_interval(secs => ${offsetSeconds}))
      WHERE msg_id = ${msgId}::bigint;
    `;
  }
}
