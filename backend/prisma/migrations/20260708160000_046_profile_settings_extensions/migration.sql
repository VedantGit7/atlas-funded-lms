-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable: memberships (self-service archive, distinct from admin-initiated suspension)
ALTER TABLE "memberships" ADD COLUMN "archived_at" TIMESTAMPTZ(6);

-- AlterTable: member_profiles (timezone + profile visibility)
ALTER TABLE "member_profiles" ADD COLUMN "timezone" TEXT;
ALTER TABLE "member_profiles" ADD COLUMN "profile_visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable: member_notification_preferences (per-channel toggles, backfilled from existing "enabled")
ALTER TABLE "member_notification_preferences" ADD COLUMN "email_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "member_notification_preferences" ADD COLUMN "in_app_enabled" BOOLEAN NOT NULL DEFAULT true;
UPDATE "member_notification_preferences" SET "email_enabled" = "enabled", "in_app_enabled" = "enabled";
