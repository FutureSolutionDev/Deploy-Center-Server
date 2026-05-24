/**
 * Jest env bootstrap — loaded via `setupFiles` in jest.config.js BEFORE
 * any test module is imported.
 *
 * Why this exists: per-test-file `dotenv.config(...)` calls don't help
 * because TypeScript hoists every `import` statement to the top of the
 * compiled CJS file. When the compiled test starts, all `require()` calls
 * (including AppConfig's `getEnv('DB_HOST', 'localhost')`) have already
 * captured `process.env` defaults BEFORE the `dotenv.config()` line runs.
 *
 * Loading .env.test from a `setupFiles` entry guarantees that
 * `process.env` is populated before any test module is first imported,
 * so AppConfig and friends see the test values.
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '..', '.env.test');
const result = dotenv.config({ path: envPath, override: true });

// One-line diagnostic so CI shows whether the file actually loaded.
// Remove once the integration suites are reliably running in CI.
// eslint-disable-next-line no-console
console.log(
  `[jest.env.setup] envPath=${envPath} exists=${fs.existsSync(envPath)} ` +
    `loaded=${result.error ? 'ERROR:' + result.error.message : 'ok'} ` +
    `DB_NAME=${process.env.DB_NAME} DB_USERNAME=${process.env.DB_USERNAME}`
);
