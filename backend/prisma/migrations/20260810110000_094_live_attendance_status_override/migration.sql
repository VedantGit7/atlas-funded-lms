-- Manual attendance status overrides for live class attendance reports.

ALTER TABLE "live_attendance"
  ADD COLUMN IF NOT EXISTS "override_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "overridden_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "overridden_by_membership_id" UUID;

CREATE INDEX IF NOT EXISTS "live_attendance_tenant_membership_created_idx"
  ON "live_attendance" ("tenant_id", "membership_id", "created_at");
