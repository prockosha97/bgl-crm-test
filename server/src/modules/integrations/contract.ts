import type { SocialPlatform } from '@prisma/client';
export type PublicationErrorCode = 'AUTH_FAILED' | 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'VALIDATION_FAILED' | 'MEDIA_UPLOAD_FAILED' | 'REMOTE_SERVER_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
export interface PlatformPostInput { postId: string; publicationVersion: number; channelId: string; text: string; ctaUrl: string | null; media: { assetId: string; mimeType: string; storagePath: string }[]; settings: Record<string, unknown> }
export interface ConnectionStatus { status: 'connected' | 'not_connected' | 'disabled' | 'error'; message?: string }
export interface ValidationResult { valid: boolean; errors: { code: PublicationErrorCode; message: string }[] }
export interface PublishResult { externalPostId: string; postUrl: string | null; publishedAt: Date; sanitizedResponse?: Record<string, unknown> }
export interface PostMetrics { views: number | null; reach: number | null; reactions: number | null; likes: number | null; comments: number | null; shares: number | null; linkClicks: number | null }
/** Phase 4+ adapters implement this boundary; no external platform SDK in domain code. */
export interface SocialAdapter {
  platform: SocialPlatform;
  verifyConnection(): Promise<ConnectionStatus>;
  validate(post: PlatformPostInput): Promise<ValidationResult>;
  publish(post: PlatformPostInput): Promise<PublishResult>;
  edit?(externalPostId: string, post: PlatformPostInput): Promise<PublishResult>;
  delete?(externalPostId: string): Promise<void>;
  getMetrics?(externalPostId: string): Promise<PostMetrics>;
}
