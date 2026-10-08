-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONTENT_MANAGER', 'APPROVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('telegram', 'max', 'vk', 'ok');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('idea', 'draft', 'review', 'changes_requested', 'approved', 'scheduled', 'publishing', 'published', 'partially_published', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PlatformStatus" AS ENUM ('pending', 'queued', 'publishing', 'published', 'retrying', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('not_connected', 'connected', 'error', 'disabled');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('approved', 'changes_requested');

-- CreateEnum
CREATE TYPE "ContentEntityType" AS ENUM ('lecture', 'collection', 'campaign_page', 'news', 'other');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "internalTitle" TEXT NOT NULL,
    "baseText" TEXT NOT NULL DEFAULT '',
    "ctaUrl" TEXT,
    "scheduledAt" TIMESTAMPTZ(3),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publicationVersion" INTEGER NOT NULL DEFAULT 1,
    "authorId" UUID NOT NULL,
    "rubricId" UUID,
    "campaignId" UUID,
    "contentEntityType" "ContentEntityType",
    "contentEntityId" TEXT,
    "contentEntityUrl" TEXT,
    "utmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "utmContent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostPlatform" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "PlatformStatus" NOT NULL DEFAULT 'pending',
    "channelId" UUID,

    CONSTRAINT "PostPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostVariant" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "inheritBaseText" BOOLEAN NOT NULL DEFAULT true,
    "text" TEXT NOT NULL DEFAULT '',
    "platformSpecificSettings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "PostVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "dateFrom" TIMESTAMPTZ(3),
    "dateTo" TIMESTAMPTZ(3),
    "utmCampaign" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "source" TEXT,
    "rightsComment" TEXT,
    "rightsValidUntil" TIMESTAMPTZ(3),
    "uploadedById" UUID NOT NULL,
    "campaignId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTag" (
    "assetId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "AssetTag_pkey" PRIMARY KEY ("assetId","tagId")
);

-- CreateTable
CREATE TABLE "PostAsset" (
    "postId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostAsset_pkey" PRIMARY KEY ("postId","assetId")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "postVersion" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialChannel" (
    "id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalChannelId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'not_connected',
    "lastVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SocialChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialCredential" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SocialCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationJob" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "channelId" UUID NOT NULL,
    "publicationVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PlatformStatus" NOT NULL DEFAULT 'queued',
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "leaseUntil" TIMESTAMPTZ(3),
    "lockedBy" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "payloadSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PublicationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationAttempt" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawResponse" JSONB,

    CONSTRAINT "PublicationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPost" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "publicationVersion" INTEGER NOT NULL,
    "jobId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "externalPostId" TEXT NOT NULL,
    "postUrl" TEXT,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL,
    "rawResponse" JSONB,

    CONSTRAINT "PlatformPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" UUID NOT NULL,
    "platformPostId" UUID NOT NULL,
    "snapshotAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" BIGINT,
    "reach" BIGINT,
    "reactions" BIGINT,
    "likes" BIGINT,
    "comments" BIGINT,
    "shares" BIGINT,
    "linkClicks" BIGINT,
    "rawMetrics" JSONB,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Post_scheduledAt_idx" ON "Post"("scheduledAt");

-- CreateIndex
CREATE INDEX "Post_status_idx" ON "Post"("status");

-- CreateIndex
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE INDEX "Post_campaignId_idx" ON "Post"("campaignId");

-- CreateIndex
CREATE INDEX "Post_rubricId_idx" ON "Post"("rubricId");

-- CreateIndex
CREATE INDEX "PostPlatform_channelId_idx" ON "PostPlatform"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "PostPlatform_postId_platform_key" ON "PostPlatform"("postId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "PostVariant_postId_platform_key" ON "PostVariant"("postId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "Rubric_name_key" ON "Rubric"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_filename_key" ON "Asset"("filename");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storagePath_key" ON "Asset"("storagePath");

-- CreateIndex
CREATE INDEX "Asset_campaignId_idx" ON "Asset"("campaignId");

-- CreateIndex
CREATE INDEX "Asset_uploadedById_idx" ON "Asset"("uploadedById");

-- CreateIndex
CREATE INDEX "AssetTag_tagId_idx" ON "AssetTag"("tagId");

-- CreateIndex
CREATE INDEX "PostAsset_assetId_idx" ON "PostAsset"("assetId");

-- CreateIndex
CREATE INDEX "Approval_postId_createdAt_idx" ON "Approval"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialChannel_platform_externalChannelId_key" ON "SocialChannel"("platform", "externalChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialCredential_channelId_key" ON "SocialCredential"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationJob_idempotencyKey_key" ON "PublicationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PublicationJob_status_scheduledAt_idx" ON "PublicationJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PublicationJob_leaseUntil_idx" ON "PublicationJob"("leaseUntil");

-- CreateIndex
CREATE INDEX "PublicationJob_channelId_idx" ON "PublicationJob"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationJob_postId_platform_publicationVersion_key" ON "PublicationJob"("postId", "platform", "publicationVersion");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationAttempt_jobId_attempt_key" ON "PublicationAttempt"("jobId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPost_jobId_key" ON "PlatformPost"("jobId");

-- CreateIndex
CREATE INDEX "PlatformPost_postId_platform_idx" ON "PlatformPost"("postId", "platform");

-- CreateIndex
CREATE INDEX "PlatformPost_channelId_externalPostId_idx" ON "PlatformPost"("channelId", "externalPostId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPost_postId_platform_publicationVersion_key" ON "PlatformPost"("postId", "platform", "publicationVersion");

-- CreateIndex
CREATE INDEX "MetricSnapshot_platformPostId_snapshotAt_idx" ON "MetricSnapshot"("platformPostId", "snapshotAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPlatform" ADD CONSTRAINT "PostPlatform_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPlatform" ADD CONSTRAINT "PostPlatform_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SocialChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVariant" ADD CONSTRAINT "PostVariant_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTag" ADD CONSTRAINT "AssetTag_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTag" ADD CONSTRAINT "AssetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAsset" ADD CONSTRAINT "PostAsset_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAsset" ADD CONSTRAINT "PostAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialCredential" ADD CONSTRAINT "SocialCredential_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SocialChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationJob" ADD CONSTRAINT "PublicationJob_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationJob" ADD CONSTRAINT "PublicationJob_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SocialChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationAttempt" ADD CONSTRAINT "PublicationAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PublicationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPost" ADD CONSTRAINT "PlatformPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPost" ADD CONSTRAINT "PlatformPost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PublicationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPost" ADD CONSTRAINT "PlatformPost_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SocialChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_platformPostId_fkey" FOREIGN KEY ("platformPostId") REFERENCES "PlatformPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
