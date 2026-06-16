-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'TENANT', 'PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACTIONED', 'REJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "community_spaces" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'TENANT',
    "config_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "community_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_key" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "author_membership_id" UUID NOT NULL,
    "title" TEXT,
    "body_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "author_membership_id" UUID NOT NULL,
    "body_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "reaction_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mentioned_membership_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'OPEN',
    "reason_key" TEXT,
    "opened_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_decisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "moderation_case_id" UUID NOT NULL,
    "decided_by_membership_id" UUID,
    "decision_key" TEXT NOT NULL,
    "decision_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "moderation_case_id" UUID NOT NULL,
    "submitted_by_membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_spaces_tenant_id_visibility_idx" ON "community_spaces"("tenant_id", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "community_spaces_tenant_id_slug_key" ON "community_spaces"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "group_memberships_tenant_id_membership_id_idx" ON "group_memberships"("tenant_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_memberships_tenant_id_space_id_membership_id_key" ON "group_memberships"("tenant_id", "space_id", "membership_id");

-- CreateIndex
CREATE INDEX "posts_tenant_id_space_id_created_at_idx" ON "posts"("tenant_id", "space_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_tenant_id_author_membership_id_created_at_idx" ON "posts"("tenant_id", "author_membership_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_tenant_id_post_id_created_at_idx" ON "comments"("tenant_id", "post_id", "created_at");

-- CreateIndex
CREATE INDEX "reactions_tenant_id_target_type_target_id_idx" ON "reactions"("tenant_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_tenant_id_membership_id_target_type_target_id_rea_key" ON "reactions"("tenant_id", "membership_id", "target_type", "target_id", "reaction_key");

-- CreateIndex
CREATE INDEX "mentions_tenant_id_mentioned_membership_id_created_at_idx" ON "mentions"("tenant_id", "mentioned_membership_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_cases_tenant_id_status_created_at_idx" ON "moderation_cases"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "moderation_decisions_tenant_id_moderation_case_id_occurred__idx" ON "moderation_decisions"("tenant_id", "moderation_case_id", "occurred_at");

-- CreateIndex
CREATE INDEX "appeals_tenant_id_status_created_at_idx" ON "appeals"("tenant_id", "status", "created_at");
