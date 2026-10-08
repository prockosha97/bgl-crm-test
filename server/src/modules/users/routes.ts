import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createUserSchema, updateUserSchema } from '../../../../shared/contracts.js';
import { audit, HttpError, publicUserSelect, type Context } from '../../shared/context.js';
import { hashPassword } from '../auth/security.js';
export async function requireAdmin(request: FastifyRequest) { if (request.user?.role !== 'ADMIN') throw new HttpError(403, 'Доступно только администратору'); }
export async function userRoutes(app: FastifyInstance, { db }: Context) {
  app.get('/api/users/options', async () => db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }));
  app.get('/api/users', { preHandler: requireAdmin }, async () => db.user.findMany({ select: publicUserSelect, orderBy: { createdAt: 'asc' } }));
  app.post('/api/users', { preHandler: requireAdmin }, async (request, reply) => {
    const { password, ...data } = createUserSchema.parse(request.body); const passwordHash = await hashPassword(password);
    const user = await db.$transaction(async tx => {
      const user = await tx.user.create({ data: { ...data, passwordHash }, select: publicUserSelect });
      await audit(tx, request.user!.id, 'user_created', 'User', user.id); return user;
    });
    return reply.code(201).send(user);
  });
  app.put('/api/users/:id', { preHandler: requireAdmin }, async request => {
    const id = z.object({ id: z.uuid() }).parse(request.params).id; const data = updateUserSchema.parse(request.body);
    return db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71624001)`;
      const current = await tx.user.findUnique({ where: { id } });
      if (!current) throw new HttpError(404, 'Пользователь не найден');
      if (current.role === 'ADMIN' && current.isActive && (data.role !== 'ADMIN' || !data.isActive) && await tx.user.count({ where: { role: 'ADMIN', isActive: true } }) <= 1) throw new HttpError(409, 'Нельзя отключить или понизить последнего администратора');
      const user = await tx.user.update({ where: { id }, data, select: publicUserSelect });
      if (data.role !== current.role || !data.isActive) await tx.session.deleteMany({ where: { userId: id } });
      await audit(tx, request.user!.id, 'user_updated', 'User', id, { role: data.role, isActive: data.isActive }); return user;
    });
  });
  app.post('/api/users/:id/password', { preHandler: requireAdmin }, async request => {
    const id = z.object({ id: z.uuid() }).parse(request.params).id;
    const { password } = z.object({ password: z.string().min(12).max(128) }).parse(request.body);
    const passwordHash = await hashPassword(password);
    await db.$transaction(async tx => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: id } });
      await audit(tx, request.user!.id, 'password_reset', 'User', id);
    }); return { ok: true };
  });
}
