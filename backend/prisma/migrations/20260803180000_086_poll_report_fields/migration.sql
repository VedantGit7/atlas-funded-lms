-- Learnyst-style Polls report fields.

ALTER TABLE "polls"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "poll_type" TEXT NOT NULL DEFAULT 'multiple_choice',
  ADD COLUMN IF NOT EXISTS "quiz_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allow_multiple_answers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "anonymous_vote" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "result_visibility" TEXT NOT NULL DEFAULT 'after_vote',
  ADD COLUMN IF NOT EXISTS "layout" TEXT NOT NULL DEFAULT 'list',
  ADD COLUMN IF NOT EXISTS "duration_seconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "live_session_id" UUID;

CREATE INDEX IF NOT EXISTS "polls_tenant_id_live_session_id_idx"
  ON "polls"("tenant_id", "live_session_id");

ALTER TABLE "poll_options"
  ADD COLUMN IF NOT EXISTS "is_correct" BOOLEAN NOT NULL DEFAULT false;
