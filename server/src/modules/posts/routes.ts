import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actionSchema, canEdit, effectiveText, platforms, postInputSchema, statuses, type PostInput } from '../../../../shared/contracts.js';
import { statusAfterEdit, transition } from '../../../../shared/workflow.js';
import { audit, HttpError, type Context } from '../../shared/context.js';
import { userRoutes } from '../users/routes.js';
import { settingsRoutes } from '../settings/routes.js';
const include = { platforms: true, variants: true, tags: { include: { tag: true } }, rubric: true, campaign: true, author: { select: { id: true, name: true } } } satisfies Prisma.PostInclude;
const idOf = (request: FastifyRequest) => z.object({ id: z.uuid() }).parse(request.params).id;
const requireEditor = async (request: FastifyRequest) => { if (!request.user || !canEdit(request.user.role)) throw new HttpError(403, 'Недостаточно прав'); };
function nested(data: PostInput) {
  return {
    platforms: { create: data.platforms.map(platform => ({ platform })) },
    variants: { create: data.platforms.map(platform => ({ platform, inheritBaseText: true, text: '', ...data.variants.find(x => x.platform === platform) })) },
    tags: { create: data.tagIds.map(tagId => ({ tagId })) }
  };
}
function scalar(data: PostInput) { const { platforms: _platforms, variants: _variants, tagIds: _tags, ...values } = data; return values; }
export async function registerCore(app: FastifyInstance, ctx: Context) {
  const { db, config } = ctx;
  await userRoutes(app, ctx); await settingsRoutes(app, ctx);
  const checkEnabled = (data: PostInput) => { if (data.platforms.includes('ok') && config.OK_ENABLED !== 'true') throw new HttpError(400, 'OK выключен feature flag'); };
  app.get('/api/posts', async request => {
    const query = z.object({ status: z.enum(statuses).optional(), platform: z.enum(platforms).optional(), rubricId: z.uuid().optional(), campaignId: z.uuid().optional(), authorId: z.uuid().optional(), from: z.iso.datetime({ offset: true }).optional(), to: z.iso.datetime({ offset: true }).optional(), backlog: z.enum(['true', 'false']).optional(), search: z.string().max(250).optional(), offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(200).default(100) }).parse(request.query);
    const where: Prisma.PostWhereInput = { status: query.status, rubricId: query.rubricId, campaignId: query.campaignId, authorId: query.authorId,
      platforms: query.platform ? { some: { platform: query.platform } } : undefined,
      scheduledAt: query.backlog === 'true' ? null : query.from || query.to ? { gte: query.from, lt: query.to } : undefined,
      internalTitle: query.search ? { contains: query.search, mode: 'insensitive' } : undefined };
    const [items, total] = await db.$transaction([db.post.findMany({ where, include, orderBy: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }], take: query.limit, skip: query.offset }), db.post.count({ where })]);
    return { items, total };
  });
  app.get('/api/posts/:id', async request => {
    const post = await db.post.findUnique({ where: { id: idOf(request) }, include });
    if (!post) throw new HttpError(404, 'Публикация не найдена'); return post;
  });
  app.post('/api/posts', { preHandler: requireEditor }, async (request, reply) => {
    const data = postInputSchema.parse(request.body); checkEnabled(data);
    const initialStatus = z.object({ status: z.enum(['idea', 'draft']).default('draft') }).parse(request.body).status;
    const post = await db.$transaction(async tx => {
      const post = await tx.post.create({ data: { ...scalar(data), status: initialStatus, authorId: request.user!.id, ...nested(data) }, include });
      await audit(tx, request.user!.id, 'post_created', 'Post', post.id, { status: initialStatus }); return post;
    }); return reply.code(201).send(post);
  });
  app.put('/api/posts/:id', { preHandler: requireEditor }, async request => {
    const id = idOf(request); const data = postInputSchema.parse(request.body); checkEnabled(data);
    const version = z.object({ version: z.number().int().positive() }).parse(request.body).version;
    return db.$transaction(async tx => {
      const current = await tx.post.findUnique({ where: { id } });
      if (!current) throw new HttpError(404, 'Публикация не найдена');
      const status = statusAfterEdit(current.status);
      const changed = await tx.post.updateMany({ where: { id, version }, data: { ...scalar(data), status, version: { increment: 1 }, publicationVersion: { increment: 1 } } });
      if (!changed.count) throw new HttpError(409, 'Публикация изменена другим пользователем. Обновите страницу');
      await tx.postPlatform.deleteMany({ where: { postId: id } }); await tx.postVariant.deleteMany({ where: { postId: id } }); await tx.postTag.deleteMany({ where: { postId: id } });
      const post = await tx.post.update({ where: { id }, data: nested(data), include });
      await audit(tx, request.user!.id, current.scheduledAt?.toISOString() !== data.scheduledAt ? 'post_date_changed' : 'post_updated', 'Post', id, { previousStatus: current.status, status, version: post.version }); return post;
    });
  });
  app.post('/api/posts/:id/actions', async request => {
    const id = idOf(request); const input = actionSchema.parse(request.body);
    if (['approve', 'reject'].includes(input.action) ? !['ADMIN', 'APPROVER'].includes(request.user!.role) : !canEdit(request.user!.role)) throw new HttpError(403, 'Недостаточно прав');
    return db.$transaction(async tx => {
      const post = await tx.post.findUnique({ where: { id }, include });
      if (!post) throw new HttpError(404, 'Публикация не найдена');
      const status = transition(post.status, input.action, request.user!.role, { scheduledAt: post.scheduledAt, platforms: post.platforms.length });
      if (['submit', 'approve', 'schedule'].includes(input.action) && post.variants.some(v => !effectiveText(post.baseText, v).trim())) throw new HttpError(400, 'Заполните текст для каждой выбранной площадки');
      const changed = await tx.post.updateMany({ where: { id, version: input.version }, data: { status, version: { increment: 1 } } });
      if (!changed.count) throw new HttpError(409, 'Публикация изменена другим пользователем. Обновите страницу');
      if (input.action === 'approve' || input.action === 'reject') await tx.approval.create({ data: { postId: id, approverId: request.user!.id, decision: status === 'approved' ? 'approved' : 'changes_requested', postVersion: post.version, comment: input.comment } });
      if (input.action === 'cancel') await tx.postPlatform.updateMany({ where: { postId: id }, data: { status: 'cancelled' } });
      await audit(tx, request.user!.id, `post_${input.action}`, 'Post', id, { previousStatus: post.status, status, comment: input.comment ?? null });
      return tx.post.findUniqueOrThrow({ where: { id }, include });
    });
  });
  app.get('/api/dashboard', async request => {
    const { timezone } = z.object({ timezone: z.string().max(100).default('Europe/Moscow') }).parse(request.query);
    try { new Intl.DateTimeFormat('ru', { timeZone: timezone }); } catch { throw new HttpError(400, 'Неизвестный часовой пояс'); }
    // PostgreSQL determines midnight in the user's timezone, including DST.
    const bounds = await db.$queryRaw<{ start: Date; end: Date; tomorrow: Date }[]>`SELECT (date_trunc('day', now() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}) AS start, ((date_trunc('day', now() AT TIME ZONE ${timezone}) + interval '7 days') AT TIME ZONE ${timezone}) AS end, ((date_trunc('day', now() AT TIME ZONE ${timezone}) + interval '1 day') AT TIME ZONE ${timezone}) AS tomorrow`;
    const [counts, backlog, upcoming, todayCount, upcomingCount] = await db.$transaction([db.post.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } }), db.post.count({ where: { scheduledAt: null, status: { not: 'cancelled' } } }), db.post.findMany({ where: { scheduledAt: { gte: bounds[0].start, lt: bounds[0].end }, status: { not: 'cancelled' } }, include, orderBy: { scheduledAt: 'asc' }, take: 100 }), db.post.count({ where: { scheduledAt: { gte: bounds[0].start, lt: bounds[0].tomorrow }, status: { not: 'cancelled' } } }), db.post.count({ where: { scheduledAt: { gte: bounds[0].start, lt: bounds[0].end }, status: { not: 'cancelled' } } })]);
    return { counts: Object.fromEntries(counts.map(x => [x.status, x._count])), backlog, upcoming, todayCount, upcomingCount, publishingEnabled: false };
  });
}
