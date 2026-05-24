/**
 * QueueAdminService — Deploy Center v3.0 / F-001 (FR-003).
 * Wires the default Bull Board UI for the 'deployments' queue.
 * Mounted at /admin/queues BEHIND AuthMiddleware + RoleMiddleware(Admin)
 * — see Server.ts wiring. No styling customization (per clarification Q9).
 */

import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Router } from 'express';
import QueueService from '@Services/QueueService';

const ADMIN_BASE_PATH = '/admin/queues';

let cachedAdapter: ExpressAdapter | null = null;

/**
 * Build (once) and return the Bull Board Express router. Caller mounts it
 * behind Auth + Admin middleware. ExpressAdapter must be created lazily —
 * it requires the BullMQ queue to be initialized first (which happens at
 * server boot in QueueService.StartWorker).
 */
export function getBullBoardRouter(): Router {
  if (cachedAdapter) {
    return cachedAdapter.getRouter() as Router;
  }

  const adapter = new ExpressAdapter();
  adapter.setBasePath(ADMIN_BASE_PATH);

  // BullMQ 5 ↔ @bull-board JobProgress type drift: the runtime contract is
  // compatible (BullMQ.Job.toJSON().progress is widened from number|object
  // to include string|boolean in BullMQ 5, which @bull-board's BaseAdapter
  // doesn't yet model). Narrowed via `unknown` cast — preferable to
  // disabling strict mode globally. Re-evaluate when @bull-board catches up.
  createBullBoard({
    queues: [new BullMQAdapter(QueueService.GetInstance().GetBullMqQueue()) as unknown as never],
    serverAdapter: adapter,
  });

  cachedAdapter = adapter;
  return adapter.getRouter() as Router;
}

/** Base path Bull Board is mounted at. Re-exported for tests + routing. */
export const BULL_BOARD_BASE_PATH = ADMIN_BASE_PATH;

export default { getBullBoardRouter, BULL_BOARD_BASE_PATH };
