/**
 * Standalone migration CLI — v3.0 (added 2026-05-24).
 *
 * Runs migrations WITHOUT booting the HTTP server, Socket.IO, or BullMQ
 * worker. Just opens the DB connection, executes the requested command,
 * closes, and exits.
 *
 * Usage (via package.json scripts):
 *   npm run migrate            → run all pending migrations (idempotent)
 *   npm run migrate:undo       → rollback the most recent executed migration
 *   npm run migrate:status     → print a status table of every migration
 *
 * Exit code:
 *   0 = success
 *   1 = error (printed to stderr)
 */

import 'tsconfig-paths/register';
import DatabaseConnection from '@Database/DatabaseConnection';
import MigrationRunner from '@Database/MigrationRunner';
import Logger from '@Utils/Logger';

type Command = 'run' | 'undo' | 'status';

function parseCommand(): Command {
  const arg = (process.argv[2] || 'run').toLowerCase();
  if (arg === 'run' || arg === 'undo' || arg === 'status') return arg;
  throw new Error(`Unknown command: ${arg}. Use one of: run, undo, status`);
}

async function runStatus(): Promise<void> {
  const rows = await MigrationRunner.GetStatus();
  const nameW = Math.max(...rows.map((r) => r.name.length), 'Migration'.length);
  const stateW = 8;
  const tsW = 19;
  const line = (n: string, s: string, t: string): string =>
    `| ${n.padEnd(nameW)} | ${s.padEnd(stateW)} | ${t.padEnd(tsW)} |`;
  const sep = `+-${'-'.repeat(nameW)}-+-${'-'.repeat(stateW)}-+-${'-'.repeat(tsW)}-+`;
  // eslint-disable-next-line no-console
  console.log(sep);
  // eslint-disable-next-line no-console
  console.log(line('Migration', 'State', 'Executed At'));
  // eslint-disable-next-line no-console
  console.log(sep);
  for (const r of rows) {
    const state = r.executed ? '✅ done' : '⏳ pending';
    const ts = r.executedAt ? r.executedAt.toISOString().replace('T', ' ').slice(0, 19) : '';
    // eslint-disable-next-line no-console
    console.log(line(r.name, state, ts));
  }
  // eslint-disable-next-line no-console
  console.log(sep);
  const pending = rows.filter((r) => !r.executed).length;
  // eslint-disable-next-line no-console
  console.log(
    `${rows.length - pending} executed, ${pending} pending of ${rows.length} total.`
  );
}

async function main(): Promise<void> {
  const cmd = parseCommand();
  Logger.Info(`migrate CLI: command=${cmd}`);

  // Touch the singleton to establish the connection.
  DatabaseConnection.GetInstance();
  await DatabaseConnection.TestConnection();

  switch (cmd) {
    case 'run':
      await MigrationRunner.RunMigrations();
      break;
    case 'undo':
      await MigrationRunner.RollbackLastMigration();
      break;
    case 'status':
      await runStatus();
      break;
  }

  await DatabaseConnection.CloseConnection();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err: Error) => {
    // eslint-disable-next-line no-console
    console.error(`❌ migrate CLI failed: ${err.message}`);
    Logger.Error('migrate CLI failed', err);
    process.exit(1);
  });
