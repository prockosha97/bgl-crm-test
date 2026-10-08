import type { FastifyInstance, FastifyReply } from 'fastify';
import { loginSchema } from '../../../../shared/contracts.js';
import { audit, HttpError, publicUserSelect, type Context } from '../../shared/context.js';
import { hashPassword, randomToken, tokenDigest, verifyPassword } from './security.js';
export async function authRoutes(app: FastifyInstance, { db, config }: Context) {
  const cookieName = config.NODE_ENV === 'production' ? '__Host-bgl_session' : 'bgl_session';
  const cookieOptions = { path: '/', httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax' as const };
  const dummyHash = await hashPassword(randomToken());
  app.decorateRequest('user', null);
  app.decorateRequest('session', null);
  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/api/')) return;
    const token = request.cookies[cookieName];
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const session = await db.session.findUnique({ where: { tokenHash: tokenDigest(token, config.SESSION_SECRET) }, include: { user: { select: publicUserSelect } } });
      if (session && session.expiresAt > new Date() && session.user.isActive) { request.user = session.user; request.session = { id: session.id, csrfToken: session.csrfToken }; }
    }
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (mutation && request.headers.origin !== new URL(config.APP_BASE_URL).origin) throw new HttpError(403, 'Недопустимый Origin');
    if (request.url.split('?')[0] === '/api/auth/login') return;
    if (!request.user) throw new HttpError(401, 'Войдите в систему');
    if (mutation && request.headers['x-csrf-token'] !== request.session?.csrfToken) throw new HttpError(403, 'Недопустимый CSRF token');
  });
  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const user = await db.user.findUnique({ where: { email } });
    const valid = await verifyPassword(user?.passwordHash ?? dummyHash, password);
    if (!valid || !user?.isActive) {
      await audit(db, null, 'login_failed', 'User', undefined, { ip: request.ip });
      throw new HttpError(401, 'Неверный email или пароль');
    }
    const token = randomToken(); const csrfToken = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.$transaction(async tx => {
      await tx.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      if (request.session) await tx.session.deleteMany({ where: { id: request.session.id } });
      await tx.session.create({ data: { userId: user.id, tokenHash: tokenDigest(token, config.SESSION_SECRET), csrfToken, expiresAt } });
      await audit(tx, user.id, 'login', 'User', user.id);
    });
    setSessionCookie(reply, token);
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }, csrfToken };
  });
  function setSessionCookie(reply: FastifyReply, token: string) { reply.setCookie(cookieName, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 }); }
  app.get('/api/auth/me', async request => ({ user: request.user, csrfToken: request.session!.csrfToken }));
  app.post('/api/auth/logout', async (request, reply) => {
    await db.session.deleteMany({ where: { id: request.session!.id } });
    reply.clearCookie(cookieName, cookieOptions); return { ok: true };
  });
}
