-- Learnyst-style Batches report: cohort window on batches + batch-scoped live sessions.

ALTER TABLE "batches"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "starts_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "ends_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "batches_tenant_id_starts_at_idx"
  ON "batches"("tenant_id", "starts_at");

ALTER TABLE "live_sessions"
  ADD COLUMN IF NOT EXISTS "batch_id" UUID;

CREATE INDEX IF NOT EXISTS "live_sessions_tenant_id_batch_id_idx"
  ON "live_sessions"("tenant_id", "batch_id");

CREATE INDEX IF NOT EXISTS "live_sessions_tenant_id_course_id_idx"
  ON "live_sessions"("tenant_id", "course_id");
