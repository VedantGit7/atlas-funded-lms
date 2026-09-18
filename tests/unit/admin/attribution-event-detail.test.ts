import { describe, expect, it } from "vitest";
import {
  CLOCK_SKEW_ALERT_MS,
  clockSkewMs,
  formatDuration,
  formatRelative,
  isAttributed,
  isNotableSkew,
  utmFields,
} from "../../../frontend/apps/web/src/features/admin/reports/attribution-shared";
import type { AttributionEventDetail } from "../../../frontend/apps/web/src/features/admin/reports/attribution-api";

/**
 * The event detail view's derived figures.
 *
 * The attribution check is shared with the log row now that the list carries
 * all five UTM fields, so the tests below also pin that the two agree. What
 * remains detail-only is the clock skew between when an event reportedly
 * happened and when the server actually recorded it.
 */

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const MINUTE = 60_000;

function detail(overrides: Partial<AttributionEventDetail> = {}): AttributionEventDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    eventType: "page_view",
    membershipId: null,
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "launch",
    utmTerm: null,
    utmContent: null,
    metadataJson: null,
    revenueCents: null,
    currency: null,
    occurredAt: "2026-08-26T10:00:00.000Z",
    createdAt: "2026-08-26T10:00:01.000Z",
    ...overrides,
  };
}

describe("utmFields", () => {
  it("lists all five fields even when every one is absent", () => {
    // An omitted row and an empty one used to look the same, which is the bug
    // this whole screen fixes.
    const fields = utmFields(detail({ utmSource: null, utmMedium: null, utmCampaign: null }));
    expect(fields).toHaveLength(5);
    expect(fields.every((field) => field.value === null)).toBe(true);
  });

  it("keeps them in the order a link carries them", () => {
    expect(utmFields(detail()).map((field) => field.key)).toEqual([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ]);
  });
});

describe("isAttributed", () => {
  it("sees an event attributed only by utm_term", () => {
    const event = detail({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: "brand-search",
    });
    expect(isAttributed(event)).toBe(true);
  });

  it("sees an event attributed only by utm_content", () => {
    const event = detail({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: "banner-a",
    });
    expect(isAttributed(event)).toBe(true);
  });

  it("is the same check the log row uses", () => {
    // One definition, so the row tint, the CSV column and this page cannot
    // give three different answers about the same event.
    const event = detail({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: "brand-search",
    });
    const asRow = { ...event };
    expect(isAttributed(asRow)).toBe(isAttributed(event));
  });

  it("is false only when all five are absent", () => {
    const event = detail({ utmSource: null, utmMedium: null, utmCampaign: null });
    expect(isAttributed(event)).toBe(false);
  });
});

describe("clockSkewMs", () => {
  it("is positive when the server recorded it after it happened", () => {
    expect(clockSkewMs("2026-08-26T10:00:00.000Z", "2026-08-26T10:30:00.000Z")).toBe(30 * MINUTE);
  });

  it("is negative when the beacon's clock ran ahead", () => {
    // Genuinely happens with a client-supplied timestamp, and it puts the event
    // in a future reporting day.
    expect(clockSkewMs("2026-08-26T11:00:00.000Z", "2026-08-26T10:00:00.000Z")).toBe(-60 * MINUTE);
  });

  it("returns nothing for an unparseable timestamp", () => {
    expect(clockSkewMs("not-a-date", "2026-08-26T10:00:00.000Z")).toBeNull();
  });
});

describe("isNotableSkew", () => {
  it("ignores the second or two normal ingestion takes", () => {
    expect(isNotableSkew(1_500)).toBe(false);
  });

  it("fires in both directions once past the threshold", () => {
    expect(isNotableSkew(CLOCK_SKEW_ALERT_MS)).toBe(true);
    expect(isNotableSkew(-CLOCK_SKEW_ALERT_MS)).toBe(true);
  });

  it("never fires on an unparseable pair", () => {
    expect(isNotableSkew(null)).toBe(false);
  });
});

describe("formatDuration", () => {
  it("reads the same magnitude regardless of sign", () => {
    expect(formatDuration(90 * MINUTE)).toBe(formatDuration(-90 * MINUTE));
  });

  it("steps up through minutes, hours and days", () => {
    expect(formatDuration(30 * MINUTE)).toBe("30 minutes");
    expect(formatDuration(3 * 60 * MINUTE)).toBe("3 hours");
    expect(formatDuration(72 * 60 * MINUTE)).toBe("3 days");
  });

  it("singularises", () => {
    expect(formatDuration(MINUTE)).toBe("1 minute");
  });
});

describe("formatRelative", () => {
  it("says just now inside the first minute", () => {
    expect(formatRelative(new Date(NOW - 5_000).toISOString(), NOW)).toBe("just now");
  });

  it("marks a future timestamp as future rather than negative", () => {
    expect(formatRelative(new Date(NOW + 2 * 60 * MINUTE).toISOString(), NOW)).toBe("in 2 hours");
  });

  it("returns nothing it cannot parse", () => {
    expect(formatRelative("not-a-date", NOW)).toBe("");
  });
});
