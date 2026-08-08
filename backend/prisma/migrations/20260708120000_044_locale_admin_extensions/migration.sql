-- AlterTable
ALTER TABLE "locale_resources" ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "locale_resources" ADD COLUMN "reviewed_at" TIMESTAMPTZ(6);
ALTER TABLE "locale_resources" ADD COLUMN "reviewed_by" UUID;

-- CreateIndex
CREATE INDEX "locale_resources_tenant_id_review_status_idx" ON "locale_resources"("tenant_id", "review_status");

-- CreateTable
CREATE TABLE "locale_metadata" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "native_name" TEXT,
    "is_rtl" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_fallback" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locale_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locale_canonical_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "source_locale" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locale_canonical_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locale_qa_check_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_by" UUID NOT NULL,

    CONSTRAINT "locale_qa_check_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locale_qa_issues" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locale_qa_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locale_metadata_tenant_id_locale_key" ON "locale_metadata"("tenant_id", "locale");

-- CreateIndex
CREATE INDEX "locale_metadata_tenant_id_is_default_idx" ON "locale_metadata"("tenant_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "locale_canonical_keys_tenant_id_key_key" ON "locale_canonical_keys"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "locale_canonical_keys_tenant_id_source_locale_idx" ON "locale_canonical_keys"("tenant_id", "source_locale");

-- CreateIndex
CREATE INDEX "locale_qa_check_runs_tenant_id_completed_at_idx" ON "locale_qa_check_runs"("tenant_id", "completed_at");

-- CreateIndex
CREATE INDEX "locale_qa_issues_tenant_id_run_id_idx" ON "locale_qa_issues"("tenant_id", "run_id");

-- CreateIndex
CREATE INDEX "locale_qa_issues_tenant_id_locale_key_idx" ON "locale_qa_issues"("tenant_id", "locale", "key");

-- AddForeignKey
ALTER TABLE "locale_qa_issues" ADD CONSTRAINT "locale_qa_issues_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "locale_qa_check_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
