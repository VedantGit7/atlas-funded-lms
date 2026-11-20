import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { itemRegistryService } from "../../../backend/apps/api/src/server/item-registry/item-registry.service";
import {
  BulkDeleteItemsBodySchema,
  BulkItemStatusBodySchema,
  ListItemsQuerySchema,
} from "../../../backend/apps/api/src/server/item-registry/schemas";
import {
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  otherInstructorCtx,
  type ItemRegistryFixture,
} from "../../fixtures/item-registry-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function inTx<T>(fixture: ItemRegistryFixture, run: Parameters<typeof withTenantTx>[1]) {
  return withTenantTx(authoringTenantTx(fixture), run) as Promise<T>;
}

type Ctx = ReturnType<typeof instructorCtx>;

async function addSwipes(
  fixture: ItemRegistryFixture,
  stems: string[],
  tags: string[],
  ctx: Ctx = instructorCtx(fixture),
): Promise<string[]> {
  const ids: string[] = [];
  for (const stem of stems) {
    const created = await inTx<{ data: { id: string } }>(fixture, (tx) =>
      itemRegistryService.createItem(tx, ctx, {
        itemTypeKey: "swipe",
        contentJson: { stem },
        answerKeyJson: { direction: "right" },
        tags,
      }),
    );
    ids.push(created.data.id);
  }
  return ids;
}

async function list(fixture: ItemRegistryFixture, query: Record<string, unknown>) {
  return inTx<Awaited<ReturnType<typeof itemRegistryService.listItems>>>(fixture, (tx) =>
    itemRegistryService.listItems(tx, ListItemsQuerySchema.parse(query)),
  );
}

async function bulk(fixture: ItemRegistryFixture, body: unknown, ctx?: Ctx) {
  return inTx<Awaited<ReturnType<typeof itemRegistryService.bulkSetItemStatus>>>(fixture, (tx) =>
    itemRegistryService.bulkSetItemStatus(
      tx,
      ctx ?? instructorCtx(fixture),
      BulkItemStatusBodySchema.parse(body),
    ),
  );
}

describeWithDb("item bank list", () => {
  it("pages through every item and counts them all", async () => {
    const fixture = await createItemRegistryFixture();
    await addSwipes(
      fixture,
      Array.from({ length: 7 }, (_, index) => `Paging card ${String(index + 1)}`),
      ["paging"],
    );

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await list(fixture, { q: "paging", limit: 3, ...(cursor ? { cursor } : {}) });
      expect(page.page.total).toBe(7);
      seen.push(...page.data.map((item) => item.id));
      cursor = page.page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(7);
  });

  it("searches the question, tags and reference, ignoring case and wildcards", async () => {
    const fixture = await createItemRegistryFixture();
    const [stopLoss] = await addSwipes(fixture, ["A STOP-LOSS limits risk"], ["risk"]);
    await addSwipes(fixture, ["Leverage multiplies exposure"], ["Leverage_basics"]);
    await addSwipes(fixture, ["100% of traders pass"], ["myths"]);

    expect((await list(fixture, { q: "stop-loss" })).data.map((item) => item.id)).toEqual([
      stopLoss,
    ]);
    expect((await list(fixture, { q: "LEVERAGE_BASICS" })).page.total).toBe(1);
    // % and _ are literal characters, not wildcards.
    expect((await list(fixture, { q: "100%" })).page.total).toBe(1);
    expect((await list(fixture, { q: "%" })).page.total).toBe(1);
    expect((await list(fixture, { q: "Leverage_" })).page.total).toBe(1);
    expect((await list(fixture, { q: "Leverage%" })).page.total).toBe(0);
  });

  it("filters by type and status across the whole bank", async () => {
    const fixture = await createItemRegistryFixture();
    const ids = await addSwipes(fixture, ["Filter one", "Filter two"], ["filtering"]);
    await bulk(fixture, { status: "PUBLISHED", itemIds: [ids[0]] });

    const published = await list(fixture, { q: "filtering", status: "PUBLISHED" });
    expect(published.data.map((item) => item.id)).toEqual([ids[0]]);
    expect((await list(fixture, { q: "filtering", status: "DRAFT" })).page.total).toBe(1);
    expect((await list(fixture, { q: "filtering", itemTypeKey: "mcq_single" })).page.total).toBe(0);
  });

  it("refuses a cursor that is not an item id instead of failing", () => {
    expect(ListItemsQuerySchema.safeParse({ cursor: "x" }).success).toBe(false);
  });
});

describeWithDb("item bulk status", () => {
  it("publishes the listed items and audits each change", async () => {
    const fixture = await createItemRegistryFixture();
    const ids = await addSwipes(fixture, ["Bulk one", "Bulk two"], ["bulk"]);

    const result = await bulk(fixture, { status: "PUBLISHED", itemIds: ids });
    expect(result.data).toEqual({ status: "PUBLISHED", updated: 2, remaining: 0, skipped: 0 });

    const again = await bulk(fixture, { status: "PUBLISHED", itemIds: ids });
    expect(again.data).toMatchObject({ updated: 0, remaining: 0, skipped: 0 });

    const audits = await inTx<Array<{ target_id: string }>>(
      fixture,
      (tx) => tx.$queryRaw`
        select target_id from audit_entries
         where action = 'item.updated' and target_id = any(${ids}::text[])
           and after_json ->> 'status' = 'PUBLISHED'
      `,
    );
    expect(new Set(audits.map((row) => row.target_id))).toEqual(new Set(ids));
  });

  it("changes every item matching a filter, reporting what is left", async () => {
    const fixture = await createItemRegistryFixture();
    await addSwipes(fixture, ["Match one", "Match two", "Match three"], ["matching"]);

    const result = await bulk(fixture, {
      status: "PUBLISHED",
      filter: { q: "matching", status: "DRAFT" },
    });
    expect(result.data).toMatchObject({ updated: 3, remaining: 0 });
    expect((await list(fixture, { q: "matching", status: "DRAFT" })).page.total).toBe(0);
  });

  it("leaves another author's items alone and counts them as skipped", async () => {
    const fixture = await createItemRegistryFixture();
    const mine = await addSwipes(fixture, ["Mine"], ["authors"]);
    const theirs = await addSwipes(fixture, ["Theirs"], ["authors"], otherInstructorCtx(fixture));

    const result = await bulk(fixture, { status: "PUBLISHED", itemIds: [...mine, ...theirs] });
    expect(result.data).toMatchObject({ updated: 1, remaining: 0, skipped: 1 });

    const byFilter = await bulk(fixture, { status: "ARCHIVED", filter: { q: "authors" } });
    expect(byFilter.data).toMatchObject({ updated: 1, remaining: 0, skipped: 1 });
  });

  it("asks for either ids or a filter", () => {
    expect(BulkItemStatusBodySchema.safeParse({ status: "PUBLISHED" }).success).toBe(false);
    expect(
      BulkItemStatusBodySchema.safeParse({
        status: "PUBLISHED",
        itemIds: ["2f1c1d1e-0000-4000-8000-000000000000"],
        filter: {},
      }).success,
    ).toBe(false);
    expect(BulkItemStatusBodySchema.safeParse({ status: "REVIEW", filter: {} }).success).toBe(
      false,
    );
  });
});

async function bulkDelete(fixture: ItemRegistryFixture, body: unknown, ctx?: Ctx) {
  return inTx<Awaited<ReturnType<typeof itemRegistryService.bulkDeleteItems>>>(fixture, (tx) =>
    itemRegistryService.bulkDeleteItems(
      tx,
      ctx ?? instructorCtx(fixture),
      BulkDeleteItemsBodySchema.parse(body),
    ),
  );
}

async function putInCollection(fixture: ItemRegistryFixture, itemId: string) {
  await inTx(fixture, (tx) =>
    itemRegistryService.addItemToCollection(tx, instructorCtx(fixture), fixture.collectionId, {
      itemId,
      position: 1,
    }),
  );
}

describeWithDb("item delete", () => {
  it("deletes the listed items nothing uses, keeps one in a collection, and audits each", async () => {
    const fixture = await createItemRegistryFixture();
    const [free, published, inDeck] = await addSwipes(
      fixture,
      ["Delete one", "Delete two", "Delete three"],
      ["deleting"],
    );
    await bulk(fixture, { status: "PUBLISHED", itemIds: [published] });
    await putInCollection(fixture, inDeck ?? "");

    const result = await bulkDelete(fixture, { itemIds: [free, published, inDeck] });
    expect(result.data).toEqual({ deleted: 2, remaining: 0, inUse: 1, skipped: 0 });

    const left = await list(fixture, { q: "deleting" });
    expect(left.data.map((item) => item.id)).toEqual([inDeck]);

    const audits = await inTx<Array<{ target_id: string }>>(
      fixture,
      (tx) => tx.$queryRaw`
        select target_id from audit_entries
         where action = 'item.deleted' and target_id = any(${[free, published]}::text[])
      `,
    );
    expect(new Set(audits.map((row) => row.target_id))).toEqual(new Set([free, published]));
  });

  it("deletes every item matching a filter, but never another author's", async () => {
    const fixture = await createItemRegistryFixture();
    await addSwipes(fixture, ["Sweep one", "Sweep two"], ["sweeping"]);
    await addSwipes(fixture, ["Sweep theirs"], ["sweeping"], otherInstructorCtx(fixture));

    const result = await bulkDelete(fixture, { filter: { q: "sweeping" } });
    expect(result.data).toMatchObject({ deleted: 2, remaining: 0, inUse: 0, skipped: 1 });
    expect((await list(fixture, { q: "sweeping" })).page.total).toBe(1);
  });

  it("refuses to delete a single item that is in use", async () => {
    const fixture = await createItemRegistryFixture();
    const [inDeck] = await addSwipes(fixture, ["Single in use"], ["single"]);
    await putInCollection(fixture, inDeck ?? "");

    await expect(
      inTx(fixture, (tx) =>
        itemRegistryService.deleteItem(tx, instructorCtx(fixture), inDeck ?? ""),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await list(fixture, { q: "single in use" })).page.total).toBe(1);
  });

  it("asks for either ids or a filter", () => {
    expect(BulkDeleteItemsBodySchema.safeParse({}).success).toBe(false);
    expect(BulkDeleteItemsBodySchema.safeParse({ filter: {}, itemIds: [] }).success).toBe(false);
  });
});
