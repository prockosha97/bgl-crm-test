import type { PostInput, PostStatus, Role } from '../../shared/contracts';
export interface User { id: string; name: string; email: string; role: Role; isActive: boolean }
export interface Named { id: string; name: string }
export interface Campaign extends Named { slug: string; dateFrom: string | null; dateTo: string | null; utmCampaign: string; description: string }
export interface Post extends Omit<PostInput, 'platforms' | 'tagIds'> {
  id: string; status: PostStatus; version: number; publicationVersion: number; authorId: string;
  platforms: { platform: PostInput['platforms'][number]; status: string }[];
  tags: { tagId: string; tag: Named }[]; rubric: Named | null; campaign: Campaign | null; author: Named;
}
export interface Catalog { rubrics: Named[]; campaigns: Campaign[]; tags: Named[]; channels: { id: string; platform: string; displayName: string; isEnabled: boolean; connectionStatus: string }[]; features: { ok: boolean; publishing: boolean } }
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
let csrfToken = '';
export function setCsrf(token: string) { csrfToken = token; }
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.issues?.map((x: { path: string; message: string }) => `${x.path}: ${x.message}`).join('; ') || data.error || 'Ошибка запроса');
  return data as T;
}
export function postToInput(post: Post): PostInput { return { internalTitle: post.internalTitle, baseText: post.baseText, ctaUrl: post.ctaUrl, scheduledAt: post.scheduledAt, timezone: post.timezone, rubricId: post.rubricId, campaignId: post.campaignId, tagIds: post.tags.map(t => t.tagId), platforms: post.platforms.map(p => p.platform), variants: post.variants.map(v => ({ platform: v.platform, inheritBaseText: v.inheritBaseText, text: v.text })), contentEntityType: post.contentEntityType, contentEntityId: post.contentEntityId, contentEntityUrl: post.contentEntityUrl }; }
