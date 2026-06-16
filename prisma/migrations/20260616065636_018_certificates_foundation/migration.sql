-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_json" JSONB NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "r2_object_key" TEXT,
    "metadata_json" JSONB,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_verifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificate_templates_tenant_id_key_key" ON "certificate_templates"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_credential_id_key" ON "certificates"("credential_id");

-- CreateIndex
CREATE INDEX "certificates_tenant_id_membership_id_issued_at_idx" ON "certificates"("tenant_id", "membership_id", "issued_at");

-- CreateIndex
CREATE INDEX "certificates_tenant_id_template_id_status_idx" ON "certificates"("tenant_id", "template_id", "status");

-- CreateIndex
CREATE INDEX "credential_verifications_tenant_id_certificate_id_occurred__idx" ON "credential_verifications"("tenant_id", "certificate_id", "occurred_at");
