-- AlterTable
ALTER TABLE "memberships" ADD COLUMN "last_active_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "memberships_tenant_id_last_active_at_idx" ON "memberships"("tenant_id", "last_active_at");
