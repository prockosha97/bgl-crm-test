import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { campaignSchema } from '../../../../shared/contracts.js';
import { audit, type Context } from '../../shared/context.js';
import { requireAdmin } from '../users/routes.js';
export async function settingsRoutes(app: FastifyInstance, { db, config }: Context) {
  app.get('/api/catalog', async () => ({
    rubrics: await db.rubric.findMany({ orderBy: { name: 'asc' } }),
    campaigns: await db.campaign.findMany({ orderBy: { name: 'asc' } }),
    tags: await db.tag.findMany({ orderBy: { name: 'asc' } }),
    channels: await db.socialChannel.findMany({ select: { id: true, platform: true, displayName: true, isEnabled: true, connectionStatus: true } }),
    features: { ok: config.OK_ENABLED === 'true', publishing: false }
  }));
  for (const kind of ['rubrics', 'campaigns', 'tags'] as const) {
    const parse = (body: unknown) => kind === 'campaigns' ? campaignSchema.parse(body) : z.object({ name: z.string().trim().min(1).max(200) }).parse(body);
    app.post(`/api/catalog/${kind}`, { preHandler: requireAdmin }, async (request, reply) => {
      const input = parse(request.body);
      const data = await db.$transaction(async tx => {
        const result = kind === 'rubrics' ? await tx.rubric.create({ data: { name: input.name } }) : kind === 'tags' ? await tx.tag.create({ data: { name: input.name } }) : await tx.campaign.create({ data: campaignSchema.parse(request.body) });
        await audit(tx, request.user!.id, 'catalog_created', kind, result.id); return result;
      }); return reply.code(201).send(data);
    });
    app.put(`/api/catalog/${kind}/:id`, { preHandler: requireAdmin }, async request => {
      const id = z.object({ id: z.uuid() }).parse(request.params).id; const input = parse(request.body);
      return db.$transaction(async tx => {
        const result = kind === 'rubrics' ? await tx.rubric.update({ where: { id }, data: { name: input.name } }) : kind === 'tags' ? await tx.tag.update({ where: { id }, data: { name: input.name } }) : await tx.campaign.update({ where: { id }, data: campaignSchema.parse(request.body) });
        await audit(tx, request.user!.id, 'catalog_updated', kind, id); return result;
      });
    });
    app.delete(`/api/catalog/${kind}/:id`, { preHandler: requireAdmin }, async request => {
      const id = z.object({ id: z.uuid() }).parse(request.params).id;
      await db.$transaction(async tx => {
        if (kind === 'rubrics') await tx.rubric.delete({ where: { id } }); else if (kind === 'tags') await tx.tag.delete({ where: { id } }); else await tx.campaign.delete({ where: { id } });
        await audit(tx, request.user!.id, 'catalog_deleted', kind, id);
      }); return { ok: true };
    });
  }
}
