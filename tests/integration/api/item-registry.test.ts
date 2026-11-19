import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { itemRegistryService } from "../../../backend/apps/api/src/server/item-registry/item-registry.service";
import { extensionsService } from "../../../backend/apps/api/src/server/extensions/extensions.service";
import {
  adminCtx,
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  listGlobalItemTypes,
} from "../../fixtures/item-registry-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("item registry integration", () => {
  it("returns seeded swipe item type", async () => {
    const fixture = await createItemRegistryFixture();

    const types = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      itemRegistryService.listItemTypes(tx),
    );

    expect(types.data.some((type) => type.key === "swipe")).toBe(true);
  });

  it("creates DRAFT item with server actor membership id", async () => {
    const fixture = await createItemRegistryFixture();
    const ctx = instructorCtx(fixture);

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      itemRegistryService.createItem(tx, ctx, {
        itemTypeKey: "swipe",
        contentJson: { stem: "New swipe card" },
        answerKeyJson: { direction: "left" },
        options: [
          {
            optionJson: { label: "Agree" },
            position: 1,
            isCorrect: true,
          },
        ],
        tags: ["psychology"],
      }),
    );

    expect(created.data.status).toBe("DRAFT");
    expect(created.data.createdByMembershipId).toBe(fixture.instructorMembershipId);
    expect(created.data.options).toHaveLength(1);
  });

  describe("answer keys name the stored options", () => {
    // The editor names correct options by its own temporary ids, and options
    // get new ids whenever they are saved. The stored key must name the
    // stored options, or a multi-select question marks every answer wrong.
    const editorOptions = [
      { optionJson: { label: "Hammer" }, isCorrect: true, position: 1 },
      { optionJson: { label: "Bullish engulfing" }, isCorrect: true, position: 2 },
      { optionJson: { label: "Shooting star" }, isCorrect: false, position: 3 },
    ];

    function storedCorrectIds(item: {
      options?: Array<{ id: string; isCorrect: boolean | null }>;
    }) {
      return (item.options ?? [])
        .filter((option) => option.isCorrect === true)
        .map((option) => option.id)
        .sort();
    }

    it("creates a multi-select question whose key names its stored correct options", async () => {
      const fixture = await createItemRegistryFixture();
      const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.createItem(tx, instructorCtx(fixture), {
          itemTypeKey: "mcq_multi",
          contentJson: { stem: "Which candles are bullish reversals?" },
          answerKeyJson: { correctOptionIds: ["client-a", "client-b"], explanation: "Both." },
          options: editorOptions,
          tags: [],
        }),
      );

      const key = created.data.answerKeyJson as { correctOptionIds: string[]; explanation: string };
      expect([...key.correctOptionIds].sort()).toEqual(storedCorrectIds(created.data));
      expect(key.correctOptionIds).toHaveLength(2);
      expect(key.explanation).toBe("Both.");
    });

    it("keeps the key on the same options when only the question changes", async () => {
      const fixture = await createItemRegistryFixture();
      const ctx = instructorCtx(fixture);
      const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.createItem(tx, ctx, {
          itemTypeKey: "mcq_single",
          contentJson: { stem: "Which candle is a bullish reversal?" },
          answerKeyJson: { correctOptionId: "client-a" },
          options: [
            { optionJson: { label: "Hammer" }, isCorrect: true, position: 1 },
            { optionJson: { label: "Shooting star" }, isCorrect: false, position: 2 },
          ],
          tags: [],
        }),
      );

      const updated = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.updateItem(tx, ctx, created.data.id, {
          contentJson: { stem: "Which single candle is a bullish reversal?" },
        }),
      );

      expect(updated.data.options?.map((option) => option.id)).toEqual(
        created.data.options?.map((option) => option.id),
      );
      expect((updated.data.answerKeyJson as { correctOptionId: string }).correctOptionId).toBe(
        storedCorrectIds(updated.data)[0],
      );
    });

    it("moves the key to the new options when the options are saved again", async () => {
      const fixture = await createItemRegistryFixture();
      const ctx = instructorCtx(fixture);
      const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.createItem(tx, ctx, {
          itemTypeKey: "mcq_multi",
          contentJson: { stem: "Which candles are bullish reversals?" },
          answerKeyJson: { correctOptionIds: [] },
          options: editorOptions,
          tags: [],
        }),
      );

      const updated = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.updateItem(tx, ctx, created.data.id, {
          // What the editor sends: the old ids in the key, options without ids.
          answerKeyJson: { correctOptionIds: storedCorrectIds(created.data) },
          options: editorOptions.map((option, index) => ({ ...option, isCorrect: index === 2 })),
        }),
      );

      const key = updated.data.answerKeyJson as { correctOptionIds: string[] };
      expect(key.correctOptionIds).toEqual(storedCorrectIds(updated.data));
      expect(key.correctOptionIds).toHaveLength(1);
      expect(storedCorrectIds(updated.data)).not.toEqual(storedCorrectIds(created.data));
    });
  });

  it("refuses a question that cannot be graded, and says why", async () => {
    const fixture = await createItemRegistryFixture();
    const ctx = instructorCtx(fixture);

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.createItem(tx, ctx, {
          itemTypeKey: "mcq_single",
          contentJson: { stem: "Pick one" },
          answerKeyJson: {},
          options: [
            { optionJson: { label: "A" }, isCorrect: true, position: 1 },
            { optionJson: { label: "B" }, isCorrect: true, position: 2 },
          ],
          tags: [],
        }),
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("Mark only one option as correct."),
    });

    // Status and tags alone are not checked, so an older question can still
    // be archived or retagged.
    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      itemRegistryService.updateItem(tx, ctx, fixture.itemId, { tags: ["retagged"] }),
    );
  });

  it("rejects unknown item type", async () => {
    const fixture = await createItemRegistryFixture();
    const ctx = instructorCtx(fixture);

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.createItem(tx, ctx, {
          itemTypeKey: "unknown_type",
          contentJson: { stem: "Bad" },
          options: [],
          tags: [],
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("soft deletes item and writes audit row", async () => {
    const fixture = await createItemRegistryFixture();
    const ctx = instructorCtx(fixture);

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await itemRegistryService.deleteItem(tx, ctx, fixture.itemId);

      const rows = await tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and target_id = ${fixture.itemId}
          and action = 'item.deleted'
        limit 1
      `;

      expect(rows).toHaveLength(1);
    });
  });

  it("rejects duplicate dimension weights", async () => {
    const fixture = await createItemRegistryFixture();
    const ctx = instructorCtx(fixture);
    const dimensionId = randomUUID();

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.putDimensionWeights(tx, ctx, fixture.itemId, {
          weights: [
            { dimensionId, weight: 0.5 },
            { dimensionId, weight: 0.25 },
          ],
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("creates collection and rejects duplicate slug", async () => {
    const fixture = await createItemRegistryFixture();
    const ctx = instructorCtx(fixture);

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      itemRegistryService.createCollection(tx, ctx, {
        slug: `deck-${randomUUID().slice(0, 8)}`,
        title: "Deck",
        collectionType: "deck",
      }),
    );

    expect(created.data.status).toBe("DRAFT");

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        itemRegistryService.createCollection(tx, ctx, {
          slug: created.data.slug,
          title: "Duplicate",
          collectionType: "deck",
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("adds item to collection and rejects duplicate item", async () => {
    const fixture = await createItemRegistryFixture();
    const ctx = instructorCtx(fixture);

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await itemRegistryService.addItemToCollection(tx, ctx, fixture.collectionId, {
        itemId: fixture.itemId,
        position: 1,
      });

      await expect(
        itemRegistryService.addItemToCollection(tx, ctx, fixture.collectionId, {
          itemId: fixture.itemId,
          position: 2,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  it("creates extension registration with audit row", async () => {
    const fixture = await createItemRegistryFixture();
    const ctx = adminCtx(fixture);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      const created = await extensionsService.createRegistration(tx, ctx, {
        extensionPointKey: "item_type_renderer",
        registrationKey: `swipe-${randomUUID().slice(0, 8)}`,
        configJson: { rendererKey: "swipe" },
        status: "ACTIVE",
      });

      const rows = await tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and target_id = ${created.data.id}
          and action = 'extension.registration.created'
        limit 1
      `;

      expect(rows).toHaveLength(1);
    });
  });

  it("does not expose tenant_id in item type catalogue", async () => {
    const fixture = await createItemRegistryFixture();

    const types = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      itemRegistryService.listItemTypes(tx),
    );

    expect(JSON.stringify(types)).not.toContain("tenantId");
    expect(JSON.stringify(types)).not.toContain("tenant_id");
  });

  it("lists global swipe from catalogue seed", async () => {
    const globalTypes = await listGlobalItemTypes();
    expect(globalTypes.some((type) => type.key === "swipe")).toBe(true);
  });
});
