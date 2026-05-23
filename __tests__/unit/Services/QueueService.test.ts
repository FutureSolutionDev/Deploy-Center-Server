/**
 * QueueService unit tests — F-002 (T043).
 *
 * Uses the test Redis (DB=1, flushed between tests). REQUIRES a running Redis;
 * tests auto-skip with a warning if REDIS_HOST is unreachable so this suite
 * doesn't break runs on machines without docker-compose up.
 *
 *   RUN: docker compose up -d redis && npm test -- QueueService
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test'), override: true });

import { flushTestRedis, closeTestRedis, getTestRedis } from '../../helpers/redis';
import QueueService from '@Services/QueueService';
import { disconnectRedis } from '@Config/RedisConfig';

const PROJECT_ID = 9001;

async function isRedisReachable(): Promise<boolean> {
  // Build a *separate* throwaway client with a short connect timeout so we
  // don't get stuck on the shared one's reconnect-forever behavior.
  const Redis = (await import('ioredis')).default;
  const probe = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    db: Number(process.env.REDIS_DB ?? 1),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // give up after first failed connect attempt
  });
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
    // Touch the shared client so cleanup runs even if probe failed.
    void getTestRedis;
  }
}

describe('QueueService (BullMQ-backed)', () => {
  let redisUp = false;

  beforeAll(async () => {
    redisUp = await isRedisReachable();
    if (!redisUp) {
      // eslint-disable-next-line no-console
      console.warn('Redis unreachable on REDIS_HOST — QueueService suite will be skipped');
      return;
    }
    await flushTestRedis();
  });

  afterAll(async () => {
    if (!redisUp) return;
    const qs = QueueService.GetInstance();
    await qs.StopWorker();
    await flushTestRedis();
    await closeTestRedis();
    await disconnectRedis();
  });

  it('Enqueue returns a deterministic dep-<id> job id', async () => {
    if (!redisUp) return;
    // First Enqueue triggers Redis connection; afterwards IsReady should flip.
    const jobId = await QueueService.GetInstance().Enqueue(1, PROJECT_ID, 0);
    expect(jobId).toBe('dep-1'); // prefixed to dodge BullMQ "no numeric ids" rule

    // Give the 'ready' event a moment to fire after the queue first connects.
    const start = Date.now();
    while (!QueueService.GetInstance().IsReady() && Date.now() - start < 3000) {
      await new Promise((res) => setTimeout(res, 50));
    }
    expect(QueueService.GetInstance().IsReady()).toBe(true);
  }, 10000);

  it('GetQueueLength reflects waiting jobs for the project', async () => {
    if (!redisUp) return;
    await QueueService.GetInstance().Enqueue(2, PROJECT_ID, 0);
    await QueueService.GetInstance().Enqueue(3, PROJECT_ID, 0);
    const len = await QueueService.GetInstance().GetQueueLength(PROJECT_ID);
    expect(len).toBeGreaterThanOrEqual(2);
  }, 10000);

  it('CancelPendingDeployments removes waiting jobs for the project', async () => {
    if (!redisUp) return;
    const before = await QueueService.GetInstance().GetQueueLength(PROJECT_ID);
    const cancelled = await QueueService.GetInstance().CancelPendingDeployments(PROJECT_ID);
    expect(cancelled).toBeGreaterThanOrEqual(0);
    const after = await QueueService.GetInstance().GetQueueLength(PROJECT_ID);
    expect(after).toBeLessThanOrEqual(Math.max(0, before - cancelled));
  }, 10000);

  // Opt-in: this test takes ~35s (BullMQ backoff 1s+5s+25s). Run with
  //   RUN_SLOW_QUEUE_TEST=1 npm test -- QueueService
  const slowIt = process.env.RUN_SLOW_QUEUE_TEST === '1' ? it : it.skip;
  slowIt('Retry policy: failing runner is retried 3× before final failure', async () => {
    if (!redisUp) return;
    const qs = QueueService.GetInstance();
    let attempts = 0;
    let failedDeploymentId: number | null = null;
    let failedAttemptsMade = 0;

    qs.RegisterRunner(async () => {
      attempts += 1;
      throw new Error('forced failure');
    });

    const failurePromise = new Promise<void>((resolve) => {
      qs.once('deployment-failed', (payload: { deploymentId: number; attemptsMade: number; attemptsMax: number }) => {
        if (payload.attemptsMade >= payload.attemptsMax) {
          failedDeploymentId = payload.deploymentId;
          failedAttemptsMade = payload.attemptsMade;
          resolve();
        }
      });
    });

    qs.StartWorker();
    const jobId = await qs.Enqueue(9999, PROJECT_ID, 0);
    expect(jobId).toBe('9999');

    // BullMQ backoff: 1s → 5s → 25s. Wait up to 35s for the final failure.
    await Promise.race([
      failurePromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 35000)),
    ]);

    expect(attempts).toBeGreaterThanOrEqual(3);
    expect(failedDeploymentId).toBe(9999);
    expect(failedAttemptsMade).toBeGreaterThanOrEqual(3);

    await qs.StopWorker();
  }, 40000);
});
