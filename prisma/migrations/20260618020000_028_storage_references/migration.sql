-- Tenant-scoped object storage metadata used by @atlas/storage asset references.

CREATE TABLE "storage_references" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" TEXT,
    "visibility" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "storage_references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "storage_references_tenant_id_status_idx" ON "storage_references"("tenant_id", "status");
CREATE INDEX "storage_references_tenant_id_purpose_idx" ON "storage_references"("tenant_id", "purpose");
