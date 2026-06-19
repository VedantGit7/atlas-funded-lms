import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { itemRegistryService } from "../../../apps/web/src/server/item-registry/item-registry.service";
import { extensionsService } from "../../../apps/web/src/server/extensions/extensions.service";
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
