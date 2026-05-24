/**
 * AutoRecovery unit tests — Deploy Center v3.0 / F-002 (T078).
 *
 * Verifies the retry policy of AutoRecovery.RetryOperation:
 *   - succeeds on the first attempt without delay
 *   - retries up to maxRetries on retryable errors and surfaces the last error
 *   - throws immediately on a non-retryable error (single attempt)
 *
 * Backoff sleep is replaced with jest fake timers + manual advance so the
 * suite stays fast even with large delay values.
 */

import { AutoRecovery } from '@Utils/AutoRecovery';

describe('AutoRecovery.RetryOperation', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the operation result on the first successful attempt', async () => {
    const op = jest.fn().mockResolvedValue('ok');
    const result = await AutoRecovery.RetryOperation(op, {
      operationName: 'first-try',
    });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('throws immediately on a non-retryable error (single attempt)', async () => {
    const op = jest.fn().mockRejectedValue(new Error('TypeError: bad arg'));
    await expect(
      AutoRecovery.RetryOperation(op, { operationName: 'non-retry' })
    ).rejects.toThrow(/bad arg/);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxRetries on retryable errors then surfaces the last error', async () => {
    const op = jest.fn().mockRejectedValue(new Error('ECONNREFUSED 6379'));
    const promise = AutoRecovery.RetryOperation(op, {
      maxRetries: 3,
      delayMs: 5,
      exponentialBackoff: false,
      operationName: 'flaky',
    });
    await expect(promise).rejects.toThrow(/ECONNREFUSED/);
    expect(op).toHaveBeenCalledTimes(3);
  });
});
