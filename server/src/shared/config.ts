import { z } from 'zod';
const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(80),
  DATABASE_URL: z.string().min(1), APP_BASE_URL: z.url().default('http://localhost:80'),
  SESSION_SECRET: z.string().min(32), MEDIA_ROOT: z.string().default('/data/media'), OK_ENABLED: z.enum(['true', 'false']).default('false')
});
export type Config = z.infer<typeof configSchema>;
export function readConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) throw new Error(`Invalid configuration fields: ${result.error.issues.map(x => x.path.join('.')).join(', ')}`);
  const config = result.data;
  if (config.NODE_ENV === 'production' && !config.APP_BASE_URL.startsWith('https://')) throw new Error('Production APP_BASE_URL must use HTTPS');
  return config;
}
