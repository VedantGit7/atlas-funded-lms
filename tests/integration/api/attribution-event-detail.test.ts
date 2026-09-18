import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { getAttributionEvent } from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * One attribution event by id.
 *
 * The point of this endpoint is the three columns the list omits. An event
 * attributed only by `utm_term` or `utm_content` read as unattributed
 * everywhere in the console before it existed, and the metadata the beacon
 * posted was written and then unreachable.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedEvent = {
  id?: string;
  eventType?: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
  metadata?: unknown;
  revenueCents?: number | null;
  currency?: string | null;
  withMembership?: boolean;
};

async function seed(tenant: IsolationTenantFixture, event: SeedEvent = {}): Promise<string> {
  const id = event.id ?? randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into sales_attribution_events (
        id, tenant_id, membership_id, event_type,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        revenue_cents, currency, metadata_json, occurred_at, created_at, updated_at
      )
      values (
        ${id}::uuid, ${tenant.tenantId}::uuid,
        ${event.withMembership === false ? null : tenant.membershipId}::uuid,
        ${event.eventType ?? "page_view"},
        ${event.source === undefined ? "google" : event.source},
        ${event.medium === undefined ? "cpc" : event.medium},
        ${event.campaign === undefined ? "launch" : event.campaign},
        ${event.term ?? null}, ${event.content ?? null},
        ${event.revenueCents ?? null}, ${event.currency ?? null},
        ${event.metadata === undefined ? null : JSON.stringify(event.metadata)}::jsonb,
        now() - interval '2 hours', now(), now()
      )
    `;
  });
  return id;
}

describeWithDb("attribution event detail (database)", () => {
  it("returns the three fields the list omits", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const id = await seed(tenantA, {
      term: "financial modelling",
      content: "banner-a",
      metadata: { landingPath: "/courses", referrer: "https://example.test" },
    });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionEvent(tx, ctx, id));

    expect(result.data.utmTerm).toBe("financial modelling");
    expect(result.data.utmContent).toBe("banner-a");
    expect(result.data.metadataJson).toEqual({
      landingPath: "/courses",
      referrer: "https://example.test",
    });
  });

  it("surfaces an event attributed only by utm_term", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Everywhere else in the console this reads as unattributed, because the
    // list DTO cannot see the field that attributes it.
    const id = await seed(tenantA, {
      source: null,
      medium: null,
      campaign: null,
      term: "brand-search",
    });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionEvent(tx, ctx, id));

    expect(result.data.utmSource).toBeNull();
    expect(result.data.utmTerm).toBe("brand-search");
  });

  it("distinguishes when the event happened from when it was recorded", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const id = await seed(tenantA);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionEvent(tx, ctx, id));

    // `occurredAt` is beacon-supplied and can be wrong; `createdAt` is the
    // server's own clock. A gap between them is the signal.
    expect(Date.parse(result.data.createdAt)).toBeGreaterThan(Date.parse(result.data.occurredAt));
  });

  it("returns null metadata rather than failing on a non-object blob", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // jsonb happily stores a bare scalar; the DTO expects a record.
    const id = await seed(tenantA, { metadata: "not-an-object" });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionEvent(tx, ctx, id));

    expect(result.data.metadataJson).toBeNull();
  });

  it("keeps a null membership null rather than inventing a learner", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const id = await seed(tenantA, { withMembership: false });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionEvent(tx, ctx, id));

    expect(result.data.membershipId).toBeNull();
  });

  it("404s for an id that does not exist", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) => getAttributionEvent(tx, ctx, randomUUID())),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s for another tenant's event rather than returning it", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreignId = await seed(tenantB);
    const ctx = tenantCtx(tenantA);

    // Identical to the not-found answer on purpose: a different response would
    // turn the id space into a way to probe for another academy's events.
    await expect(
      withTenantTx(ctx, async (tx) => getAttributionEvent(tx, ctx, foreignId)),
    ).rejects.toMatchObject({ status: 404 });
  });
});
