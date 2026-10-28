/**
 * Two-factor login binding — v3.0.1 / SEC-C3.
 *
 * The second step must be bound to the password step through the httpOnly
 * mfa_pending cookie; a body-supplied UserId must never be enough.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import AuthRoutes from '@Routes/AuthRoutes';
import TwoFactorAuthService from '@Services/TwoFactorAuthService';
import { MfaChallenge, TwoFactorAuth, User } from '@Models/index';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeUser } from '../helpers/factories';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

const PASSWORD = 'Hunter22!Strong';

describe('Two-factor login — SEC-C3', () => {
  let dbUp = false;
  let app: express.Application;
  const twoFactor = new TwoFactorAuthService();

  async function makeTwoFactorUser(): Promise<{ user: User; secret: string; backupCodes: string[] }> {
    const user = await makeUser({ Username: `mfa_${crypto.randomBytes(3).toString('hex')}`, Password: PASSWORD });
    const { secret } = await twoFactor.GenerateTOTP(user.Id);
    const { backupCodes } = await twoFactor.Enable2FA(
      user.Id,
      speakeasy.totp({ secret, encoding: 'base32' })
    );
    return { user, secret, backupCodes };
  }

  const totp = (secret: string): string => speakeasy.totp({ secret, encoding: 'base32' });

  function cookieHeader(res: request.Response): string {
    const raw = res.headers['set-cookie'] as unknown;
    return Array.isArray(raw) ? raw.join(';') : String(raw ?? '');
  }

  async function passwordStep(agent: ReturnType<typeof request.agent>, username: string): Promise<request.Response> {
    return agent.post('/api/auth/login').send({ Username: username, Password: PASSWORD });
  }

  // A fresh router per app means a fresh in-memory per-IP AuthLimiter, so
  // one test's failures never surface as 429s in the next.
  function buildApp(): express.Application {
    const fresh = express();
    fresh.use(express.json());
    fresh.use(cookieParser());
    fresh.use('/api/auth', new AuthRoutes().Router);
    return fresh;
  }

  beforeAll(async () => {
    dbUp = await dbReachable();
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (!dbUp) return;
    await truncateAll();
    app = buildApp();
  });

  it('password step issues an httpOnly mfa_pending cookie and no session', async () => {
    if (!dbUp) return;
    const { user } = await makeTwoFactorUser();
    const res = await passwordStep(request.agent(app), user.Username);

    expect(res.status).toBe(200);
    expect(res.body.Data.TwoFactorRequired).toBe(true);
    // Kept for the bundled v3.0 UI; it carries no authority (see below).
    expect(res.body.Data.UserId).toBe(user.Id);
    const cookies = cookieHeader(res);
    expect(cookies).toMatch(/mfa_pending=[^;]+/);
    expect(cookies).toMatch(/HttpOnly/i);
    expect(cookies).not.toContain('access_token=');
  });

  it('rejects the legacy UserId + Code call without the cookie', async () => {
    if (!dbUp) return;
    const { user, secret } = await makeTwoFactorUser();
    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ UserId: user.Id, Code: totp(secret) });
    expect(res.status).toBe(401);
    expect(cookieHeader(res)).not.toContain('access_token=');
  });

  it('ignores a body UserId pointing at another account', async () => {
    if (!dbUp) return;
    const victim = await makeTwoFactorUser();
    const attacker = await makeTwoFactorUser();
    const agent = request.agent(app);
    await passwordStep(agent, attacker.user.Username);

    // Attacker's own challenge + victim's id and code: the server must use
    // the challenge's user, so the victim's TOTP is just a wrong code.
    const res = await agent
      .post('/api/auth/verify-2fa')
      .send({ UserId: victim.user.Id, Code: totp(victim.secret) });
    if (res.status === 200) {
      expect(res.body.Data.User.Id).toBe(attacker.user.Id);
    } else {
      expect(res.status).toBe(401);
    }
    expect(res.body.Data?.User?.Id).not.toBe(victim.user.Id);
  });

  it('accepts the correct code once and the cookie cannot be replayed', async () => {
    if (!dbUp) return;
    const { user, secret } = await makeTwoFactorUser();
    const agent = request.agent(app);
    const login = await passwordStep(agent, user.Username);
    const pending = cookieHeader(login).match(/mfa_pending=[^;]+/)?.[0] ?? '';

    const ok = await agent.post('/api/auth/verify-2fa').send({ Code: totp(secret) });
    expect(ok.status).toBe(200);
    expect(cookieHeader(ok)).toContain('access_token=');

    const replay = await request(app)
      .post('/api/auth/verify-2fa')
      .set('Cookie', pending)
      .send({ Code: totp(secret) });
    expect(replay.status).toBe(401);
  });

  it('lets only one of two concurrent verifications succeed', async () => {
    if (!dbUp) return;
    const { user, secret } = await makeTwoFactorUser();
    const login = await passwordStep(request.agent(app), user.Username);
    const pending = cookieHeader(login).match(/mfa_pending=[^;]+/)?.[0] ?? '';
    const code = totp(secret);

    const results = await Promise.all([
      request(app).post('/api/auth/verify-2fa').set('Cookie', pending).send({ Code: code }),
      request(app).post('/api/auth/verify-2fa').set('Cookie', pending).send({ Code: code }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('rejects an expired challenge', async () => {
    if (!dbUp) return;
    const { user, secret } = await makeTwoFactorUser();
    const agent = request.agent(app);
    await passwordStep(agent, user.Username);
    await MfaChallenge.update(
      { ExpiresAt: new Date(Date.now() - 1000) },
      { where: { UserId: user.Id } }
    );
    const res = await agent.post('/api/auth/verify-2fa').send({ Code: totp(secret) });
    expect(res.status).toBe(401);
  });

  it('re-checks IsActive between the two steps', async () => {
    if (!dbUp) return;
    const { user, secret } = await makeTwoFactorUser();
    const agent = request.agent(app);
    await passwordStep(agent, user.Username);
    await User.update({ IsActive: false }, { where: { Id: user.Id } });
    const res = await agent.post('/api/auth/verify-2fa').send({ Code: totp(secret) });
    expect(res.status).toBe(401);
    expect(cookieHeader(res)).not.toContain('access_token=');
  });

  it('locks the account after repeated wrong codes, even across new challenges', async () => {
    if (!dbUp) return;
    const { user, secret } = await makeTwoFactorUser();
    const agent = request.agent(app);
    await passwordStep(agent, user.Username);

    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await agent.post('/api/auth/verify-2fa').send({ Code: '000000' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 4)).toEqual([401, 401, 401, 401]);
    expect(statuses[4]).toBe(429);
    const lockRow = await TwoFactorAuth.findOne({ where: { UserId: user.Id } });
    expect(lockRow?.get('LockedUntil')).toBeTruthy();

    // New app (clean per-IP limiter), fresh password step, correct code:
    // the account lockout alone must still refuse it.
    const again = request.agent(buildApp());
    const relogin = await passwordStep(again, user.Username);
    expect(relogin.status).toBe(200);
    const locked = await again.post('/api/auth/verify-2fa').send({ Code: totp(secret) });
    expect(locked.status).toBe(429);
    expect(locked.body.Message).toMatch(/two-factor/i);
  });

  it('issues 10 strong backup codes, each usable exactly once', async () => {
    if (!dbUp) return;
    const { user, backupCodes } = await makeTwoFactorUser();
    expect(backupCodes).toHaveLength(10);
    backupCodes.forEach((code) => expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/));
    expect(new Set(backupCodes).size).toBe(10);

    const stored = JSON.stringify((await TwoFactorAuth.findOne({ where: { UserId: user.Id } }))?.get('BackupCodes'));
    backupCodes.forEach((code) => expect(stored).not.toContain(code.replace(/-/g, '')));

    const first = request.agent(app);
    await passwordStep(first, user.Username);
    const used = await first.post('/api/auth/verify-2fa').send({ Code: backupCodes[0]!.toLowerCase() });
    expect(used.status).toBe(200);

    const second = request.agent(app);
    await passwordStep(second, user.Username);
    const reused = await second.post('/api/auth/verify-2fa').send({ Code: backupCodes[0] });
    expect(reused.status).toBe(401);
  });

  it('no longer accepts legacy weak backup codes', async () => {
    if (!dbUp) return;
    const { user } = await makeTwoFactorUser();
    const legacy = crypto.createHash('sha256').update('ABCDE').digest('hex');
    await TwoFactorAuth.update(
      { BackupCodes: JSON.stringify([legacy]) },
      { where: { UserId: user.Id } }
    );

    const agent = request.agent(app);
    await passwordStep(agent, user.Username);
    const res = await agent.post('/api/auth/verify-2fa').send({ Code: 'ABCDE' });
    expect(res.status).toBe(401);

    const status = await twoFactor.GetStatus(user.Id);
    expect(status.legacyBackupCodesInvalidated).toBe(true);
    expect(status.backupCodesRemaining).toBe(0);
  });
});
