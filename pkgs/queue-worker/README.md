# @pgflow/queue-worker

A lightweight, standalone queue worker for processing PGMQ (PostgreSQL Message Queue) messages. This is a simplified module extracted from `@pgflow/edge-worker` that focuses exclusively on queue operations without the complexity of workflow orchestration.

## Overview

`@pgflow/queue-worker` provides a simple, reliable way to process messages from PGMQ queues with:

- ⚡ **Simple API** - Easy to use with minimal configuration
- 🔄 **Automatic Retries** - Configurable retry strategies (fixed or exponential backoff)
- 🎯 **Concurrency Control** - Process multiple messages in parallel with limits
- 🛡️ **Graceful Shutdown** - Properly handles termination signals
- 📦 **Lightweight** - Minimal dependencies, focused on queue operations only

## Installation

```bash
npm install @pgflow/queue-worker
```

## Quick Start

```typescript
import { QueueWorker } from '@pgflow/queue-worker';

// Create a worker with a message handler
const worker = new QueueWorker(
  async (message, context) => {
    console.log('Processing message:', message);
    
    // Your message processing logic here
    await processMessage(message);
  },
  {
    connectionString: 'postgresql://user:pass@localhost:5432/db',
    queueName: 'my_tasks',
  }
);

// Start the worker
await worker.start();

// To stop gracefully:
// await worker.stop();
// await worker.close();
```

## Configuration

### QueueWorkerConfig

```typescript
interface QueueWorkerConfig {
  /** PostgreSQL connection string (required) */
  connectionString: string;
  
  /** Name of the PGMQ queue to process (default: 'tasks') */
  queueName?: string;
  
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
```

### Retry Configuration

The worker supports two retry strategies:

#### Fixed Delay

```typescript
const worker = new QueueWorker(handler, {
  connectionString: 'postgresql://...',
  retry: {
    strategy: 'fixed',
    limit: 5,        // Maximum number of retry attempts
    baseDelay: 3,    // Delay in seconds between retries
  }
});
```

#### Exponential Backoff

```typescript
const worker = new QueueWorker(handler, {
  connectionString: 'postgresql://...',
  retry: {
    strategy: 'exponential',
    limit: 5,        // Maximum number of retry attempts
    baseDelay: 3,    // Initial delay in seconds
    maxDelay: 300,   // Maximum delay cap (5 minutes)
  }
});
```

With exponential backoff, the delay grows as: `baseDelay * 2^(attempt - 1)`, capped at `maxDelay`.

## Message Handler

The message handler receives two parameters:

```typescript
async function handler(message: TPayload, context: MessageContext) {
  // message - Your message payload (parsed JSON)
  // context - Additional information and utilities
}
```

### Message Context

```typescript
interface MessageContext<TPayload> {
  /** The raw PGMQ message with metadata */
  rawMessage: PgmqMessage<TPayload>;
  
  /** Environment variables */
  env: Record<string, string | undefined>;
  
  /** Abort signal for graceful shutdown */
  shutdownSignal: AbortSignal;
}
```

### PGMQ Message Structure

```typescript
interface PgmqMessage<TPayload> {
  msg_id: number;           // Unique message ID
  read_ct: number;          // Number of times read (for retry tracking)
  enqueued_at: string;      // Timestamp when enqueued
  vt: string;               // Visibility timeout
  message: TPayload;        // Your message payload
}
```

## Advanced Usage

### Custom Environment Variables

```typescript
const worker = new QueueWorker(
  async (message, context) => {
    const apiKey = context.env.API_KEY;
    // Use environment variables in your handler
  },
  {
    connectionString: 'postgresql://...',
    env: {
      API_KEY: process.env.API_KEY,
      DEBUG: 'true',
    }
  }
);
```

### Graceful Shutdown

```typescript
const worker = new QueueWorker(handler, config);

// Start the worker
const workerPromise = worker.start();

// Handle shutdown signals
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await worker.stop();
  await worker.close();
  process.exit(0);
});

// Wait for the worker
await workerPromise;
```

### Checking Abort Signal

```typescript
const worker = new QueueWorker(
  async (message, context) => {
    // Check if shutdown was requested
    if (context.shutdownSignal.aborted) {
      console.log('Shutdown requested, aborting processing');
      return;
    }
    
    // Long-running operation with abort check
    await longRunningTask(context.shutdownSignal);
  },
  config
);
```

## Direct Queue Operations

You can also use the `Queue` class directly for manual queue operations:

```typescript
import { Queue } from '@pgflow/queue-worker';
import postgres from 'postgres';

const sql = postgres('postgresql://...');
const queue = new Queue(sql, 'my_queue');

// Create queue
await queue.create();

// Send a message
await queue.send({ task: 'process_data', data: { id: 123 } });

// Manual polling
const messages = await queue.readWithPoll(10, 60, 5, 200);

// Process and archive
for (const msg of messages) {
  await processMessage(msg.message);
  await queue.archive(msg.msg_id);
}
```

## Requirements

- PostgreSQL with PGMQ extension installed
- Node.js 18+ (for modern JavaScript features)

## Differences from @pgflow/edge-worker

`@pgflow/queue-worker` is a simplified version that:

- **Focuses only on queue processing** - No workflow/flow orchestration
- **Simpler API** - Just queues and message handlers
- **Fewer dependencies** - No dependency on `@pgflow/dsl` or `@pgflow/core`
- **Standalone usage** - Can be used independently without the pgflow ecosystem

Use `@pgflow/queue-worker` when you need:
- Simple background job processing
- Task queue workers without workflows
- Lightweight message processing

Use `@pgflow/edge-worker` when you need:
- Complex workflow orchestration
- Step dependencies and DAGs
- Integration with pgflow's DSL and type system

## License

AGPL-3.0

## Related Packages

- [`@pgflow/edge-worker`](../edge-worker/README.md) - Full-featured worker with workflow support
- [`@pgflow/core`](../core/README.md) - PostgreSQL workflow engine
- [`@pgflow/dsl`](../dsl/README.md) - TypeScript workflow definitions
