import { describe, expect, it } from "vitest";
import {
  ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS,
  ATTRIBUTION_EXPORT_COLUMNS,
  attributionEventsToCsv,
  attributionExportFilename,
  type AttributionExportColumnKey,
} from "../../../frontend/apps/web/src/features/admin/reports/attribution-shared";
import type { AttributionEvent } from "../../../frontend/apps/web/src/features/admin/reports/attribution-api";

/**
 * The attribution export's column selection and filename.
 *
 * Both are places where a plausible-looking bug is invisible in the UI and only
 * shows up in a spreadsheet someone builds a campaign decision on: a reordered
 * column, a revenue figure that will not sum, a second file that silently
 * overwrites the first.
 */

function event(overrides: Partial<AttributionEvent> = {}): AttributionEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    eventType: "purchase",
    membershipId: null,
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "launch",
    utmTerm: null,
    utmContent: null,
    revenueCents: 4900,
    currency: "USD",
    occurredAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

function rows(csv: string): string[] {
  return csv.split("\r\n");
}

describe("attributionEventsToCsv column selection", () => {
  it("writes every column when none are named", () => {
    const [header] = rows(attributionEventsToCsv([event()]));
    expect(header).toBe(ATTRIBUTION_EXPORT_COLUMNS.map((column) => column.label).join(","));
  });

  it("writes only the chosen columns", () => {
    const csv = attributionEventsToCsv([event()], ["eventType", "utmSource", "currency"]);
    const [header, first] = rows(csv);
    expect(header).toBe("Event type,UTM source,Currency");
    expect(first).toBe("purchase,google,USD");
  });

  it("keeps file order fixed regardless of how the columns were named", () => {
    // Selecting is not reordering — a file whose columns follow click order
    // breaks every downstream import that maps by position.
    const forwards = attributionEventsToCsv([event()], ["eventType", "utmSource", "currency"]);
    const backwards = attributionEventsToCsv([event()], ["currency", "utmSource", "eventType"]);
    expect(backwards).toBe(forwards);
  });

  it("falls back to every column rather than writing an empty file", () => {
    const csv = attributionEventsToCsv([event()], []);
    expect(rows(csv)[0]).toBe(ATTRIBUTION_EXPORT_COLUMNS.map((column) => column.label).join(","));
  });

  it("writes revenue as a bare summable number", () => {
    const csv = attributionEventsToCsv([event({ revenueCents: 5 })], ["revenue"]);
    expect(rows(csv)[1]).toBe("0.05");
  });

  it("leaves an event with no revenue blank rather than zero", () => {
    // A zero would drag every average computed downstream.
    const csv = attributionEventsToCsv([event({ revenueCents: null })], ["revenue"]);
    expect(rows(csv)[1]).toBe("");
  });

  it("computes the attributed column over all five UTM fields", () => {
    const bare = { utmSource: null, utmMedium: null, utmCampaign: null };
    const byTerm = attributionEventsToCsv(
      [event({ ...bare, utmTerm: "brand-search" })],
      ["attributed"],
    );
    const none = attributionEventsToCsv([event(bare)], ["attributed"]);
    expect(rows(byTerm)[1]).toBe("yes");
    expect(rows(none)[1]).toBe("no");
  });

  it("neutralises a formula in a UTM value", () => {
    // UTM values come from whoever built the link, and land in a spreadsheet an
    // administrator opens.
    const csv = attributionEventsToCsv([event({ utmCampaign: "=1+1" })], ["utmCampaign"]);
    expect(rows(csv)[1]).toContain("'=1+1");
  });

  it("names every column exactly once", () => {
    const keys = ATTRIBUTION_EXPORT_COLUMNS.map((column) => column.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS).toEqual(keys);
  });

  it("produces one cell per selected key", () => {
    for (const key of ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS as AttributionExportColumnKey[]) {
      expect(rows(attributionEventsToCsv([event()], [key]))).toHaveLength(2);
    }
  });

  it("writes a header even when there are no events", () => {
    expect(attributionEventsToCsv([], ["eventType"])).toBe("Event type");
  });
});

describe("attributionExportFilename", () => {
  it("names an unfiltered export by date alone", () => {
    expect(attributionExportFilename({})).toMatch(/^attribution-events-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("distinguishes two exports taken the same day under different filters", () => {
    // Two files with the same name in one downloads folder are
    // indistinguishable at the point it matters.
    const untracked = attributionExportFilename({ attribution: "none" });
    const tracked = attributionExportFilename({ attribution: "attributed" });
    expect(untracked).not.toBe(tracked);
    expect(untracked).toContain("none");
  });

  it("treats 'any' as no filter at all", () => {
    expect(attributionExportFilename({ attribution: "any" })).toBe(attributionExportFilename({}));
  });

  it("keeps operator-typed text out of the path", () => {
    const name = attributionExportFilename({ q: "utm_source=google&x=1" });
    expect(name).toContain("search");
    expect(name).not.toContain("google");
  });

  it("slugifies an event type rather than embedding it raw", () => {
    const name = attributionExportFilename({ eventType: "Checkout Started" });
    expect(name).toContain("checkout-started");
    expect(name).not.toContain(" ");
  });
});
