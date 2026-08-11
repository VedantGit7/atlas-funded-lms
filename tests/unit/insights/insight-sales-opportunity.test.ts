import { describe, expect, it } from "vitest";
import {
  buildInsightSalesOpportunity,
  salesOpportunityToCsv,
  SALES_OPPORTUNITY_ALL_PAID_CAPTION,
  SALES_OPPORTUNITY_EMPTY_CAPTION,
} from "../../../backend/apps/api/src/server/insights/insights-sales-opportunity";
import { SALES_OPPORTUNITY_FOOTNOTE } from "../../../backend/apps/api/src/server/insights/insights-sales-insight";
import { insightSalesOpportunityResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const evidence = {
  paidProductCount: 12,
  trialExpiring7d: 218,
  trialLapsed: 84,
  freeActive30d: 412,
  freeDormant: 932,
};

describe("buildInsightSalesOpportunity", () => {
  it("keeps overlapping segments out of the mix and does not invent plan splits", () => {
    const board = buildInsightSalesOpportunity(
      {
        currency: "INR",
        revenueCents: 1113000000,
        paidEnrollmentCount: 3412,
        trialEnrollmentCount: 842,
        freeEnrollmentCount: 1344,
        offlineEnrollmentCount: 218,
        onlineEnrollmentCount: 5598,
      },
      evidence,
      "2026-08-11T12:00:00.000Z",
    );

    expect(board.title).toBe("Conversion opportunity");
    expect(board.pool).toBe(2186);
    expect(board.caveat).toBe(SALES_OPPORTUNITY_FOOTNOTE);
    expect(board.segments.map((row) => row.id)).toEqual([
      "paid",
      "trial",
      "free",
      "offline",
      "online",
    ]);
    expect(board.mix.map((row) => row.id)).toEqual(["paid", "trial", "free"]);
    expect(board.offlineMix.id).toBe("offline");
    expect(board.segments[0]?.secondaryHref).toBe("/admin/reports/payments");
    expect(board.segments[1]?.primaryHref).toBe("/admin/marketing/messenger/email/create");
    expect(JSON.stringify(board)).not.toContain("Annual");
    expect(JSON.stringify(board)).not.toContain("Refine Cohort");
    expect(JSON.stringify(board)).not.toContain("—");
    expect(insightSalesOpportunityResponseSchema.parse({ data: board }).data.pool).toBe(2186);
  });

  it("collapses trial and free when the pool is empty", () => {
    const board = buildInsightSalesOpportunity(
      {
        currency: "INR",
        revenueCents: 100000,
        paidEnrollmentCount: 3412,
        trialEnrollmentCount: 0,
        freeEnrollmentCount: 0,
        offlineEnrollmentCount: 218,
        onlineEnrollmentCount: 3412,
      },
      { paidProductCount: 8, trialExpiring7d: 0, trialLapsed: 0, freeActive30d: 0, freeDormant: 0 },
      "2026-08-11T12:00:00.000Z",
    );

    expect(board.allPaid).toBe(true);
    expect(board.caption).toBe(SALES_OPPORTUNITY_ALL_PAID_CAPTION);
    expect(board.segments.find((row) => row.id === "trial")?.collapsed).toBe(true);
    expect(board.segments.find((row) => row.id === "free")?.collapsed).toBe(true);
    expect(board.segments.find((row) => row.id === "paid")?.collapsed).toBe(false);
    expect(board.segments.find((row) => row.id === "offline")?.body).toContain(
      "Granted outside checkout",
    );
  });

  it("renders an empty board without an em dash", () => {
    const board = buildInsightSalesOpportunity(
      {
        currency: "INR",
        revenueCents: 0,
        paidEnrollmentCount: 0,
        trialEnrollmentCount: 0,
        freeEnrollmentCount: 0,
        offlineEnrollmentCount: 0,
        onlineEnrollmentCount: 0,
      },
      { paidProductCount: 0, trialExpiring7d: 0, trialLapsed: 0, freeActive30d: 0, freeDormant: 0 },
      "2026-08-11T12:00:00.000Z",
    );

    expect(board.empty).toBe(true);
    expect(board.caption).toBe(SALES_OPPORTUNITY_EMPTY_CAPTION);
    expect(salesOpportunityToCsv(board)).not.toContain("—");
  });
});
