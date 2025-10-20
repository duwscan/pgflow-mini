# Comparison: @pgflow/queue-worker vs @pgflow/edge-worker

## Quick Decision Guide

**Use @pgflow/queue-worker when:**
- ✅ You need simple background job processing
- ✅ You want a lightweight solution with minimal dependencies
- ✅ Your tasks are independent (no dependencies between jobs)
- ✅ You want a simple, easy-to-learn API
- ✅ You don't need workflow orchestration

**Use @pgflow/edge-worker when:**
- ✅ You need multi-step workflows (DAGs)
- ✅ Steps have dependencies on each other
- ✅ You need the pgflow DSL and type inference
- ✅ You want integration with the full pgflow ecosystem
- ✅ You need advanced features like map steps, flow aggregation, etc.

## Detailed Comparison

| Aspect | @pgflow/queue-worker | @pgflow/edge-worker |
|--------|---------------------|---------------------|
| **Primary Use Case** | Simple queue processing | Workflow orchestration |
| **API Complexity** | Simple (1 main class) | Complex (Flow DSL + Worker) |
| **Dependencies** | 2 (postgres, @henrygd/queue) | 4+ (postgres, @henrygd/queue, @pgflow/core, @pgflow/dsl, @supabase/supabase-js) |
| **Learning Curve** | Low (5 minutes) | Medium (requires Flow DSL knowledge) |
| **Bundle Size** | ~6.6KB | Larger (includes DSL runtime) |
| **Configuration** | Simple object | Flow definition + worker config |
| **Type Safety** | Generic message types | Flow DSL type inference |
| **Step Dependencies** | No (independent tasks) | Yes (DAG support) |
| **Retry Logic** | Built-in (exponential/fixed) | Configurable per step |
| **Concurrency** | Configurable | Configurable |
| **Graceful Shutdown** | ✅ Yes | ✅ Yes |
| **Context Object** | Simple (env, signal, rawMessage) | Rich (sql, supabase, stepTask, etc.) |

## Code Examples

### @pgflow/queue-worker (Simple)

```typescript
import { QueueWorker } from '@pgflow/queue-worker';

// Define message type
interface EmailJob {
  to: string;
  subject: string;
  body: string;
}

// Create worker
const worker = new QueueWorker<EmailJob>(
  async (message, context) => {
    // Process message
    await sendEmail(message.to, message.subject, message.body);
  },
  {
    connectionString: process.env.DATABASE_URL,
    queueName: 'emails',
    maxConcurrent: 5,
    retry: {
      strategy: 'exponential',
      limit: 3,
      baseDelay: 5,
    },
  }
);

// Start processing
await worker.start();
```

### @pgflow/edge-worker (Flow-based)

```typescript
import { EdgeWorker } from '@pgflow/edge-worker';
import { Flow } from '@pgflow/dsl/supabase';

// Define flow with multiple steps
const EmailWorkflow = new Flow<{ userId: string }>({
  slug: 'send_welcome_email',
})
  .step({ slug: 'fetch_user' }, async (input, context) => {
    const user = await context.supabase
      .from('users')
      .select('*')
      .eq('id', input.run.userId)
      .single();
    return user.data;
  })
  .step({ slug: 'generate_email' }, async (input) => {
    return {
      to: input.fetch_user.email,
      subject: 'Welcome!',
      body: `Hello ${input.fetch_user.name}!`,
    };
  })
  .step({ slug: 'send_email' }, async (input, context) => {
    await sendEmail(
      input.generate_email.to,
      input.generate_email.subject,
      input.generate_email.body
    );
    return { sent: true };
  });

// Start worker
await EdgeWorker.start(EmailWorkflow);
```

## Performance Characteristics

| Metric | @pgflow/queue-worker | @pgflow/edge-worker |
|--------|---------------------|---------------------|
| **Startup Time** | Fast (~100ms) | Medium (needs to load DSL) |
| **Memory Usage** | Low | Medium (DSL + runtime) |
| **Processing Overhead** | Minimal | Medium (state management) |
| **Database Queries** | Direct PGMQ calls | PGMQ + pgflow schema queries |

## Feature Matrix

| Feature | queue-worker | edge-worker |
|---------|-------------|-------------|
| PGMQ Integration | ✅ | ✅ |
| Message Processing | ✅ | ✅ |
| Retry Logic | ✅ | ✅ |
| Concurrency Control | ✅ | ✅ |
| Graceful Shutdown | ✅ | ✅ |
| **Advanced Features** | | |
| Multi-step Workflows | ❌ | ✅ |
| Step Dependencies | ❌ | ✅ |
| Flow DSL | ❌ | ✅ |
| Type Inference | Basic | Advanced |
| Map Steps | ❌ | ✅ |
| Array Steps | ❌ | ✅ |
| Output Aggregation | ❌ | ✅ |
| Real-time Progress | ❌ | ✅ (with @pgflow/client) |
| Flow Compilation | ❌ | ✅ |

## Migration Path

If you start with `@pgflow/queue-worker` and later need workflows:

1. Install `@pgflow/edge-worker` and `@pgflow/dsl`
2. Convert your handler to a Flow definition
3. Deploy the flow with the CLI
4. Update worker to use `EdgeWorker.start(flow)`

Example migration:

**Before (queue-worker):**
```typescript
const worker = new QueueWorker(handler, config);
```

**After (edge-worker):**
```typescript
const flow = new Flow({ slug: 'my_flow' })
  .step({ slug: 'process' }, handler);

await EdgeWorker.start(flow);
```

## Recommendations

### Choose @pgflow/queue-worker if:
- You're building a simple task queue
- You want minimal setup and dependencies
- Your jobs don't depend on each other
- You prefer a straightforward API

### Choose @pgflow/edge-worker if:
- You need workflow orchestration
- Steps have dependencies (A → B → C)
- You want compile-time type safety across steps
- You need the full pgflow ecosystem
- You want visual flow representation

## Conclusion

Both modules serve different needs:
- **@pgflow/queue-worker**: Simple, lightweight, perfect for basic queuing
- **@pgflow/edge-worker**: Powerful, feature-rich, perfect for workflows

Choose based on your specific requirements!
