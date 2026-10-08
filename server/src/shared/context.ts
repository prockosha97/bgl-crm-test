import type { PrismaClient } from '@prisma/client';
import type { Role } from '../../../shared/contracts.js';
import type { Config } from './config.js';
export interface CurrentUser { id: string; name: string; email: string; role: Role; isActive: boolean }
export interface Context { db: PrismaClient; config: Config }
declare module 'fastify' {
  interface FastifyRequest { user: CurrentUser | null; session: { id: string; csrfToken: string } | null }
}
export const publicUserSelect = { id: true, email: true, name: true, role: true, isActive: true } as const;
export { audit } from '../modules/audit/service.js';
export class HttpError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
