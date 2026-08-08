-- Learnyst-style enrollment roster fields: type + access expiry.
ALTER TABLE "enrollments"
  ADD COLUMN IF NOT EXISTS "enrolled_type" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "enrollments_tenant_id_enrolled_at_idx"
  ON "enrollments" ("tenant_id", "enrolled_at" DESC);

CREATE INDEX IF NOT EXISTS "enrollments_tenant_id_enrolled_type_idx"
  ON "enrollments" ("tenant_id", "enrolled_type");

CREATE INDEX IF NOT EXISTS "enrollments_tenant_id_expires_at_idx"
  ON "enrollments" ("tenant_id", "expires_at");
