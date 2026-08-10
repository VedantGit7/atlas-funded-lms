-- Persist Zoom participant email for unmatched identity reconciliation.
ALTER TABLE "zoom_meeting_participants"
  ADD COLUMN IF NOT EXISTS "email" TEXT;

CREATE INDEX IF NOT EXISTS "zoom_meeting_participants_tenant_email_idx"
  ON "zoom_meeting_participants" ("tenant_id", lower("email"))
  WHERE "email" IS NOT NULL;
