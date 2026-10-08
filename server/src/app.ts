import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { authRoutes } from './modules/auth/routes.js';
import { HttpError, type Context } from './shared/context.js';
import { WorkflowError } from '../../shared/workflow.js';
export async function buildApp(ctx: Context, options: { logger?: boolean; core?: boolean; staticRoot?: string } = {}) {
  const app = Fastify({ logger: options.logger === false ? false : { redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]'], level: 'info' }, bodyLimit: 256 * 1024, trustProxy: false });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'same-origin');
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    reply.header('Cache-Control', 'no-store');
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'Проверьте поля формы', issues: error.issues.map(x => ({ path: x.path.join('.'), message: x.message })) });
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ error: error.message });
    if (error instanceof WorkflowError) return reply.code(409).send({ error: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return reply.code(409).send({ error: 'Такая запись уже существует' });
      if (error.code === 'P2003' || error.code === 'P2025') return reply.code(409).send({ error: 'Связанные записи отсутствуют или используются' });
    }
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) return reply.code(error.statusCode).send({ error: error.message });
    request.log.error({ requestId: request.id, errorCode: 'INTERNAL_ERROR' }, 'Request failed');
    return reply.code(500).send({ error: 'Внутренняя ошибка сервера' });
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    try {
      const migrations = await ctx.db.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
      if (!migrations.some(x => x.migration_name === '20261007000000_foundation' && x.finished_at) || migrations.some(x => !x.finished_at && !x.rolled_back_at)) throw new Error('Migration incompatible');
      await ctx.db.user.count();
      return { status: 'ready' };
    } catch { return reply.code(503).send({ status: 'not_ready' }); }
  });
  await authRoutes(app, ctx);
  if (options.core !== false) {
    const { registerCore } = await import('./modules/posts/routes.js');
    await registerCore(app, ctx);
  }
  const staticRoot = options.staticRoot ?? resolve('dist/web');
  if (existsSync(resolve(staticRoot, 'index.html'))) {
    await app.register(staticPlugin, { root: staticRoot, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/assets/') || !['GET', 'HEAD'].includes(request.method)) return reply.code(404).send({ error: 'Не найдено' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
