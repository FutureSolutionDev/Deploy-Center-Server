/**
 * Rotate project webhook secrets — v3.0.1 operational CLI.
 *
 * Usage:
 *   npm run rotate:webhook-secrets -- --all [--out FILE]
 *   npm run rotate:webhook-secrets -- --only <id|name> [--out FILE]
 *   npm run rotate:webhook-secrets -- --all --dry-run
 *
 * New secrets are written ONLY to the output file (mode 0600, never
 * overwritten); the terminal and the logs show project names, not secrets.
 * Paste each secret into the matching GitHub webhook, then delete the file.
 *
 * Exit code: 0 = success, 1 = error.
 */

import 'tsconfig-paths/register';
import fs from 'fs';
import path from 'path';
import DatabaseConnection from '@Database/DatabaseConnection';
import WebhookSecretRotationService from '@Services/WebhookSecretRotationService';

interface IArgs {
  All: boolean;
  Project?: string;
  DryRun: boolean;
  Out: string;
}

function ParseArgs(argv: string[]): IArgs {
  const args: IArgs = {
    All: false,
    DryRun: false,
    Out: path.resolve(process.cwd(), `webhook-secrets-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') args.All = true;
    else if (arg === '--dry-run') args.DryRun = true;
    // Not --project: tsconfig-paths/register reads that flag as a tsconfig path.
    else if (arg === '--only') args.Project = argv[(i += 1)];
    else if (arg === '--out') args.Out = path.resolve(argv[(i += 1)] ?? '');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.All === Boolean(args.Project)) {
    throw new Error('Use exactly one of --all or --only <id|name>');
  }
  return args;
}

function WriteSecretsFile(file: string, data: unknown): void {
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeSync(fd, `${JSON.stringify(data, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function Write(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function Main(): Promise<void> {
  const args = ParseArgs(process.argv.slice(2));
  if (!args.DryRun && fs.existsSync(args.Out)) {
    throw new Error(`Refusing to overwrite existing file: ${args.Out}`);
  }

  DatabaseConnection.GetInstance();
  await DatabaseConnection.TestConnection();

  const rotated = await WebhookSecretRotationService.Plan({
    All: args.All,
    Project: args.Project,
    DryRun: args.DryRun,
  });

  if (!args.DryRun) {
    // Save the new secrets durably before any project changes, so a failed
    // write can never leave live secrets that nobody has.
    WriteSecretsFile(args.Out, rotated);
    try {
      await WebhookSecretRotationService.Apply(rotated);
    } catch (error) {
      fs.rmSync(args.Out, { force: true });
      throw new Error(`No secret was changed: ${(error as Error).message}`);
    }
  }

  Write(args.DryRun ? 'Dry run, would rotate:' : 'Rotated webhook secrets for:');
  rotated.forEach((r) => Write(`  #${r.ProjectId}  ${r.Name}  (${r.WebhookPath})`));
  if (!args.DryRun) {
    Write(`New secrets written to ${args.Out} (mode 0600).`);
    Write('Update each GitHub webhook with its new secret, then delete that file.');
  }

  await DatabaseConnection.CloseConnection();
}

Main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    process.stderr.write(`rotate-webhook-secrets failed: ${error.message}\n`);
    process.exit(1);
  });
