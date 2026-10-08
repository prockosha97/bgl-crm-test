import { z } from 'zod';
export const roles = ['ADMIN', 'CONTENT_MANAGER', 'APPROVER', 'VIEWER'] as const;
export type Role = typeof roles[number];
export const platforms = ['telegram', 'max', 'vk', 'ok'] as const;
export const statuses = ['idea', 'draft', 'review', 'changes_requested', 'approved', 'scheduled', 'publishing', 'published', 'partially_published', 'failed', 'cancelled'] as const;
export type PostStatus = typeof statuses[number];
export const statusLabels: Record<PostStatus, string> = { idea: 'Идея', draft: 'Черновик', review: 'На согласовании', changes_requested: 'Нужна доработка', approved: 'Согласовано', scheduled: 'Запланировано', publishing: 'Публикуется', published: 'Опубликовано', partially_published: 'Частично опубликовано', failed: 'Ошибка', cancelled: 'Отменено' };
export const platformLabels = { telegram: 'Telegram', max: 'MAX', vk: 'VK', ok: 'OK' };
export const timezoneSchema = z.string().max(100).refine(value => { try { new Intl.DateTimeFormat('ru', { timeZone: value }); return true; } catch { return false; } }, 'Неизвестный часовой пояс');
const optionalUrl = z.union([z.url().refine(v => /^https?:\/\//.test(v), 'Разрешены только HTTP(S) ссылки'), z.literal('')]).transform(v => v || null).nullable();
export const variantSchema = z.object({ platform: z.enum(platforms), inheritBaseText: z.boolean(), text: z.string().max(50000) });
export const postInputSchema = z.object({
  internalTitle: z.string().trim().min(1, 'Введите название').max(250), baseText: z.string().max(50000),
  ctaUrl: optionalUrl, scheduledAt: z.iso.datetime({ offset: true }).nullable(), timezone: timezoneSchema,
  rubricId: z.uuid().nullable(), campaignId: z.uuid().nullable(), tagIds: z.array(z.uuid()).max(50),
  platforms: z.array(z.enum(platforms)).max(4), variants: z.array(variantSchema).max(4),
  contentEntityType: z.enum(['lecture', 'collection', 'campaign_page', 'news', 'other']).nullable().default(null),
  contentEntityId: z.string().max(250).nullable().default(null), contentEntityUrl: optionalUrl.default(null)
}).superRefine((v, ctx) => {
  if (new Set(v.platforms).size !== v.platforms.length || new Set(v.tagIds).size !== v.tagIds.length) ctx.addIssue({ code: 'custom', message: 'Повторяющиеся площадки или теги' });
  if (new Set(v.variants.map(x => x.platform)).size !== v.variants.length || v.variants.some(x => !v.platforms.includes(x.platform))) ctx.addIssue({ code: 'custom', message: 'Варианты должны соответствовать выбранным площадкам' });
});
export type PostInput = z.infer<typeof postInputSchema>;
export const loginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(128) });
export const createUserSchema = z.object({ email: z.email().trim().toLowerCase(), name: z.string().trim().min(1).max(120), password: z.string().min(12).max(128), role: z.enum(roles) });
export const updateUserSchema = z.object({ name: z.string().trim().min(1).max(120), role: z.enum(roles), isActive: z.boolean() });
export const actionSchema = z.object({ action: z.enum(['draft', 'submit', 'approve', 'reject', 'schedule', 'cancel']), version: z.number().int().positive(), comment: z.string().trim().max(2000).optional() });
export type PostAction = z.infer<typeof actionSchema>['action'];
export function canEdit(role: Role) { return role === 'ADMIN' || role === 'CONTENT_MANAGER'; }
export function effectiveText(base: string, variant: { inheritBaseText: boolean; text: string }) { return variant.inheritBaseText ? base : variant.text; }
export const campaignSchema = z.object({ name: z.string().trim().min(1).max(200), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), utmCampaign: z.string().trim().min(1).max(200), description: z.string().max(5000).default(''), dateFrom: z.iso.datetime({ offset: true }).nullable(), dateTo: z.iso.datetime({ offset: true }).nullable() }).refine(v => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, 'Конец кампании раньше начала');
