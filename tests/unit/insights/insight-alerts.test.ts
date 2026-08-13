import { describe, expect, it } from "vitest";
import {
  applyInsightAlertMutation,
  emptyInsightAlertState,
  evaluateInsightAlertRules,
  muteUntilIso,
  openAlertsFromBoard,
  projectInsightAlertBoard,
} from "../../../backend/apps/api/src/server/insights/insights-alerts";
import { insightAlertsResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

const NOW = new Date("2026-08-11T12:00:00.000Z");

describe("insight alerts board", () => {
  it("escalates failed payments to critical at the threshold", () => {
    const warning = evaluateInsightAlertRules(
      "dashboard",
      {
        failedPayments: 3,
        pendingTasks: 0,
        enrollmentsInRange: 10,
        previousEnrollmentsInRange: 10,
        paidRevenueInRange: 100,
        previousPaidRevenue: 100,
        upcomingLive: 0,
      },
      emptyInsightAlertState(),
    );
    const critical = evaluateInsightAlertRules(
      "dashboard",
      {
        failedPayments: 12,
        pendingTasks: 0,
        enrollmentsInRange: 10,
        previousEnrollmentsInRange: 10,
        paidRevenueInRange: 100,
        previousPaidRevenue: 100,
        upcomingLive: 0,
      },
      emptyInsightAlertState(),
    );

    expect(warning.find((row) => row.ruleId === "failed-payments")?.severity).toBe("warning");
    expect(critical.find((row) => row.ruleId === "failed-payments")?.severity).toBe("critical");
  });

  it("hides muted alerts from the open list", () => {
    const metrics = {
      failedPayments: 4,
      pendingTasks: 0,
      enrollmentsInRange: 8,
      previousEnrollmentsInRange: 8,
      paidRevenueInRange: 50,
      previousPaidRevenue: 50,
      upcomingLive: 0,
    };
    const projected = projectInsightAlertBoard({
      slug: "dashboard",
      metrics,
      state: emptyInsightAlertState(),
      now: NOW,
    });
    const muted = applyInsightAlertMutation({
      slug: "dashboard",
      state: projected.nextState,
      action: { type: "mute", ruleId: "failed-payments", muteUntil: muteUntilIso("7d", NOW) },
      now: NOW,
    });
    const board = projectInsightAlertBoard({ slug: "dashboard", metrics, state: muted, now: NOW });
    const open = openAlertsFromBoard(board.items);

    expect(open.some((row) => row.id === "failed-payments")).toBe(false);
    expect(board.items.find((row) => row.ruleId === "failed-payments")?.status).toBe("muted");
    expect(board.summary.muted).toBe(1);
  });

  it("keeps an operator-resolved alert resolved until the fingerprint changes", () => {
    const metrics = {
      failedPayments: 4,
      pendingTasks: 0,
      enrollmentsInRange: 8,
      previousEnrollmentsInRange: 8,
      paidRevenueInRange: 50,
      previousPaidRevenue: 50,
      upcomingLive: 0,
    };
    const projected = projectInsightAlertBoard({
      slug: "dashboard",
      metrics,
      state: emptyInsightAlertState(),
      now: NOW,
    });
    const resolved = applyInsightAlertMutation({
      slug: "dashboard",
      state: projected.nextState,
      action: { type: "resolve", ruleId: "failed-payments", resolvedByLabel: "Operator" },
      now: NOW,
    });
    const stillFiring = projectInsightAlertBoard({
      slug: "dashboard",
      metrics,
      state: resolved,
      now: NOW,
    });
    expect(stillFiring.items.find((row) => row.ruleId === "failed-payments")?.status).toBe(
      "resolved",
    );

    const worse = projectInsightAlertBoard({
      slug: "dashboard",
      metrics: { ...metrics, failedPayments: 14 },
      state: resolved,
      now: NOW,
    });
    expect(worse.items.find((row) => row.ruleId === "failed-payments")?.status).toBe("open");
  });

  it("auto-resolves when the condition clears", () => {
    const firing = projectInsightAlertBoard({
      slug: "dashboard",
      metrics: {
        failedPayments: 2,
        pendingTasks: 0,
        enrollmentsInRange: 8,
        previousEnrollmentsInRange: 8,
        paidRevenueInRange: 50,
        previousPaidRevenue: 50,
        upcomingLive: 0,
      },
      state: emptyInsightAlertState(),
      now: NOW,
    });
    const cleared = projectInsightAlertBoard({
      slug: "dashboard",
      metrics: {
        failedPayments: 0,
        pendingTasks: 0,
        enrollmentsInRange: 8,
        previousEnrollmentsInRange: 8,
        paidRevenueInRange: 50,
        previousPaidRevenue: 50,
        upcomingLive: 0,
      },
      state: firing.nextState,
      now: NOW,
    });
    const item = cleared.items.find((row) => row.ruleId === "failed-payments");
    expect(item?.status).toBe("resolved");
    expect(item?.resolvedByLabel).toBe("Automatically");
    expect(cleared.summary.open).toBe(0);
  });

  it("matches the alerts response schema", () => {
    const board = projectInsightAlertBoard({
      slug: "dashboard",
      metrics: {
        failedPayments: 2,
        pendingTasks: 12,
        enrollmentsInRange: 4,
        previousEnrollmentsInRange: 20,
        paidRevenueInRange: 10,
        previousPaidRevenue: 40,
        upcomingLive: 2,
      },
      state: emptyInsightAlertState(),
      now: NOW,
    });
    const parsed = insightAlertsResponseSchema.parse({
      data: {
        slug: "dashboard",
        title: "Dashboard",
        generatedAt: NOW.toISOString(),
        range: "12m",
        summary: board.summary,
        alerts: board.items,
        rules: board.rules,
      },
    });
    expect(parsed.data.summary.open).toBeGreaterThan(0);
    expect(parsed.data.rules.length).toBeGreaterThan(0);
    expect(parsed.data.rules[0]?.severities.length).toBeGreaterThan(0);
    expect(JSON.stringify(parsed.data)).not.toContain("—");
  });

  it("exposes school vitals rule readings without invented infra or school names", () => {
    const board = projectInsightAlertBoard({
      slug: "school-vitals",
      metrics: {
        learningActivity: 12,
        inactiveLearners: 412,
        dormantCourses: 18,
        openModeration: 2,
        assessmentsSubmitted: 40,
        passRate: 61.2,
      },
      state: emptyInsightAlertState(),
      now: NOW,
    });
    const titles = board.rules.map((rule) => rule.title);
    expect(titles).toEqual([
      "No learning activity",
      "Inactive learners",
      "Dormant courses",
      "Open moderation",
      "Low assessment pass rate",
    ]);
    expect(JSON.stringify(board)).not.toContain("Lincoln");
    expect(JSON.stringify(board)).not.toContain("CPU");
    expect(JSON.stringify(board)).not.toContain("Absenteeism");
    const inactive = board.rules.find((rule) => rule.id === "inactive-learners");
    expect(inactive?.currentValue).toBe(412);
    expect(inactive?.severities).toContain("warning");
    expect(board.items.find((item) => item.ruleId === "inactive-learners")?.href).toBe(
      "/admin/reports/resource-usage/inactive-learners",
    );
  });

  it("exposes the three sales insight rules without invented infra incidents", () => {
    const board = projectInsightAlertBoard({
      slug: "sales-insight",
      metrics: {
        failedPayments: 47,
        pendingOrders: 12,
        pipelineVisited: 100,
        conversionRate: 4,
      },
      state: emptyInsightAlertState(),
      now: NOW,
    });

    expect(board.rules.map((rule) => rule.id)).toEqual([
      "failed-payments",
      "pending-orders",
      "low-conversion",
    ]);
    expect(board.items.map((item) => item.ruleId).sort()).toEqual(
      ["failed-payments", "low-conversion", "pending-orders"].sort(),
    );
    expect(board.summary.critical).toBe(1);
    expect(board.summary.warning).toBe(1);
    expect(board.summary.info).toBe(1);

    const failed = board.rules.find((rule) => rule.id === "failed-payments");
    expect(failed?.severities).toEqual(["critical", "warning"]);
    expect(failed?.currentCaption).toBe("Current data would produce 1 critical alert.");

    const conversion = board.items.find((item) => item.ruleId === "low-conversion");
    expect(conversion?.href).toBe("/admin/insights/sales-insight/pipeline");
    expect(conversion?.message).toContain("below your 5% threshold");

    const serialized = JSON.stringify(board);
    expect(serialized).not.toContain("Stripe");
    expect(serialized).not.toContain("CPU");
    expect(serialized).not.toContain("Sarah");
    expect(serialized).not.toContain("#RL-");
    expect(serialized).not.toContain("—");
  });

  it("records warning-to-critical escalation on failed payments", () => {
    const warning = projectInsightAlertBoard({
      slug: "sales-insight",
      metrics: {
        failedPayments: 3,
        pendingOrders: 0,
        pipelineVisited: 0,
        conversionRate: 0,
      },
      state: emptyInsightAlertState(),
      now: NOW,
    });
    expect(warning.items.find((item) => item.ruleId === "failed-payments")?.severity).toBe(
      "warning",
    );

    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    const critical = projectInsightAlertBoard({
      slug: "sales-insight",
      metrics: {
        failedPayments: 40,
        pendingOrders: 0,
        pipelineVisited: 0,
        conversionRate: 0,
      },
      state: warning.nextState,
      now: later,
    });
    const open = critical.items.find((item) => item.ruleId === "failed-payments");
    expect(open?.severity).toBe("critical");
    expect(open?.openedSeverity).toBe("warning");
    expect(open?.peakSeverity).toBe("critical");

    const cleared = projectInsightAlertBoard({
      slug: "sales-insight",
      metrics: {
        failedPayments: 0,
        pendingOrders: 0,
        pipelineVisited: 0,
        conversionRate: 0,
      },
      state: critical.nextState,
      now: new Date(later.getTime() + 30 * 60 * 1000),
    });
    const resolved = cleared.items.find((item) => item.ruleId === "failed-payments");
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.openedSeverity).toBe("warning");
    expect(resolved?.peakSeverity).toBe("critical");
    expect(resolved?.resolvedByLabel).toBe("Automatically");
  });

  it("returns marketing rule captions for the rules tab", () => {
    const board = projectInsightAlertBoard({
      slug: "marketing-insight",
      metrics: {
        liveForms: 2,
        submissions30d: 0,
        liveCtas: 1,
        ctaViews: 40,
        ctaClickRate: 3,
      },
      state: emptyInsightAlertState(),
      now: NOW,
    });

    const formRule = board.rules.find((rule) => rule.id === "no-form-submissions-30d");
    const ctaRule = board.rules.find((rule) => rule.id === "low-cta-click-rate");

    expect(formRule?.currentCaption).toBe("Current data would produce 1 warning alert.");
    expect(ctaRule?.currentCaption).toBe("Current click-through rate is 3%.");
  });
});
