-- Migration 057: learner-owned practice decks.
--
-- `created_by_membership_id` is NULL for tenant/studio-authored collections and
-- set to the owning membership for learner-created decks. Ownership is enforced
-- in the service layer; tenant isolation continues to come from the existing
-- RLS policies on item_collections.

ALTER TABLE "item_collections" ADD COLUMN "created_by_membership_id" UUID;

-- Hot path: "list the decks owned by this member in this tenant".
CREATE INDEX "item_collections_tenant_owner_idx"
  ON "item_collections"("tenant_id", "created_by_membership_id");
