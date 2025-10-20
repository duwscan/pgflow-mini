/**
 * Basic example of using @pgflow/queue-worker
 * 
 * This example demonstrates:
 * - Creating a queue worker
 * - Processing messages with a simple handler
 * - Graceful shutdown
 */

import { QueueWorker, Queue } from '@pgflow/queue-worker';
import postgres from 'postgres';

// Define your message type
interface EmailTask {
  type: 'email';
  to: string;
  subject: string;
  body: string;
}

// Create a message handler
const handler = async (message: EmailTask, context) => {
  console.log(`Processing email to: ${message.to}`);
  console.log(`Subject: ${message.subject}`);
  
  // Simulate sending email
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  console.log(`Email sent successfully to ${message.to}`);
};

// Main function
async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/pgflow';
  
  // Create and start the worker
  const worker = new QueueWorker<EmailTask>(handler, {
    connectionString,
    queueName: 'email_tasks',
    maxConcurrent: 5,
    retry: {
      strategy: 'exponential',
      limit: 3,
      baseDelay: 5,
      maxDelay: 60,
    },
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await worker.stop();
    await worker.close();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await worker.stop();
    await worker.close();
    process.exit(0);
  });
  
  console.log('Starting email worker...');
  await worker.start();
}

// Example: Sending messages to the queue
async function sendExampleMessages() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/pgflow';
  const sql = postgres(connectionString);
  const queue = new Queue<EmailTask>(sql, 'email_tasks');
  
  // Ensure queue exists
  await queue.create();
  
  // Send some test messages
  await queue.send({
    type: 'email',
    to: 'user1@example.com',
    subject: 'Welcome!',
    body: 'Welcome to our service!',
  });
  
  await queue.send({
    type: 'email',
    to: 'user2@example.com',
    subject: 'Newsletter',
    body: 'Here is our monthly newsletter...',
  });
  
  console.log('Sent 2 test messages to the queue');
  await sql.end();
}

// Run based on command line argument
const command = process.argv[2];

if (command === 'send') {
  sendExampleMessages().catch(console.error);
} else if (command === 'worker') {
  main().catch(console.error);
} else {
  console.log('Usage:');
  console.log('  node basic-example.js send    # Send test messages');
  console.log('  node basic-example.js worker  # Start worker');
}
