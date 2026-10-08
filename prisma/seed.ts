import { createDatabase } from '../server/src/infrastructure/database.js';
import { hashPassword } from '../server/src/modules/auth/security.js';
if (process.env.NODE_ENV === 'production') throw new Error('Dev seed is forbidden in production');
const password = process.env.DEV_SEED_PASSWORD;
if (!password || password.length < 12 || password.length > 128) throw new Error('Set DEV_SEED_PASSWORD (12–128 characters) for local-only accounts');
const db = createDatabase(process.env.DATABASE_URL!);
try {
  const passwordHash = await hashPassword(password);
  for (const [email, role, name] of [['admin@example.local', 'ADMIN', 'Администратор'], ['content@example.local', 'CONTENT_MANAGER', 'Контент-менеджер'], ['approver@example.local', 'APPROVER', 'Согласующий']] as const) {
    await db.user.upsert({ where: { email }, update: {}, create: { email, role, name, passwordHash } });
  }
  for (const name of ['Новая лекция', 'Подборка', 'Инструкция', 'История лектора', 'Календарный повод', 'Новости проекта', 'Партнерство']) await db.rubric.upsert({ where: { name }, update: {}, create: { name } });
  for (const [platform, displayName] of [['telegram', 'Telegram'], ['max', 'MAX'], ['vk', 'VK'], ['ok', 'OK']] as const) await db.socialChannel.upsert({ where: { platform_externalChannelId: { platform, externalChannelId: 'dev-not-connected' } }, update: {}, create: { platform, displayName, externalChannelId: 'dev-not-connected', isEnabled: false, connectionStatus: platform === 'ok' ? 'disabled' : 'not_connected' } });
  console.log('Dev seed completed (existing accounts and passwords preserved).');
} finally { await db.$disconnect(); }
