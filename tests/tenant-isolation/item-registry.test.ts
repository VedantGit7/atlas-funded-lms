import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { itemRegistryService } from "../../backend/apps/api/src/server/item-registry/item-registry.service";
import { itemImportService } from "../../backend/apps/api/src/server/item-registry/item-import.service";
import { itemImportColumns } from "../../backend/apps/api/src/server/item-registry/item-import.contract";
import {
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  otherInstructorCtx,
} from "../fixtures/item-registry-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";
import { seedTenantForItemRegistry } from "../fixtures/item-registry-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("item registry tenant isolation", () => {
  it("Tenant A cannot read Tenant B item", async () => {
    const tenantA = await createItemRegistryFixture();
    const tenantB = await createItemRegistryFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemRegistryService.getItem(tx, tenantB.itemId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot update Tenant B item", async () => {
    const tenantA = await createItemRegistryFixture();
    const tenantB = await createItemRegistryFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemRegistryService.updateItem(tx, instructorCtx(tenantA), tenantB.itemId, {
          contentJson: { stem: "Hijacked" },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("instructor cannot update another instructor item", async () => {
    const fixture = await createItemRegistryFixture();

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.otherInstructorMembershipId), async (tx) =>
        itemRegistryService.updateItem(tx, otherInstructorCtx(fixture), fixture.itemId, {
          contentJson: { stem: "Not allowed" },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot add Tenant B item to collection", async () => {
    const tenantA = await createItemRegistryFixture();
    const tenantB = await createItemRegistryFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemRegistryService.addItemToCollection(tx, instructorCtx(tenantA), tenantA.collectionId, {
          itemId: tenantB.itemId,
          position: 1,
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("RLS blocks direct cross-tenant item read", async () => {
    const isolation = await createTenantIsolationFixture();
    await seedTenantForItemRegistry(isolation.tenantA.tenantId);
    await seedTenantForItemRegistry(isolation.tenantB.tenantId);

    const itemId = randomUUID();

    await withTenantTx(tenantCtx(isolation.tenantB), async (tx) => {
      await tx.$executeRaw`
        insert into items (
          id,
          tenant_id,
          item_type_key,
          stem_json,
          status,
          tags,
          created_by_membership_id,
          created_at,
          updated_at
        )
        values (
          ${itemId}::uuid,
          ${isolation.tenantB.tenantId}::uuid,
          'swipe',
          ${JSON.stringify({ stem: "Tenant B item" })}::jsonb,
          'DRAFT',
          '{}'::text[],
          ${isolation.tenantB.membershipId}::uuid,
          now(),
          now()
        )
      `;
    });

    await withTenantTx(tenantCtx(isolation.tenantA), async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        select id::text from items where id = ${itemId}::uuid
      `;
      expect(rows).toHaveLength(0);
    });
  });

  it("Tenant A cannot add questions to, or finish, Tenant B's import", async () => {
    const tenantA = await createItemRegistryFixture();
    const tenantB = await createItemRegistryFixture();
    const columns = itemImportColumns("true_false", []);
    const template = {
      format: "atlas-item-import",
      version: "1",
      itemTypeKey: "true_false" as const,
      columns: columns.map((column) => column.key),
      headers: columns.map((column) => column.header),
    };
    const batch = await withTenantTx(authoringTenantTx(tenantB), async (tx) =>
      itemImportService.createBatch(tx, instructorCtx(tenantB), {
        template,
        fileName: "b.xlsx",
        rowsInFile: 1,
        rowsWithErrors: 0,
        rowsToImport: 1,
        skipDuplicates: true,
        extraTags: [],
      }),
    );

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemImportService.importRows(tx, instructorCtx(tenantA), batch.data.id, {
          template,
          rows: [{ rowNumber: 2, cells: { question: "Injected", correct_answer: "TRUE" } }],
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemImportService.completeBatch(tx, instructorCtx(tenantA), batch.data.id),
      ),
    ).rejects.toMatchObject({ status: 404 });

    const visibleToA = await withTenantTx(
      authoringTenantTx(tenantA),
      async (tx) => tx.$queryRaw<Array<{ id: string }>>`select id::text from item_import_batches`,
    );
    expect(visibleToA.map((row) => row.id)).not.toContain(batch.data.id);

    // Nor see it in the history, or undo it.
    const history = await withTenantTx(authoringTenantTx(tenantA), async (tx) =>
      itemImportService.listBatches(tx, instructorCtx(tenantA), { limit: 50 }),
    );
    expect(history.data.map((entry) => entry.id)).not.toContain(batch.data.id);
    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemImportService.undoBatch(tx, instructorCtx(tenantA), batch.data.id),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot list, change the status of, or delete Tenant B items", async () => {
    const tenantA = await createItemRegistryFixture();
    const tenantB = await createItemRegistryFixture();

    const listed = await withTenantTx(authoringTenantTx(tenantA), async (tx) =>
      itemRegistryService.listItems(tx, { limit: 100 }),
    );
    expect(listed.data.map((item) => item.id)).not.toContain(tenantB.itemId);

    const bulk = await withTenantTx(authoringTenantTx(tenantA), async (tx) =>
      itemRegistryService.bulkSetItemStatus(tx, instructorCtx(tenantA), {
        status: "PUBLISHED",
        itemIds: [tenantB.itemId],
      }),
    );
    expect(bulk.data).toMatchObject({ updated: 0, skipped: 1 });

    const status = await withTenantTx(
      authoringTenantTx(tenantB),
      async (tx) =>
        tx.$queryRaw<Array<{ status: string }>>`
        select status::text as status from items where id = ${tenantB.itemId}::uuid
      `,
    );
    expect(status[0]?.status).not.toBe("PUBLISHED");

    const deleted = await withTenantTx(authoringTenantTx(tenantA), async (tx) =>
      itemRegistryService.bulkDeleteItems(tx, instructorCtx(tenantA), {
        itemIds: [tenantB.itemId],
      }),
    );
    expect(deleted.data).toMatchObject({ deleted: 0, skipped: 1 });
    const stillThere = await withTenantTx(
      authoringTenantTx(tenantB),
      async (tx) =>
        tx.$queryRaw<Array<{ deleted: boolean }>>`
        select deleted_at is not null as deleted from items where id = ${tenantB.itemId}::uuid
      `,
    );
    expect(stillThere[0]?.deleted).toBe(false);
  });
});
