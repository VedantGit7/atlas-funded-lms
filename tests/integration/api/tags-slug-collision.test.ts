import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createTag, updateTag } from "../../../backend/apps/api/src/server/tags/tags.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Slug collisions on create and on rename.
 *
 * The slug is derived from the title and carries a unique index on
 * `(tenant_id, slug)`. Create checked for the collision; rename computed a new
 * slug and never checked, so renaming one tag onto another's slug reached the
 * database and came back as a unique-violation — a 500 for what is an ordinary
 * "that name is taken".
 *
 * Two different titles can also derive the same slug, so the message has to
 * name the tag actually holding it rather than claim the title is taken.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("tag slug collisions (database)", () => {
  it("refuses to create a second tag deriving an existing slug", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) => createTag(tx, ctx, { title: "Risk management" }));

    // A different title deriving the same slug: the clash is on the slug, and
    // the message has to say which tag already holds it.
    await expect(
      withTenantTx(ctx, async (tx) => createTag(tx, ctx, { title: "Risk  Management" })),
    ).rejects.toThrow(/Risk management/);
  });

  it("refuses to rename a tag onto another tag's slug", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const first = await withTenantTx(ctx, async (tx) =>
      createTag(tx, ctx, { title: "Risk management" }),
    );
    const second = await withTenantTx(ctx, async (tx) =>
      createTag(tx, ctx, { title: "Position sizing" }),
    );

    await expect(
      withTenantTx(ctx, async (tx) =>
        updateTag(tx, ctx, second.data.id, { title: "Risk management" }),
      ),
      // Without the check this is a raw unique-violation from Postgres, which
      // surfaces as a 500 rather than a 409 the form can render on the field.
    ).rejects.toThrow(/already/i);

    // And the loser of the race keeps its own slug rather than being half-written.
    expect(first.data.slug).toBe("risk-management");
  });

  it("lets a tag keep its own slug when only the description changes", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const created = await withTenantTx(ctx, async (tx) =>
      createTag(tx, ctx, { title: "Risk management" }),
    );

    // The exclusion is what stops a tag colliding with itself on every save.
    const updated = await withTenantTx(ctx, async (tx) =>
      updateTag(tx, ctx, created.data.id, {
        title: "Risk management",
        description: "Now described",
      }),
    );

    expect(updated.data.slug).toBe("risk-management");
    expect(updated.data.description).toBe("Now described");
  });
});
