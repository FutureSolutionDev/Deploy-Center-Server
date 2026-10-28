/**
 * CSRF exemptions — v3.0.1 / OPS-H2.
 * The legacy /webhook/github/:name route (used by existing GitHub hooks) must
 * not be rejected by CSRF, while every other mutating route still is.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import CsrfMiddleware from '@Middleware/CsrfMiddleware';

function buildApp(): express.Application {
  const app = express();
  const csrf = new CsrfMiddleware();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrf.GenerateToken);
  app.use(csrf.VerifyToken);
  app.all(/.*/, (_req, res) => {
    res.status(200).json({ reached: true });
  });
  return app;
}

describe('CsrfMiddleware exemptions — OPS-H2', () => {
  it.each([
    '/webhook/github',
    '/webhook/github/my-project',
    '/api/webhooks/github',
    '/api/webhooks/github/my-project',
  ])('POST %s reaches the webhook handler without a CSRF token', async (url) => {
    const res = await request(buildApp()).post(url).send({ zen: 'hi' });
    expect(res.status).toBe(200);
  });

  it.each([
    '/api/projects',
    '/api/auth/register',
    '/webhook/github/my-project/extra',
    '/api/webhooks/github-evil',
    '/api/webhooks/test/my-project',
    '/webhookx/github/a',
  ])('POST %s still requires a CSRF token', async (url) => {
    const res = await request(buildApp()).post(url).send({});
    expect(res.status).toBe(403);
  });

  it('only POST is exempt on webhook routes', async () => {
    const res = await request(buildApp()).delete('/webhook/github/my-project');
    expect(res.status).toBe(403);
  });

  it('accepts a mutating request with a valid token', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    const first = await agent.get('/api/health');
    const raw = first.headers['set-cookie'] as unknown as string[];
    const token = raw.map((c) => c.split(';')[0]!).find((c) => c.startsWith('XSRF-TOKEN='))!.split('=')[1]!;
    const res = await agent.post('/api/projects').set('X-XSRF-TOKEN', decodeURIComponent(token)).send({});
    expect(res.status).toBe(200);
  });
});
