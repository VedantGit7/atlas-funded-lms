import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { readTenantAuditLog } from "@atlas/audit/services/audit-reader.service";
import { createTag, updateTag } from "../../../backend/apps/api/src/server/tags/tags.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Narrowing the audit log to one record.
 *
 * The endpoint could already filter by target *type*, which answers "what
 * happened to tags" — not the question a detail screen asks. Without a
 * `targetId` filter, a per-record history panel would have to read the whole
 * tenant log and filter in the browser, which is wrong on a log that paginates.
 *
 * Worth a database test rather than a mock because the predicate is SQL, and
 * because `target_id` is a text column: passing a uuid-typed parameter against
 * it is the mistake this catches.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("audit targetId filter (database)", () => {
  it("returns only the named record's entries", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const first = await withTenantTx(ctx, async (tx) =>
      createTag(tx, ctx, { title: "Risk management" }),
    );
    const second = await withTenantTx(ctx, async (tx) =>
      createTag(tx, ctx, { title: "Position sizing" }),
    );
    await withTenantTx(ctx, async (tx) =>
      updateTag(tx, ctx, first.data.id, { description: "Edited once" }),
    );

    const scoped = await withTenantTx(ctx, async (tx) =>
      readTenantAuditLog(tx, { limit: 25, targetType: "tag", targetId: first.data.id }),
    );

    expect(scoped.data).toHaveLength(2);
    expect(scoped.data.every((entry) => entry.targetId === first.data.id)).toBe(true);
    expect(scoped.data.map((entry) => entry.action).sort()).toEqual(["tag.create", "tag.update"]);

    // The other tag's create is in the log, just not in this answer.
    const unscoped = await withTenantTx(ctx, async (tx) =>
      readTenantAuditLog(tx, { limit: 25, targetType: "tag" }),
    );
    expect(unscoped.data.map((entry) => entry.targetId)).toContain(second.data.id);
  });

  it("returns nothing rather than everything for an unknown target", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    await withTenantTx(ctx, async (tx) => createTag(tx, ctx, { title: "Solo" }));

    // A filter that silently matches everything when the value is unrecognised
    // is the failure mode worth guarding: it would leak an unrelated history
    // into a detail panel.
    const scoped = await withTenantTx(ctx, async (tx) =>
      readTenantAuditLog(tx, { limit: 25, targetId: "not-a-real-target" }),
    );
    expect(scoped.data).toHaveLength(0);
  });

  it("leaves the unfiltered log untouched", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    await withTenantTx(ctx, async (tx) => createTag(tx, ctx, { title: "Anything" }));

    const all = await withTenantTx(ctx, async (tx) => readTenantAuditLog(tx, { limit: 25 }));
    expect(all.data.length).toBeGreaterThan(0);
  });
});
