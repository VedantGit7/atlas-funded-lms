-- CreateTable
CREATE TABLE "item_types" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schema_json" JSONB NOT NULL,
    "grading_json" JSONB,
    "renderer_key" TEXT NOT NULL,
    "is_builtin" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "item_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_type_key" TEXT NOT NULL,
    "stem_json" JSONB NOT NULL,
    "explanation_json" JSONB,
    "difficulty" INTEGER,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[],
    "created_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_options" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "option_json" JSONB NOT NULL,
    "is_correct" BOOLEAN,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "item_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_dimension_weights" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "dimension_id" UUID NOT NULL,
    "weight" DECIMAL(8,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_dimension_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_collections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "collection_type" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "item_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_collection_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "weight" DECIMAL(8,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_types_key_key" ON "item_types"("key");

-- CreateIndex
CREATE INDEX "items_tenant_id_item_type_key_status_idx" ON "items"("tenant_id", "item_type_key", "status");

-- CreateIndex
CREATE INDEX "items_tags_idx" ON "items" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "item_options_tenant_id_item_id_idx" ON "item_options"("tenant_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_options_tenant_id_item_id_position_key" ON "item_options"("tenant_id", "item_id", "position");

-- CreateIndex
CREATE INDEX "item_dimension_weights_tenant_id_dimension_id_idx" ON "item_dimension_weights"("tenant_id", "dimension_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_dimension_weights_tenant_id_item_id_dimension_id_key" ON "item_dimension_weights"("tenant_id", "item_id", "dimension_id");

-- CreateIndex
CREATE INDEX "item_collections_tenant_id_collection_type_status_idx" ON "item_collections"("tenant_id", "collection_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "item_collections_tenant_id_slug_key" ON "item_collections"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "item_collection_items_tenant_id_collection_id_item_id_key" ON "item_collection_items"("tenant_id", "collection_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_collection_items_tenant_id_collection_id_position_key" ON "item_collection_items"("tenant_id", "collection_id", "position");
