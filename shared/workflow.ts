import { canEdit, type PostAction, type PostStatus, type Role } from './contracts.js';
export class WorkflowError extends Error {}
export function transition(status: PostStatus, action: PostAction, role: Role, input: { scheduledAt: Date | null; platforms: number; now?: Date }): PostStatus {
  const approver = role === 'ADMIN' || role === 'APPROVER';
  if (action === 'approve' || action === 'reject') {
    if (!approver) throw new WorkflowError('Согласование доступно только ADMIN и APPROVER');
    if (status !== 'review') throw new WorkflowError('Публикация не находится на согласовании');
    return action === 'approve' ? 'approved' : 'changes_requested';
  }
  if (!canEdit(role)) throw new WorkflowError('Недостаточно прав для изменения публикации');
  switch (action) {
    case 'draft': if (['idea', 'changes_requested', 'review'].includes(status)) return 'draft'; break;
    case 'submit': if (['draft', 'changes_requested'].includes(status) && input.platforms > 0) return 'review'; break;
    case 'schedule': if (status === 'approved' && input.platforms > 0 && input.scheduledAt && input.scheduledAt > (input.now ?? new Date())) return 'scheduled'; break;
    case 'cancel': if (['idea', 'draft', 'review', 'changes_requested', 'approved', 'scheduled'].includes(status)) return 'cancelled'; break;
  }
  throw new WorkflowError('Недопустимый переход: проверьте статус, площадки и будущую дату');
}
export function statusAfterEdit(status: PostStatus): PostStatus {
  if (!['idea', 'draft', 'changes_requested', 'approved', 'scheduled'].includes(status)) throw new WorkflowError('Верните публикацию в черновик перед редактированием');
  return status === 'approved' || status === 'scheduled' ? 'draft' : status;
}
