import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  createItemRegistryFixture,
  instructorCtx,
  learnerCtx,
  adminCtx,
  authoringTenantTx,
  type ItemRegistryFixture,
} from "./item-registry-fixture";

export type PracticeFixture = ItemRegistryFixture & {
  swipeItemIds: string[];
  publishedCollectionId: string;
};

async function publishSwipeItem(
  fixture: ItemRegistryFixture,
  itemId: string,
  stem: string,
  direction: "left" | "right",
) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      update items
      set
        status = 'PUBLISHED'::"PublishStatus",
        stem_json = ${JSON.stringify({ stem })}::jsonb,
        explanation_json = ${JSON.stringify({ answerKey: { direction } })}::jsonb,
        updated_at = now()
      where id = ${itemId}::uuid
    `;
  });
}

export async function createPracticeFixture(): Promise<PracticeFixture> {
  const base = await createItemRegistryFixture();
  const swipeItemIds = [randomUUID(), randomUUID(), randomUUID()];
  const publishedCollectionId = randomUUID();
  const runId = randomUUID().slice(0, 8);

  await publishSwipeItem(base, base.itemId, "Due card one", "right");

  await withTenantTx(authoringTenantTx(base), async (tx) => {
    for (const [index, itemId] of swipeItemIds.entries()) {
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
          ${JSON.stringify({ stem: `Swipe card ${index + 2}` })}::jsonb,
          ${JSON.stringify({ answerKey: { direction: index % 2 === 0 ? "right" : "left" } })}::jsonb,
          'PUBLISHED'::"PublishStatus",
          ${["swipe"]}::text[],
          ${base.instructorMembershipId}::uuid,
          now(),
          now()
        )
      `;
    }

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
        ${publishedCollectionId}::uuid,
        ${base.tenantId}::uuid,
        ${`published-deck-${runId}`},
        'Published Swipe Deck',
        'deck',
        'PUBLISHED'::"PublishStatus",
        now(),
        now()
      )
    `;

    const allItemIds = [base.itemId, ...swipeItemIds];
    for (const [position, itemId] of allItemIds.entries()) {
      await tx.$executeRaw`
        insert into item_collection_items (
          id,
          tenant_id,
          collection_id,
          item_id,
          position,
          created_at
        )
        values (
          ${randomUUID()}::uuid,
          ${base.tenantId}::uuid,
          ${publishedCollectionId}::uuid,
          ${itemId}::uuid,
          ${position + 1},
          now()
        )
      `;
    }
  });

  return {
    ...base,
    swipeItemIds: [base.itemId, ...swipeItemIds],
    publishedCollectionId,
  };
}

export { instructorCtx, learnerCtx, adminCtx, authoringTenantTx };
