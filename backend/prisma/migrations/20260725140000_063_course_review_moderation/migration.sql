-- Migration 063: course review moderation status for Manage > Ratings and Reviews.

ALTER TABLE "course_reviews"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "admin_note" TEXT;

UPDATE "course_reviews"
  SET "status" = 'APPROVED'
  WHERE "status" IS NULL OR "status" = '';

CREATE INDEX IF NOT EXISTS "course_reviews_tenant_id_status_created_at_idx"
  ON "course_reviews"("tenant_id", "status", "created_at");
