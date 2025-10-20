import { describe, it, expect } from 'vitest';
import { QueueWorker, Queue } from '../index.js';

describe('queue-worker', () => {
  describe('exports', () => {
    it('should export QueueWorker class', () => {
      expect(QueueWorker).toBeDefined();
      expect(typeof QueueWorker).toBe('function');
    });

    it('should export Queue class', () => {
      expect(Queue).toBeDefined();
      expect(typeof Queue).toBe('function');
    });
  });

  describe('QueueWorker', () => {
    it('should create a worker instance', () => {
      const handler = async (message: unknown) => {
        console.log('Processing:', message);
      };

      const worker = new QueueWorker(handler, {
        connectionString: 'postgresql://localhost:5432/test',
        queueName: 'test_queue',
      });

      expect(worker).toBeDefined();
      expect(worker).toBeInstanceOf(QueueWorker);
    });

    it('should throw if started twice', async () => {
      const handler = async () => {};
      const worker = new QueueWorker(handler, {
        connectionString: 'postgresql://localhost:5432/test',
      });

      // Mock the start to prevent actual connection
      const originalStart = worker.start.bind(worker);
      let startCount = 0;
      worker.start = async () => {
        startCount++;
        if (startCount === 1) {
          // First call - mark as running but don't actually start
          (worker as any).isRunning = true;
          return Promise.resolve();
        }
        return originalStart();
      };

      await worker.start();
      await expect(worker.start()).rejects.toThrow('Worker is already running');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration values', () => {
      const handler = async () => {};
      const worker = new QueueWorker(handler, {
        connectionString: 'postgresql://localhost:5432/test',
      });

      // Check internal config has defaults applied
      const config = (worker as any).config;
      expect(config.queueName).toBe('tasks');
      expect(config.maxConcurrent).toBe(10);
      expect(config.batchSize).toBe(10);
    });

    it('should override default configuration', () => {
      const handler = async () => {};
      const worker = new QueueWorker(handler, {
        connectionString: 'postgresql://localhost:5432/test',
        queueName: 'custom_queue',
        maxConcurrent: 5,
        batchSize: 20,
      });

      const config = (worker as any).config;
      expect(config.queueName).toBe('custom_queue');
      expect(config.maxConcurrent).toBe(5);
      expect(config.batchSize).toBe(20);
    });

    it('should use default retry configuration', () => {
      const handler = async () => {};
      const worker = new QueueWorker(handler, {
        connectionString: 'postgresql://localhost:5432/test',
      });

      const config = (worker as any).config;
      expect(config.retry.strategy).toBe('exponential');
      expect(config.retry.limit).toBe(5);
      expect(config.retry.baseDelay).toBe(3);
    });

    it('should override retry configuration', () => {
      const handler = async () => {};
      const worker = new QueueWorker(handler, {
        connectionString: 'postgresql://localhost:5432/test',
        retry: {
          strategy: 'fixed',
          limit: 3,
          baseDelay: 5,
        },
      });

      const config = (worker as any).config;
      expect(config.retry.strategy).toBe('fixed');
      expect(config.retry.limit).toBe(3);
      expect(config.retry.baseDelay).toBe(5);
    });
  });

  describe('Types', () => {
    it('should support generic message types', () => {
      interface MyMessage {
        type: 'email' | 'sms';
        recipient: string;
        content: string;
      }

      const handler = async (message: MyMessage) => {
        expect(message.type).toBeDefined();
        expect(message.recipient).toBeDefined();
        expect(message.content).toBeDefined();
      };

      const worker = new QueueWorker<MyMessage>(handler, {
        connectionString: 'postgresql://localhost:5432/test',
      });

      expect(worker).toBeDefined();
    });
  });
});
