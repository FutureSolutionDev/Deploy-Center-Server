/**
 * QueueReadyMiddleware — Deploy Center v3.0 / F-001 (FR-005b).
 * Short-circuits routes that enqueue work into BullMQ when Redis is
 * unreachable, returning HTTP 503 with the documented body.
 *
 * Mount ONLY on routes that enqueue (deployment trigger, webhook receiver,
 * rollback). Reads MUST stay reachable during outages — don't mount globally.
 */

import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import QueueService from '@Services/QueueService';

const UNAVAILABLE_MESSAGE = 'Queue service unavailable, deployments paused';

/**
 * Reject the request with 503 when the underlying Redis connection is not
 * in a ready state. ioredis auto-reconnects with exponential backoff in the
 * background; no operator action required for recovery.
 */
export const RequireQueueReady = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (QueueService.GetInstance().IsReady()) {
    return next();
  }

  Logger.Warn('QueueReadyMiddleware: blocking enqueue route — Redis not ready', {
    path: req.path,
    method: req.method,
  });
  ResponseHelper.ServiceUnavailable(res, UNAVAILABLE_MESSAGE);
};

export default RequireQueueReady;
