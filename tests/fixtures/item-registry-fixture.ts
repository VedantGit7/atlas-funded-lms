import { randomUUID } from "node:crypto";
import { withPlatformScope } from "@atlas/db";
import { seedTenantAccessControl } from "@atlas/access";
import { itemTypesSeed } from "../../prisma/seeds/04-item-types";
import { extensionPointsSeed } from "../../prisma/seeds/05-extension-points";
import { withTenantTx } from "@atlas/db";
import {
  createCourseAuthoringFixture,
  instructorCtx,
  adminCtx,
  learnerCtx,
  otherInstructorCtx,
  authoringTenantTx,
  type CourseAuthoringFixture,
} from "./course-authoring-fixture";

export type ItemRegistryFixture = CourseAuthoringFixture & {
  itemId: string;
  collectionId: string;
};

async function ensureCataloguesSeeded(): Promise<void> {
  await itemTypesSeed.run({
    mode: "apply",
    group: "catalogues",
    log: () => undefined,
  });
  await extensionPointsSeed.run({
    mode: "apply",
    group: "catalogues",
    log: () => undefined,
  });
}

export async function createItemRegistryFixture(): Promise<ItemRegistryFixture> {
  await ensureCataloguesSeeded();

  const base = await createCourseAuthoringFixture();
  const itemId = randomUUID();
  const collectionId = randomUUID();
  const runId = randomUUID().slice(0, 8);

  await withTenantTx(authoringTenantTx(base), async (tx) => {
    await tx.$executeRaw`
      insert into items (
        id,
        tenant_id,
        item_type_key,
        stem_json,
        explanation_json,
        status,
        tags,
        created_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${itemId}::uuid,
        ${base.tenantId}::uuid,
        'swipe',
        ${JSON.stringify({ stem: "Sample swipe prompt" })}::jsonb,
        ${JSON.stringify({ answerKey: { direction: "right" } })}::jsonb,
        'DRAFT',
        ${["swipe", "sample"]}::text[],
        ${base.instructorMembershipId}::uuid,
        now(),
        now()
      )
    `;

    await tx.$executeRaw`
      insert into item_collections (
        id,
        tenant_id,
        slug,
        title,
        collection_type,
        status,
        created_at,
        updated_at
      )
      values (
        ${collectionId}::uuid,
        ${base.tenantId}::uuid,
        ${`swipe-deck-${runId}`},
        'Swipe deck',
        'deck',
        'DRAFT',
        now(),
        now()
      )
    `;
  });

  return {
    ...base,
    itemId,
    collectionId,
  };
}

export async function seedTenantForItemRegistry(tenantId: string): Promise<void> {
  await seedTenantAccessControl({
    tenantId,
    requestId: randomUUID(),
  });
}

export { instructorCtx, adminCtx, learnerCtx, otherInstructorCtx, authoringTenantTx };

export async function listGlobalItemTypes(): Promise<Array<{ key: string }>> {
  return withPlatformScope(
    {
      principalId: "018f0000-0000-7000-8000-000000000099",
      requestId: "test_list_item_types",
      requiredPermission: "platform.catalog.manage",
      platformPermissions: ["platform.catalog.manage"],
    },
    "Listing item types for tests",
    async (tx) => tx.$queryRaw<Array<{ key: string }>>`select key from item_types order by key asc`,
  );
}
