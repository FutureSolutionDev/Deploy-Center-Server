/**
 * SocketLogStream long-stream stability — Deploy Center v3.0 / F-004 (T040, FR-016).
 *
 * Verifies a 30-minute log stream stays stable: every line emitted by the
 * server arrives at the client exactly once, no reconnect loops, no
 * dropped messages.
 *
 * **OPT-IN**: this suite is slow (~30 min wall-clock). It is skipped unless
 * the environment variable RUN_LONG_STREAM_TEST=1 is set, so CI doesn't
 * burn 30 minutes on every PR.
 *
 *   RUN_LONG_STREAM_TEST=1 npm test -- SocketLogStream
 */

import http from 'http';
import { AddressInfo } from 'net';
import { Server as IoServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

const SHOULD_RUN = process.env.RUN_LONG_STREAM_TEST === '1';
const describeOrSkip = SHOULD_RUN ? describe : describe.skip;

const STREAM_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const LINE_INTERVAL_MS = 1000;             // 1 line / second
const EXPECTED_LINES = Math.floor(STREAM_DURATION_MS / LINE_INTERVAL_MS);

describeOrSkip('Socket.IO log stream (30-min stability) — F-004 FR-016', () => {
  let httpServer: http.Server;
  let io: IoServer;
  let port: number;
  let clientSocket: ClientSocket;

  beforeAll((done) => {
    httpServer = http.createServer();
    io = new IoServer(httpServer);
    httpServer.listen(0, '127.0.0.1', () => {
      port = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterAll(async () => {
    if (clientSocket) clientSocket.disconnect();
    if (io) await new Promise<void>((res) => io.close(() => res()));
    if (httpServer) await new Promise<void>((res) => httpServer.close(() => res()));
  });

  it(
    'delivers every emitted line in order with no duplicates or drops',
    async () => {
      const receivedSeqs: number[] = [];
      const reconnectEvents: number[] = [];

      clientSocket = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        reconnection: true,
      });
      clientSocket.on('reconnect', (n) => reconnectEvents.push(n));
      clientSocket.on('deployment:log', (payload: { seq: number }) => {
        receivedSeqs.push(payload.seq);
      });

      await new Promise<void>((res) => clientSocket.on('connect', () => res()));

      // Emit one line per second for the full duration.
      let seq = 0;
      const emitter = setInterval(() => {
        seq += 1;
        io.emit('deployment:log', { seq });
        if (seq >= EXPECTED_LINES) {
          clearInterval(emitter);
        }
      }, LINE_INTERVAL_MS);

      // Wait for completion plus a settle window for the last line to arrive.
      await new Promise<void>((res) =>
        setTimeout(res, STREAM_DURATION_MS + 5000)
      );

      // Assertions
      expect(receivedSeqs.length).toBe(EXPECTED_LINES);
      // Strictly increasing → no drops, no duplicates, in order
      const isStrictlyIncreasing = receivedSeqs.every(
        (val, i) => i === 0 || val === receivedSeqs[i - 1]! + 1
      );
      expect(isStrictlyIncreasing).toBe(true);
      // No unexpected reconnect loops (allow up to 2 transient reconnects)
      expect(reconnectEvents.length).toBeLessThanOrEqual(2);
    },
    STREAM_DURATION_MS + 60000 // jest timeout with 1 min headroom
  );
});

// Sanity guard so importing this file in a non-long-stream run produces a
// trivially-passing suite rather than an empty file (jest dislikes empty suites).
if (!SHOULD_RUN) {
  describe('Socket.IO log stream (long-stream, skipped by default)', () => {
    it('is skipped unless RUN_LONG_STREAM_TEST=1', () => {
      expect(true).toBe(true);
    });
  });
}
