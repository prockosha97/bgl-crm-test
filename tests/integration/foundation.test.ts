import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../server/src/infrastructure/database.js';
import { buildApp } from '../../server/src/app.js';
import { hashPassword } from '../../server/src/modules/auth/security.js';
import type { Config } from '../../server/src/shared/config.js';
import type { FastifyInstance } from 'fastify';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must target an isolated *_test database');
const db = createDatabase(url);
let app: FastifyInstance;
const config: Config = { DATABASE_URL: url, NODE_ENV: 'test', PORT: 80, APP_BASE_URL: 'http://localhost:80', SESSION_SECRET: 'test-only-session-secret-with-at-least-32-characters', MEDIA_ROOT: '/tmp/bgl-media-test', OK_ENABLED: 'false' };
beforeAll(async () => {
  await db.session.deleteMany(); await db.auditLog.deleteMany(); await db.approval.deleteMany(); await db.postTag.deleteMany(); await db.postVariant.deleteMany(); await db.postPlatform.deleteMany(); await db.post.deleteMany(); await db.user.deleteMany();
  await db.user.create({ data: { email: 'admin@test.local', name: 'Test admin', role: 'ADMIN', passwordHash: await hashPassword('integration-password') } });
  app = await buildApp({ db, config }, { logger: false, core: false });
});
afterAll(async () => { await app?.close(); await db.$disconnect(); });
describe('foundation with real PostgreSQL', () => {
  it('health and migration-aware readiness', async () => {
    expect((await app.inject('/health')).json()).toEqual({ status: 'ok' });
    expect((await app.inject('/ready')).statusCode).toBe(200);
  });
  it('authenticates via HttpOnly cookie, protects mutations, and revokes logout', async () => {
    expect((await app.inject('/api/auth/me')).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'http://localhost' }, payload: { email: 'admin@test.local', password: 'integration-password' } });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect(login.json().user).not.toHaveProperty('passwordHash');
    const headers = { cookie, origin: 'http://localhost', 'x-csrf-token': login.json().csrfToken };
    expect((await app.inject({ url: '/api/auth/me', headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie, origin: 'http://localhost' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { ...headers, origin: 'https://evil.example' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/auth/me', headers })).statusCode).toBe(401);
  });
  it('returns generic errors and rate limits failed logins', async () => {
    const responses = [];
    for (let i = 0; i < 12; i++) responses.push(await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'http://localhost' }, payload: { email: 'missing@test.local', password: 'wrong' } }));
    expect(responses[0].statusCode).toBe(401);
    expect(responses.some(x => x.statusCode === 429)).toBe(true);
    expect(await db.auditLog.count({ where: { action: 'login_failed' } })).toBeGreaterThan(0);
  });
});
