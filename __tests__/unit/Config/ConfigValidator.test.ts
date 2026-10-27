/**
 * Startup secret validation + env precedence — v3.0.1 / SEC-H2.
 */

import {
  AssertSecureConfiguration,
  FindInsecureSettings,
  InsecureConfigurationError,
  IsPlaceholderSecret,
} from '@Config/ConfigValidator';

const strong = (seed: string): string => `${seed}`.repeat(8).slice(0, 64);

function config(overrides: Partial<{
  Secret: string;
  RefreshSecret: string;
  EncryptionKey: string;
  DbPassword: string;
  AdminPassword: string;
  Production: boolean;
}> = {}) {
  return {
    Jwt: {
      Secret: overrides.Secret ?? strong('a1b2c3d4'),
      RefreshSecret: overrides.RefreshSecret ?? strong('e5f6a7b8'),
      Expiry: '15m',
      RefreshExpiry: '7d',
    },
    EncryptionKey: overrides.EncryptionKey ?? strong('0f1e2d3c'),
    Database: { Password: overrides.DbPassword ?? 'K8s!real-db-pass' } as never,
    DefaultAdmin: { Password: overrides.AdminPassword },
    IsProduction: () => overrides.Production ?? true,
  };
}

describe('ConfigValidator', () => {
  it('accepts strong, distinct secrets', () => {
    expect(FindInsecureSettings(config())).toEqual([]);
    expect(AssertSecureConfiguration(config())).toEqual([]);
  });

  it.each([
    ['JWT_SECRET', { Secret: 'change_this_secret_in_production' }],
    ['JWT_SECRET', { Secret: '' }],
    ['JWT_SECRET', { Secret: 'short-but-random' }],
    ['JWT_REFRESH_SECRET', { RefreshSecret: 'change_this_refresh_secret' }],
    ['JWT_REFRESH_SECRET', { RefreshSecret: 'replace_with_different_64_byte_hex' }],
    ['ENCRYPTION_KEY', { EncryptionKey: 'change_this_encryption_key_32bytes' }],
    ['ENCRYPTION_KEY', { EncryptionKey: 'replace_with_32_byte_hex' }],
    ['DB_PASSWORD', { DbPassword: 'change_me_strong_password' }],
    ['DEFAULT_ADMIN_PASSWORD', { AdminPassword: 'change_me_admin_password' }],
  ])('flags %s', (name, overrides) => {
    const problems = FindInsecureSettings(config(overrides));
    expect(problems.join(' ')).toContain(name);
  });

  it('requires different access and refresh secrets', () => {
    const same = strong('9a8b7c6d');
    expect(FindInsecureSettings(config({ Secret: same, RefreshSecret: same }))).toContain(
      'JWT_REFRESH_SECRET must differ from JWT_SECRET'
    );
  });

  it('throws in production and only warns elsewhere', () => {
    const insecure = { Secret: 'change_this_secret_in_production' };
    expect(() => AssertSecureConfiguration(config({ ...insecure, Production: true }))).toThrow(
      InsecureConfigurationError
    );
    expect(AssertSecureConfiguration(config({ ...insecure, Production: false })).length).toBe(1);
  });

  it('never puts secret values in the error message', () => {
    const secret = 'replace_with_64_byte_hex';
    try {
      AssertSecureConfiguration(config({ Secret: secret, Production: true }));
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('recognises placeholder shapes', () => {
    expect(IsPlaceholderSecret('your_secret_here')).toBe(true);
    expect(IsPlaceholderSecret('test_jwt_secret_not_for_production_use_only_in_tests_1234')).toBe(true);
    expect(IsPlaceholderSecret(strong('5d4c3b2a'))).toBe(false);
  });
});

describe('AppConfig env precedence', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    jest.resetModules();
  });

  it('real environment variables override the .env file', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PORT;
    jest.isolateModules(() => {
      jest.doMock('fs', () => {
        const real = jest.requireActual('fs');
        return {
          ...real,
          existsSync: (p: string) => (String(p).endsWith('.env') ? true : real.existsSync(p)),
          readFileSync: (p: string, ...rest: unknown[]) =>
            String(p).endsWith('.env')
              ? Buffer.from('NODE_ENV=development\nPORT=4321\n')
              : real.readFileSync(p, ...rest),
        };
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AppConfig } = require('@Config/AppConfig');
      const cfg = AppConfig.GetInstance();
      expect(cfg.NodeEnv).toBe('production');
      expect(cfg.Port).toBe(4321);
    });
  });
});
