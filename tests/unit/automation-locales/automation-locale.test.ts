import { buildAutomationActionIdempotencyKey } from "../../../backend/apps/api/src/server/automation/automation.keys";
import { describe, expect, it } from "vitest";
import { buildAutomationRunIdempotencyKey } from "../../../backend/apps/api/src/server/automation/automation.dto";
import {
  assertAutomationTriggerEventType,
  automationActionSchema,
  evaluateAutomationCondition,
  parseAutomationAction,
  parseAutomationCondition,
} from "../../../backend/apps/api/src/server/automation/automation.registry";
import { isAutomationCycleEvent } from "../../../backend/apps/api/src/server/automation/automation.events";
import {
  localeResourceValueSchema,
  upsertLocaleResourcesBodySchema,
} from "../../../backend/apps/api/src/server/locales/locale.dto";

describe("automation trigger validation", () => {
  it("accepts approved non-cycle triggers", () => {
    expect(assertAutomationTriggerEventType("certificate.issued")).toBe("certificate.issued");
  });

  it("rejects cycle events as triggers", () => {
    expect(() => assertAutomationTriggerEventType("automation.run.completed")).toThrow();
  });
});

describe("automation action registry rejection", () => {
  it("rejects unknown action types", () => {
    expect(() =>
      parseAutomationAction({
        type: "webhook.call",
        url: "https://example.com",
      }),
    ).toThrow();
  });

  it("rejects remote url fields in registered shape", () => {
    expect(() =>
      automationActionSchema.parse({
        type: "notification.request",
        templateKey: "certificate.issued",
        url: "https://example.com",
      }),
    ).toThrow();
  });
});

describe("automation condition evaluation", () => {
  it("passes assessment threshold when score is high enough", () => {
    const met = evaluateAutomationCondition({
      triggerEventType: "assessment.graded",
      condition: parseAutomationCondition({ type: "assessmentPassed", minScorePercent: 70 }),
      payload: {
        assessmentId: "00000000-0000-4000-8000-000000000001",
        attemptId: "00000000-0000-4000-8000-000000000002",
        gradingTaskId: "00000000-0000-4000-8000-000000000003",
        itemId: null,
        learnerMembershipId: "00000000-0000-4000-8000-000000000004",
        graderMembershipId: "00000000-0000-4000-8000-000000000005",
        score: 8,
        possiblePoints: 10,
        attemptState: "GRADED",
        requestId: "req_test",
      },
    });
    expect(met).toBe(true);
  });
});

describe("automation idempotency determinism", () => {
  it("builds stable run and action keys", () => {
    const runKey = buildAutomationRunIdempotencyKey({
      automationRuleId: "rule-a",
      sourceEventId: "event-a",
    });
    expect(runKey).toBe("rule-a:event-a");
    expect(
      buildAutomationActionIdempotencyKey({
        automationRuleId: "rule-a",
        sourceEventId: "event-a",
        actionType: "notification.request",
      }),
    ).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("automation cycle guard", () => {
  it("marks cycle events consistently", () => {
    expect(isAutomationCycleEvent("automation.rule.created")).toBe(true);
    expect(isAutomationCycleEvent("locale.updated")).toBe(true);
    expect(isAutomationCycleEvent("certificate.issued")).toBe(false);
  });
});

describe("locale sanitizer and duplicate validation", () => {
  it("strips unsafe locale strings", () => {
    expect(localeResourceValueSchema.parse("<b>Hello</b>")).toBe("Hello");
    expect(localeResourceValueSchema.parse("  spaced  ")).toBe("spaced");
  });

  it("rejects duplicate keys in upsert body", () => {
    expect(() =>
      upsertLocaleResourcesBodySchema.parse({
        resources: [
          { key: "welcome.title", value: "Hello" },
          { key: "welcome.title", value: "Hi" },
        ],
      }),
    ).toThrow();
  });
});
