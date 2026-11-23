import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { itemRegistryService } from "../../../backend/apps/api/src/server/item-registry/item-registry.service";
import { getDueQueue } from "../../../backend/apps/api/src/server/practice/practice.service";
import {
  collectionItemListResponseSchema,
  collectionItemsAddResponseSchema,
  itemListResponseSchema,
} from "../../../backend/apps/api/src/server/item-registry/item-registry-response-schemas";
import {
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  learnerCtx,
  type ItemRegistryFixture,
} from "../../fixtures/item-registry-fixture";

/**
 * S1.4 against Postgres (QA review 1 C8, M41, M51; review 2 C6):
 * - the picker finds any question in a large bank by text or tag, with a
 *   total and paging (it used to see the first 25);
 * - many questions are added to a collection at once, at the end, skipping
 *   ones already there;
 * - a collection lists its questions' real text, type and status;
 * - a published deck reaches learners in Practice, with published questions.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const BANK_SIZE = 130;

suite("question picker and collections (S1.4)", () => {
  let fixture: ItemRegistryFixture;
  let tag: string;
  let itemIds: string[];

  const asInstructor = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx(authoringTenantTx(fixture), fn);

  async function newDeck() {
    return asInstructor(async (tx) =>
      itemRegistryService.createCollection(tx, instructorCtx(fixture), {
        slug: `deck-${randomUUID().slice(0, 8)}`,
        title: "Candles deck",
        collectionType: "deck",
      }),
    );
  }

  beforeAll(async () => {
    fixture = await createItemRegistryFixture();
    tag = `s14-${randomUUID().slice(0, 8)}`;
    itemIds = [];
    await asInstructor(async (tx) => {
      for (let index = 0; index < BANK_SIZE; index += 1) {
        const id = randomUUID();
        itemIds.push(id);
        await tx.$executeRaw`
          insert into items (id, tenant_id, item_type_key, stem_json, explanation_json, status, tags,
                             created_by_membership_id, created_at, updated_at)
          values (${id}::uuid, ${fixture.tenantId}::uuid, 'swipe',
                  ${JSON.stringify({ stem: `Candle pattern ${String(index + 1)}` })}::jsonb,
                  ${JSON.stringify({ answerKey: { direction: "right" } })}::jsonb,
                  ${index < 3 ? "DRAFT" : "PUBLISHED"}::"PublishStatus", ${[tag]}::text[],
                  ${fixture.instructorMembershipId}::uuid, now(), now())
        `;
      }
    });
  });

  it("finds any question in the bank by tag or text, with a total and paging", async () => {
    const first = itemListResponseSchema.parse(
      await asInstructor((tx) => itemRegistryService.listItems(tx, { q: tag, limit: 100 })),
    );
    expect(first.page.total).toBe(BANK_SIZE);
    expect(first.data).toHaveLength(100);
    expect(first.page.hasMore).toBe(true);

    const second = itemListResponseSchema.parse(
      await asInstructor((tx) =>
        itemRegistryService.listItems(tx, {
          q: tag,
          limit: 100,
          cursor: first.page.nextCursor ?? undefined,
        }),
      ),
    );
    expect(second.data).toHaveLength(BANK_SIZE - 100);
    const seen = new Set([...first.data, ...second.data].map((item) => item.id));
    expect(seen.size).toBe(BANK_SIZE);

    const byText = itemListResponseSchema.parse(
      await asInstructor((tx) =>
        itemRegistryService.listItems(tx, { q: "Candle pattern 117", limit: 25 }),
      ),
    );
    expect(byText.data.map((item) => item.id)).toContain(itemIds[116]);
  });

  it("adds many questions at the end, in order, skipping ones already there", async () => {
    const deck = await newDeck();
    const [a, b, c, d] = itemIds.slice(10, 14) as [string, string, string, string];

    const first = collectionItemsAddResponseSchema.parse(
      await asInstructor((tx) =>
        itemRegistryService.addItemsToCollection(tx, instructorCtx(fixture), deck.data.id, {
          itemIds: [a, b, a, c, randomUUID()],
        }),
      ),
    );
    expect(first.data.added.map((entry) => [entry.itemId, entry.position])).toEqual([
      [a, 1],
      [b, 2],
      [c, 3],
    ]);
    expect(first.data.skipped).toBe(2);

    const second = await asInstructor((tx) =>
      itemRegistryService.addItemsToCollection(tx, instructorCtx(fixture), deck.data.id, {
        itemIds: [b, d],
      }),
    );
    expect(second.data.added.map((entry) => [entry.itemId, entry.position])).toEqual([[d, 4]]);
    expect(second.data.skipped).toBe(1);

    // A single add with no position goes to the end too.
    const single = await asInstructor((tx) =>
      itemRegistryService.addItemToCollection(tx, instructorCtx(fixture), deck.data.id, {
        itemId: itemIds[20] ?? "",
      }),
    );
    expect(single.data.position).toBe(5);

    const listed = collectionItemListResponseSchema.parse(
      await asInstructor((tx) => itemRegistryService.listCollectionItems(tx, deck.data.id)),
    );
    expect(listed.data).toHaveLength(5);
    expect(listed.data[0]?.item).toEqual({
      stem: "Candle pattern 11",
      itemTypeKey: "swipe",
      status: "PUBLISHED",
    });
  });

  it("shows a published deck to learners in Practice, with its published questions", async () => {
    const deck = await newDeck();
    const draftAndPublished = [itemIds[0], itemIds[1], itemIds[50], itemIds[51]] as string[];
    await asInstructor((tx) =>
      itemRegistryService.addItemsToCollection(tx, instructorCtx(fixture), deck.data.id, {
        itemIds: draftAndPublished,
      }),
    );

    const learnerDecks = async () =>
      (
        await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
          getDueQueue(tx, learnerCtx(fixture), { limit: 10 }),
        )
      ).data.availableDecks.find((option) => option.collectionId === deck.data.id);

    // A draft collection isn't shown.
    expect(await learnerDecks()).toBeUndefined();

    await asInstructor((tx) =>
      itemRegistryService.updateCollection(tx, instructorCtx(fixture), deck.data.id, {
        status: "PUBLISHED",
      }),
    );
    // Published: shown, counting only the published questions.
    expect(await learnerDecks()).toMatchObject({ title: "Candles deck", itemCount: 2 });

    // Publishing the drafts (the collection's "Publish these") adds them.
    await asInstructor((tx) =>
      itemRegistryService.bulkSetItemStatus(tx, instructorCtx(fixture), {
        status: "PUBLISHED",
        itemIds: [itemIds[0] ?? "", itemIds[1] ?? ""],
      }),
    );
    expect(await learnerDecks()).toMatchObject({ itemCount: 4 });

    await asInstructor((tx) =>
      itemRegistryService.updateCollection(tx, instructorCtx(fixture), deck.data.id, {
        status: "DRAFT",
      }),
    );
    expect(await learnerDecks()).toBeUndefined();
  });
});
