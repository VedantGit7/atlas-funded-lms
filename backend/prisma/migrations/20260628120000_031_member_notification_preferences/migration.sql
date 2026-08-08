-- CreateTable
CREATE TABLE "member_notification_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "category_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "member_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_notification_preferences_tenant_id_membership_id_categ_key" ON "member_notification_preferences"("tenant_id", "membership_id", "category_key");

-- CreateIndex
CREATE INDEX "member_notification_preferences_tenant_id_membership_id_idx" ON "member_notification_preferences"("tenant_id", "membership_id");

-- AddForeignKey
ALTER TABLE "member_notification_preferences" ADD CONSTRAINT "member_notification_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_notification_preferences" ADD CONSTRAINT "member_notification_preferences_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
