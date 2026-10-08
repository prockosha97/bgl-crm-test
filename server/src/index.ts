import { buildApp } from './app.js';
import { readConfig } from './shared/config.js';
import { createDatabase } from './infrastructure/database.js';
const config = readConfig(); const db = createDatabase(config.DATABASE_URL);
const app = await buildApp({ db, config });
async function shutdown() { await app.close(); await db.$disconnect(); }
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void shutdown().catch(() => { process.exitCode = 1; }); });
try { await app.listen({ host: '0.0.0.0', port: config.PORT }); } catch { await shutdown(); process.exitCode = 1; }
