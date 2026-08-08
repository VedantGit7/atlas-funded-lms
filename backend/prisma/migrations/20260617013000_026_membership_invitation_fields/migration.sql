-- Invitation acceptance fields required for ATL-STORY-006.
ALTER TABLE "memberships" ALTER COLUMN "auth_principal_id" DROP NOT NULL;

ALTER TABLE "memberships"
  ADD COLUMN "invited_email_normalized" TEXT,
  ADD COLUMN "invite_token_hash" TEXT,
  ADD COLUMN "invite_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "accepted_at" TIMESTAMPTZ(6);

CREATE INDEX "memberships_tenant_id_invite_token_hash_idx"
  ON "memberships" ("tenant_id", "invite_token_hash")
  WHERE "invite_token_hash" IS NOT NULL AND "accepted_at" IS NULL;
