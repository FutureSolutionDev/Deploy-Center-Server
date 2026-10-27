/**
 * ConfigValidator — refuse to boot in production with missing, default or
 * placeholder secrets (v3.0.1, SEC-H2).
 *
 * Anyone who knows a default JWT secret can mint an Admin token, and a known
 * encryption key decrypts every stored SSH key and env var, so these are
 * fatal in production. Outside production the same findings are warnings.
 */

import type { AppConfig } from './AppConfig';

/** Minimum length for HMAC / encryption secrets. */
export const MIN_SECRET_LENGTH = 32;

/** Defaults that shipped in code or in .env.example. */
const KNOWN_DEFAULTS = new Set(
  [
    'change_this_secret_in_production',
    'change_this_refresh_secret',
    'change_this_encryption_key_32bytes',
    'change_this_session_secret',
    'replace_with_64_byte_hex',
    'replace_with_different_64_byte_hex',
    'replace_with_32_byte_hex',
    'replace_with_random_string',
    'replace_with_webhook_secret',
    'change_me_strong_password',
    'change_me_admin_password',
    'change_me_root_password',
    'future_central_deploy_2025',
  ].map((v) => v.toLowerCase())
);

/** Shapes that are obviously placeholders even if not in the list above. */
const PLACEHOLDER_PATTERNS = [
  /^change[_-]?(this|me)/i,
  /^replace[_-]?with/i,
  /^your[_-]/i,
  /^(secret|password|changeme|default|example|test)$/i,
  /not[_-]for[_-]production/i,
];

export function IsPlaceholderSecret(value: string | undefined | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (KNOWN_DEFAULTS.has(normalized)) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

type TSecureConfig = Pick<AppConfig, 'Jwt' | 'EncryptionKey' | 'Database' | 'DefaultAdmin'>;

/**
 * Return a human-readable problem per insecure setting (empty = all good).
 * Never includes the secret values themselves.
 */
export function FindInsecureSettings(config: TSecureConfig): string[] {
  const problems: string[] = [];

  const checkSecret = (name: string, value: string | undefined): void => {
    if (!value) {
      problems.push(`${name} is not set`);
    } else if (IsPlaceholderSecret(value)) {
      problems.push(`${name} is a default or placeholder value`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
    }
  };

  checkSecret('JWT_SECRET', config.Jwt.Secret);
  checkSecret('JWT_REFRESH_SECRET', config.Jwt.RefreshSecret);
  if (config.Jwt.Secret && config.Jwt.Secret === config.Jwt.RefreshSecret) {
    problems.push('JWT_REFRESH_SECRET must differ from JWT_SECRET');
  }
  checkSecret('ENCRYPTION_KEY', config.EncryptionKey);

  if (config.Database.Password && IsPlaceholderSecret(config.Database.Password)) {
    problems.push('DB_PASSWORD is a default or placeholder value');
  }
  if (config.DefaultAdmin.Password && IsPlaceholderSecret(config.DefaultAdmin.Password)) {
    problems.push('DEFAULT_ADMIN_PASSWORD is a default or placeholder value');
  }

  return problems;
}

export class InsecureConfigurationError extends Error {
  public readonly Problems: string[];
  constructor(problems: string[]) {
    super(
      `Refusing to start in production with insecure configuration: ${problems.join('; ')}. ` +
        'Generate secrets with `openssl rand -hex 64` (JWT) and `openssl rand -hex 32` (ENCRYPTION_KEY).'
    );
    this.name = 'InsecureConfigurationError';
    this.Problems = problems;
  }
}

/**
 * Throw in production when any secret is insecure; return the findings
 * otherwise so callers can log them as warnings.
 */
export function AssertSecureConfiguration(config: TSecureConfig & { IsProduction(): boolean }): string[] {
  const problems = FindInsecureSettings(config);
  if (problems.length > 0 && config.IsProduction()) {
    throw new InsecureConfigurationError(problems);
  }
  return problems;
}

export default { FindInsecureSettings, AssertSecureConfiguration, IsPlaceholderSecret };
