import { describe, expect, it } from "vitest";
import {
  TRACKING_ALERT_MIN_EVENTS,
  attributedPercent,
  attributionEventsToCsv,
  dateInputToIso,
  formatRevenue,
  isAttributed,
  looksLikeBrokenTracking,
  sourceMediumLabel,
} from "../../../frontend/apps/web/src/features/admin/reports/attribution-shared";
import type { AttributionEvent } from "../../../frontend/apps/web/src/features/admin/reports/attribution-api";

/**
 * The attribution log's derived figures.
 *
 * The whole screen turns on one distinction — an event that captured no
 * campaign versus one that was never tracked — so every helper that decides it
 * is pinned here.
 */

function event(overrides: Partial<AttributionEvent> = {}): AttributionEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    eventType: "page_view",
    membershipId: null,
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "launch",
    utmTerm: null,
    utmContent: null,
    revenueCents: null,
    currency: null,
    occurredAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("isAttributed", () => {
  it("treats any single UTM field as attribution", () => {
    expect(isAttributed(event({ utmSource: null, utmMedium: null }))).toBe(true);
    expect(isAttributed(event({ utmSource: null, utmCampaign: null }))).toBe(true);
  });

  it("is false only when all five are absent", () => {
    expect(isAttributed(event({ utmSource: null, utmMedium: null, utmCampaign: null }))).toBe(
      false,
    );
  });

  it("sees an event attributed only by utm_term or utm_content", () => {
    // The list carries all five fields now, so the row agrees with the server
    // instead of tinting these as unattributed.
    const bare = { utmSource: null, utmMedium: null, utmCampaign: null };
    expect(isAttributed(event({ ...bare, utmTerm: "brand-search" }))).toBe(true);
    expect(isAttributed(event({ ...bare, utmContent: "banner-a" }))).toBe(true);
  });
});

describe("sourceMediumLabel", () => {
  it("marks a missing half without dropping the other", () => {
    // "google / " would read as a formatting bug; "(not set)" is a statement.
    expect(sourceMediumLabel(event({ utmMedium: null }))).toBe("google / (not set)");
  });
});

describe("formatRevenue", () => {
  it("keeps an event with no revenue distinct from one worth nothing", () => {
    // A page view has no amount at all. Rendering 0.00 would put it in the same
    // visual class as a refunded purchase.
    expect(formatRevenue(null, "USD")).toBe("—");
    expect(formatRevenue(0, "USD")).not.toBe("—");
  });

  it("survives an unrecognised currency code", () => {
    // A well-formed but unknown code is rendered by Intl rather than throwing;
    // what matters is that both the amount and the code survive.
    const known = formatRevenue(4900, "XYZ");
    expect(known).toContain("49.00");
    expect(known).toContain("XYZ");
  });

  it("survives a malformed currency code", () => {
    // A two-letter code makes Intl throw. A legacy import must not blank the
    // cell or take the row down with it.
    expect(formatRevenue(4900, "US")).toBe("49.00 US");
  });

  it("falls back to a bare amount when no currency was recorded", () => {
    expect(formatRevenue(4900, null)).toBe("49.00");
  });
});

describe("attributedPercent", () => {
  it("has no percentage for an empty log", () => {
    // 0% attributed reads as a tracking failure; an empty log is not one.
    expect(attributedPercent(0, 0)).toBeNull();
  });

  it("rounds to whole percentage points", () => {
    expect(attributedPercent(1, 3)).toBe(33);
    expect(attributedPercent(2, 3)).toBe(67);
  });
});

describe("looksLikeBrokenTracking", () => {
  it("stays quiet below the sample floor", () => {
    // Three untracked events out of four proves nothing, and an alert on it
    // trains the operator to ignore the alert.
    expect(looksLikeBrokenTracking(3, 4)).toBe(false);
    expect(
      looksLikeBrokenTracking(TRACKING_ALERT_MIN_EVENTS - 1, TRACKING_ALERT_MIN_EVENTS - 1),
    ).toBe(false);
  });

  it("fires when most of a meaningful sample carries nothing", () => {
    expect(looksLikeBrokenTracking(80, 100)).toBe(true);
  });

  it("does not fire on an even split", () => {
    // Half direct traffic is unremarkable for plenty of tenants.
    expect(looksLikeBrokenTracking(50, 100)).toBe(false);
  });

  it("never fires on an empty log", () => {
    expect(looksLikeBrokenTracking(0, 0)).toBe(false);
  });
});

describe("dateInputToIso", () => {
  it("returns nothing for an empty bound", () => {
    expect(dateInputToIso("", "start")).toBeUndefined();
    expect(dateInputToIso("   ", "end")).toBeUndefined();
  });

  it("covers the whole of the end day", () => {
    // An end bound at midnight would silently exclude everything that happened
    // on the day the operator selected.
    const iso = dateInputToIso("2026-08-20", "end");
    expect(iso).toBeDefined();
    expect(new Date(iso ?? "").getTime()).toBeGreaterThan(
      new Date(dateInputToIso("2026-08-20", "start") ?? "").getTime(),
    );
  });

  it("returns nothing for an unparseable date", () => {
    expect(dateInputToIso("not-a-date", "start")).toBeUndefined();
  });
});

describe("attributionEventsToCsv", () => {
  function rows(csv: string): string[] {
    return csv.split("\r\n");
  }

  it("leaves revenue blank rather than writing a zero", () => {
    const line = rows(attributionEventsToCsv([event()]))[1] ?? "";
    // A zero here would drag every average computed downstream.
    expect(line).toContain(",,");
    expect(line.endsWith(",yes")).toBe(true);
  });

  it("carries all five UTM fields", () => {
    const csv = attributionEventsToCsv([event({ utmTerm: "t", utmContent: "c" })]);
    expect(rows(csv)[0]).toContain("UTM term");
    expect(rows(csv)[0]).toContain("UTM content");
    expect(rows(csv)[1]).toContain(",t,c,");
  });

  it("marks an event attributed only by utm_term as attributed", () => {
    // This row exported as `no` before the list carried the field that
    // attributes it, while the summary above it counted the same event as yes.
    const csv = attributionEventsToCsv([
      event({ utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: "brand-search" }),
    ]);
    expect(rows(csv)[1]?.endsWith(",yes")).toBe(true);
  });

  it("records whether the event was attributed", () => {
    const csv = attributionEventsToCsv([
      event({ utmSource: null, utmMedium: null, utmCampaign: null }),
    ]);
    expect(rows(csv)[1]?.endsWith(",no")).toBe(true);
  });

  it("neutralises a formula in a UTM value", () => {
    // UTM values come from whoever built the link, and land in a spreadsheet an
    // administrator opens.
    const csv = attributionEventsToCsv([event({ utmCampaign: "=1+1" })]);
    expect(rows(csv)[1]).toContain("'=1+1");
  });

  it("writes a header for an empty log", () => {
    const csv = attributionEventsToCsv([]);
    expect(rows(csv)).toHaveLength(1);
    expect(rows(csv)[0]?.startsWith("Occurred at,")).toBe(true);
  });
});
