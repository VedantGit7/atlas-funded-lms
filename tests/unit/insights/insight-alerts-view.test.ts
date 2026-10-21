import { describe, expect, it } from "vitest";
import type { InsightAlertBoardItem } from "../../../frontend/apps/web/src/features/admin/insights/admin-insights-api";
import { insightAlertsArea } from "../../../frontend/apps/web/src/features/admin/insights/insight-alerts-areas";
import {
  alertsToCsv,
  escalated,
  formatDurationCompact,
} from "../../../frontend/apps/web/src/features/admin/insights/insight-alerts-kit";
import { genericAlertsArea } from "../../../frontend/apps/web/src/features/admin/insights/InsightAlertsView";

function item(overrides: Partial<InsightAlertBoardItem>): InsightAlertBoardItem {
  return {
    id: "sales-insight:failed-payments",
    ruleId: "failed-payments",
    severity: "warning",
    title: "Failed payments",
    message: "3 payments failed, one of them twice",
    href: null,
    source: "Sales Insight",
    status: "open",
    firstSeenAt: "2026-10-16T07:30:00.000Z",
    lastSeenAt: "2026-10-17T06:30:00.000Z",
    seenAt: null,
    mutedUntil: null,
    resolvedAt: null,
    resolvedByLabel: null,
    durationSeconds: null,
    openedSeverity: "warning",
    peakSeverity: "warning",
    ...overrides,
  };
}

describe("insight alerts view", () => {
  it("gives each section its own spec and the rest the generic one", () => {
    expect(insightAlertsArea("sales-insight").tiles).toContain("critical");
    expect(insightAlertsArea("marketing-insight").severities).toEqual(["warning"]);
    expect(insightAlertsArea("marketing-insight").groupOpenBy).toBe("rule");
    expect(insightAlertsArea("messenger-insight").severities).toEqual(["warning", "info"]);
    expect(insightAlertsArea("live-dashboard").rulesAside).toBeTypeOf("function");
    expect(insightAlertsArea("school-vitals")).toBe(genericAlertsArea);
    expect(insightAlertsArea("dashboard")).toBe(genericAlertsArea);
  });

  it("links the section boards to the board of every alert, but not that board to itself", () => {
    expect(insightAlertsArea("dashboard").linkAllAlerts).toBe(false);
    for (const slug of [
      "sales-insight",
      "live-dashboard",
      "marketing-insight",
      "messenger-insight",
    ]) {
      expect(insightAlertsArea(slug).linkAllAlerts).toBe(true);
    }
  });

  it("exports the rule id on section boards and the source on the boards that span sections", () => {
    const rows = [item({}), item({ id: "x", title: 'Quote, "pending"', status: "muted" })];
    const byRule = alertsToCsv(rows, "rule").split("\n");
    expect(byRule[0]).toBe("Alert,Severity,Rule,Status,First seen,Resolved,Muted until");
    expect(byRule[1]).toBe(
      "Failed payments,warning,failed-payments,open,2026-10-16T07:30:00.000Z,,",
    );
    expect(byRule[2]).toContain('"Quote, ""pending"""');
    expect(alertsToCsv(rows, "source").split("\n")[0]).toContain(",Source,");
    expect(alertsToCsv(rows, "source").split("\n")[1]).toContain(",Sales Insight,");
  });

  it("marks an alert escalated only when it climbed before it cleared", () => {
    expect(escalated(item({ openedSeverity: "warning", peakSeverity: "critical" }))).toBe(true);
    expect(escalated(item({ openedSeverity: "warning", peakSeverity: "warning" }))).toBe(false);
    expect(escalated(item({ openedSeverity: null, peakSeverity: "critical" }))).toBe(false);
  });

  it("formats how long an alert was open", () => {
    expect(formatDurationCompact(null)).toBe("-");
    expect(formatDurationCompact(42)).toBe("42s");
    expect(formatDurationCompact(125)).toBe("2m 05s");
    expect(formatDurationCompact(3 * 3600 + 4 * 60 + 9)).toBe("3h 04m");
  });
});
