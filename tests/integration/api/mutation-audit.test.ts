import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { auditWriter } from "@atlas/audit";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { ensureMutationAudited } from "../../../backend/packages/api/src/mutation-audit";
import { itemRegistryService } from "../../../backend/apps/api/src/server/item-registry/item-registry.service";
import {
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  type ItemRegistryFixture,
} from "../../fixtures/item-registry-fixture";

/**
 * Audit M7 against Postgres: `audit: "required"` is enforced by the route
 * wrapper through a transaction-local mark set by the audit_entries trigger,
 * and answer-key edits are traceable.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

suite("mutation audit (audit M7)", () => {
  let fixture: ItemRegistryFixture;
  const inTx = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx(authoringTenantTx(fixture, fixture.instructorMembershipId), fn);
  const marked = async (tx: TenantTx) => {
    const rows = await tx.$queryRaw<Array<{ written: string | null }>>`
      select current_setting('atlas.audit_written', true) as written
    `;
    return rows[0]?.written === "on";
  };
  const writeEntry = (tx: TenantTx, requestId: string) =>
    auditWriter.write(
      tx,
      {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.instructorMembershipId,
        platformPrincipalId: null,
        requestId,
      },
      {
        action: "m7.test",
        target: { type: "test", id: null },
        before: null,
        after: null,
        metadata: {},
      },
    );
  const entriesFor = (requestId: string) =>
    inTx(
      (tx) =>
        tx.$queryRaw<Array<{ action: string; target_type: string; metadata: string }>>`
        select action, target_type, coalesce(metadata_json::text, '') as metadata
          from audit_entries
         where request_id = ${requestId}
         order by occurred_at
      `,
    );

  beforeAll(async () => {
    fixture = await createItemRegistryFixture();
  });

  it("marks the transaction that wrote an entry, and only that one", async () => {
    await inTx(async (tx) => {
      expect(await marked(tx)).toBe(false);
      await writeEntry(tx, `m7-mark-${randomUUID()}`);
      expect(await marked(tx)).toBe(true);
    });
    await inTx(async (tx) => {
      expect(await marked(tx)).toBe(false);
    });
  });

  it("forgets an entry whose savepoint rolled back", async () => {
    await inTx(async (tx) => {
      await tx.$executeRaw`savepoint m7`;
      await writeEntry(tx, `m7-rollback-${randomUUID()}`);
      expect(await marked(tx)).toBe(true);
      await tx.$executeRaw`rollback to savepoint m7`;
      expect(await marked(tx)).toBe(false);
    });
  });

  it("records a required mutation that wrote nothing, and nothing extra otherwise", async () => {
    const metadata = {
      permission: "item.update",
      audit: "required" as const,
      rateLimit: "tenantMutation",
      idempotency: "required" as const,
    };
    const resource = {
      type: "item",
      id: randomUUID(),
      tenantId: fixture.tenantId,
      tenantScoped: true as const,
    };

    const silent = `m7-silent-${randomUUID()}`;
    await inTx((tx) =>
      ensureMutationAudited(tx, {
        ctx: { ...instructorCtx(fixture), requestId: silent },
        metadata,
        method: "PUT",
        route: "/api/v1/items/x",
        resource,
      }),
    );
    const fallback = await entriesFor(silent);
    expect(fallback.map((entry) => entry.action)).toEqual(["api.mutation"]);
    expect(fallback[0]?.metadata).toContain("item.update");

    const explicit = `m7-explicit-${randomUUID()}`;
    await inTx(async (tx) => {
      await writeEntry(tx, explicit);
      await ensureMutationAudited(tx, {
        ctx: { ...instructorCtx(fixture), requestId: explicit },
        metadata,
        method: "PUT",
        route: "/api/v1/items/x",
        resource,
      });
    });
    expect((await entriesFor(explicit)).map((entry) => entry.action)).toEqual(["m7.test"]);
  });

  it("records an answer-key change with what it was and what it became", async () => {
    const created = await inTx((tx) =>
      itemRegistryService.createItem(tx, instructorCtx(fixture), {
        itemTypeKey: "swipe",
        contentJson: { stem: "Is the sky green?" },
        answerKeyJson: { direction: "left" },
        options: [
          { optionJson: { label: "Yes" }, position: 1, isCorrect: false },
          { optionJson: { label: "No" }, position: 2, isCorrect: true },
        ],
        tags: [],
      }),
    );

    const requestId = `m7-key-${randomUUID()}`;
    await inTx((tx) =>
      itemRegistryService.updateItem(
        tx,
        { ...instructorCtx(fixture), requestId },
        created.data.id,
        {
          answerKeyJson: { direction: "right" },
          options: [
            { optionJson: { label: "Yes" }, position: 1, isCorrect: true },
            { optionJson: { label: "No" }, position: 2, isCorrect: false },
          ],
        },
      ),
    );

    const [entry] = await inTx(
      (tx) =>
        tx.$queryRaw<Array<{ action: string; before: unknown; after: unknown; metadata: unknown }>>`
        select action, before_json as before, after_json as after, metadata_json as metadata
          from audit_entries
         where request_id = ${requestId}
      `,
    );
    expect(entry?.action).toBe("item.updated");
    expect(entry?.before).toMatchObject({
      answerKeyJson: { direction: "left" },
      options: [
        { position: 1, isCorrect: false },
        { position: 2, isCorrect: true },
      ],
    });
    expect(entry?.after).toMatchObject({
      answerKeyJson: { direction: "right" },
      options: [
        { position: 1, isCorrect: true },
        { position: 2, isCorrect: false },
      ],
    });
    expect(entry?.metadata).toMatchObject({
      answerKeyChanged: true,
      changedFields: expect.arrayContaining(["answerKeyJson", "options"]),
    });
  });
});
