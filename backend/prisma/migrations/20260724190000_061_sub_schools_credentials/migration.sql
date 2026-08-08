-- Migration 061: sub-school create credentials (url key already stored as key).

ALTER TABLE "sub_schools"
  ADD COLUMN IF NOT EXISTS "mobile_number" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

-- Name length aligned with create form (60). Existing longer names are truncated.
UPDATE "sub_schools"
SET "name" = LEFT("name", 60)
WHERE LENGTH("name") > 60;

CREATE UNIQUE INDEX IF NOT EXISTS "sub_schools_tenant_id_email_key"
  ON "sub_schools"("tenant_id", "email")
  WHERE "email" IS NOT NULL;
