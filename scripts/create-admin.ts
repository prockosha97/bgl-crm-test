import { createDatabase } from '../server/src/infrastructure/database.js';
import { z } from 'zod';
import { hashPassword } from '../server/src/modules/auth/security.js';
const parsed = z.object({ ADMIN_EMAIL: z.email().trim().toLowerCase(), ADMIN_PASSWORD: z.string().min(12).max(128) }).safeParse(process.env);
if (!parsed.success) throw new Error('Supply ADMIN_EMAIL and ADMIN_PASSWORD (12–128 characters) in environment');
const db = createDatabase(process.env.DATABASE_URL!);
try {
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71624001)`;
    if (await tx.user.count({ where: { role: 'ADMIN', isActive: true } })) throw new Error('An ADMIN already exists; use user management');
    const user = await tx.user.create({ data: { email: parsed.data.ADMIN_EMAIL, name: 'Администратор', role: 'ADMIN', passwordHash: await hashPassword(parsed.data.ADMIN_PASSWORD) } });
    await tx.auditLog.create({ data: { action: 'bootstrap_admin', entityType: 'User', entityId: user.id, actorUserId: user.id } });
  });
  console.log('First ADMIN created; password was not logged.');
} finally { await db.$disconnect(); }
