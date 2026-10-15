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
import type { TenantTx } from "@atlas/db";

/**
 * `sales_attribution_events.membership_id` carries a composite
 * (tenant_id, membership_id) foreign key (migration 122). The public
 * attribution route runs as the system actor, and falling back to its
 * nil-UUID sentinel made every anonymous visit violate that key.
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

  it("keeps an explicit membership from the body", async () => {
    const ctx = systemServiceCtx({
      tenantId,
      requestId: "req_test",
      source: "sales.public_attribution",
    });

    await createAttributionEvent(tx, ctx, { eventType: "enrolled", membershipId: otherMemberId });

    expect(insertedMembershipId()).toBe(otherMemberId);
  });
});
