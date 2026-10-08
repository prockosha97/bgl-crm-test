import type { Prisma } from '@prisma/client';
/** Append-only through the application; called inside the mutation transaction. */
export function audit(tx: Prisma.TransactionClient, userId: string | null, action: string, entityType: string, entityId?: string, metadata: Prisma.InputJsonValue = {}) {
  return tx.auditLog.create({ data: { actorUserId: userId, action, entityType, entityId, metadata } });
}
