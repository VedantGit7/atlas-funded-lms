import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_ACTOR_MEMBERSHIP_ID, systemServiceCtx } from "@atlas/core/actor/system-actor";
import type * as SalesMarketingRepositoryModule from "@atlas/domain/sales-marketing/sales-marketing.repository";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const memberId = "018f0000-0000-7000-8000-000000000020";
const otherMemberId = "018f0000-0000-7000-8000-000000000021";

const { mockInsertEvent } = vi.hoisted(() => ({ mockInsertEvent: vi.fn() }));

vi.mock("@atlas/domain/sales-marketing/sales-marketing.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof SalesMarketingRepositoryModule>();
  return {
    ...actual,
    salesMarketingRepository: {
      ...actual.salesMarketingRepository,
      insertEvent: (...args: unknown[]) => mockInsertEvent(...args),
    },
  };
});

import { createAttributionEvent } from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  PUBLIC_ATTRIBUTION_EVENT_TYPES,
  createPublicAttributionEventBodySchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { createAttributionEventMetadata } from "@atlas/domain/sales-marketing/sales-marketing.route-metadata";
import { can, createTenantResourceRef, type ResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { authorizationFactsQuery } from "../../helpers/authorization-facts";

/**
 * `sales_attribution_events.membership_id` carries a composite
 * (tenant_id, membership_id) foreign key (migration 122). The public
 * attribution route runs as the system actor, and falling back to its
 * nil-UUID sentinel made every anonymous visit violate that key.
 *
 * The event is always the caller's own: the browser can name neither the
 * member nor the revenue.
 */
describe("createAttributionEvent membership attribution", () => {
  const tx = {} as TenantTx;

  beforeEach(() => {
    mockInsertEvent.mockReset();
    mockInsertEvent.mockImplementation((_tx: unknown, args: { membershipId: string | null }) =>
      Promise.resolve({
        id: "018f0000-0000-7000-8000-000000000090",
        event_type: "visited",
        membership_id: args.membershipId,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_term: null,
        utm_content: null,
        revenue_cents: null,
        currency: null,
        occurred_at: new Date("2026-10-15T00:00:00.000Z"),
      }),
    );
  });

  function insertedMembershipId(): unknown {
    const args = mockInsertEvent.mock.calls[0]?.[1] as { membershipId?: unknown } | undefined;
    return args?.membershipId;
  }

  it("records an anonymous visit with no membership, never the system sentinel", async () => {
    const ctx = systemServiceCtx({
      tenantId,
      requestId: "req_test",
      source: "sales.public_attribution",
    });

    await createAttributionEvent(tx, ctx, { eventType: "visited" });

    expect(insertedMembershipId()).toBeNull();
    expect(insertedMembershipId()).not.toBe(SYSTEM_ACTOR_MEMBERSHIP_ID);
  });

  it("attributes a signed-in member's event to that member", async () => {
    await createAttributionEvent(
      tx,
      { tenantId, actorMembershipId: memberId, requestId: "req_test" },
      { eventType: "visited" },
    );

    expect(insertedMembershipId()).toBe(memberId);
  });

  it("refuses a membership chosen by the body, anonymous or signed in", async () => {
    const anonymous = systemServiceCtx({
      tenantId,
      requestId: "req_test",
      source: "sales.public_attribution",
    });
    const member = { tenantId, actorMembershipId: memberId, requestId: "req_test" };

    for (const ctx of [anonymous, member]) {
      await expect(
        createAttributionEvent(tx, ctx, { eventType: "enrolled", membershipId: otherMemberId }),
      ).rejects.toThrow();
    }
    expect(mockInsertEvent).not.toHaveBeenCalled();
  });

  it("never records revenue sent by the browser", async () => {
    await expect(
      createAttributionEvent(
        tx,
        { tenantId, actorMembershipId: memberId, requestId: "req_test" },
        { eventType: "enrolled", revenueCents: 999_999, currency: "INR" },
      ),
    ).rejects.toThrow();
    expect(mockInsertEvent).not.toHaveBeenCalled();

    await createAttributionEvent(
      tx,
      { tenantId, actorMembershipId: memberId, requestId: "req_test" },
      { eventType: "enrolled" },
    );
    const args = mockInsertEvent.mock.calls[0]?.[1] as {
      revenueCents?: unknown;
      currency?: unknown;
    };
    expect(args.revenueCents).toBeNull();
    expect(args.currency).toBeNull();
  });
});

describe("public attribution body", () => {
  it.each(PUBLIC_ATTRIBUTION_EVENT_TYPES)(
    "accepts the %s event with campaign fields",
    (eventType) => {
      expect(
        createPublicAttributionEventBodySchema.parse({ eventType, utmSource: "newsletter" }),
      ).toEqual({ eventType, utmSource: "newsletter" });
    },
  );

  it.each([
    ["a membership", { membershipId: otherMemberId }],
    ["revenue", { revenueCents: 100, currency: "INR" }],
    ["a backdated time", { occurredAt: "2020-01-01T00:00:00.000Z" }],
    ["metadata", { metadataJson: { any: "thing" } }],
  ])("refuses %s from an anonymous visitor", (_label, extra) => {
    expect(
      createPublicAttributionEventBodySchema.safeParse({ eventType: "visited", ...extra }).success,
    ).toBe(false);
  });

  it("refuses event types the public site does not send", () => {
    expect(
      createPublicAttributionEventBodySchema.safeParse({ eventType: "purchased" }).success,
    ).toBe(false);
  });

  it("is accepted by the service's own parse", async () => {
    mockInsertEvent.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000091",
      event_type: "visited",
      membership_id: null,
      utm_source: "newsletter",
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      revenue_cents: null,
      currency: null,
      occurred_at: new Date("2026-10-15T00:00:00.000Z"),
    });
    const input = createPublicAttributionEventBodySchema.parse({
      eventType: "visited",
      utmSource: "newsletter",
    });

    await expect(
      createAttributionEvent(
        {} as TenantTx,
        systemServiceCtx({ tenantId, requestId: "req_test", source: "sales.public_attribution" }),
        input,
      ),
    ).resolves.toBeDefined();
  });
});

describe("signed-in attribution route", () => {
  function learnerDecision(resource: ResourceRef) {
    return can({
      tx: {
        $queryRaw: authorizationFactsQuery(
          [{ key: "profile.update" }],
          [],
          [{ role_key: "learner", bypasses_resource_predicates: false }],
        ),
      },
      actor: { tenantId, membershipId: memberId },
      permission: createAttributionEventMetadata.permission,
      resource,
      ctx: { tenantId, requestId: "req_test" },
    });
  }

  it("lets a learner post events about themselves", async () => {
    const ref = await createAttributionEventMetadata.resourceLoader({
      ctx: { tenantId, actorMembershipId: memberId },
    } as never);

    expect(ref.ownerMembershipId).toBe(memberId);
    expect((await learnerDecision(ref)).allowed).toBe(true);
  });

  it("refused learners while the resource named no owner", async () => {
    const decision = await learnerDecision(
      createTenantResourceRef({ type: "membership", id: memberId, tenantId }),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });
});
