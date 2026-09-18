import { describe, expect, it } from "vitest";
import {
  assessConditionsCompleteness,
  buildConditionSummary,
  buildConditionsPredicate,
  countConditions,
  isConditionComplete,
  operatorsForFieldType,
} from "@atlas/domain/reports/custom-field-segments.conditions";
import {
  createCustomFieldSegmentBodySchema,
  customFieldSegmentListResponseSchema,
  customFieldSegmentViewResponseSchema,
  previewCustomFieldSegmentBodySchema,
  segmentConditionsTreeSchema,
  updateCustomFieldSegmentBodySchema,
} from "@atlas/domain/reports/custom-field-segments.dto";

const fieldTypes = new Map<string, string>([
  ["trading_experience", "select"],
  ["budget", "number"],
  ["certified", "boolean"],
  ["notes", "text"],
  ["onboarding_call", "date"],
]);

describe("custom field segments dto", () => {
  it("parses create body and rejects tenant fields", () => {
    const parsed = createCustomFieldSegmentBodySchema.parse({
      name: "Experienced traders",
      visibility: "shared",
      refreshMode: "live",
      conditions: {
        rootCombinator: "and",
        groups: [
          {
            id: "g1",
            combinator: "and",
            conditions: [
              {
                id: "c1",
                fieldSource: "custom",
                fieldKey: "trading_experience",
                operator: "is_any_of",
                value: ["3–5 years", "Over 5 years"],
              },
            ],
          },
        ],
      },
    });
    expect(parsed.name).toBe("Experienced traders");
    expect(parsed.conditions.groups).toHaveLength(1);

    expect(() =>
      createCustomFieldSegmentBodySchema.parse({
        name: "x",
        conditions: parsed.conditions,
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("requires at least one update field", () => {
    expect(() => updateCustomFieldSegmentBodySchema.parse({})).toThrow();
    const parsed = updateCustomFieldSegmentBodySchema.parse({ name: "Renamed" });
    expect(parsed.name).toBe("Renamed");
  });

  it("parses preview body defaults", () => {
    const tree = segmentConditionsTreeSchema.parse({
      rootCombinator: "or",
      groups: [
        {
          id: "g1",
          combinator: "and",
          conditions: [
            {
              id: "c1",
              fieldSource: "learner",
              fieldKey: "status",
              operator: "is",
              value: "ACTIVE",
            },
          ],
        },
      ],
    });
    const preview = previewCustomFieldSegmentBodySchema.parse({ conditions: tree });
    expect(preview.limit).toBe(6);
  });

  it("validates list response shape", () => {
    const parsed = customFieldSegmentListResponseSchema.parse({
      data: {
        items: [],
        summary: {
          segmentCount: 0,
          sharedCount: 0,
          privateCount: 0,
          learnersCovered: 0,
          largestSegmentName: null,
          largestSegmentCount: null,
          staleCount: 0,
          usedInMessages: 0,
        },
      },
    });
    expect(parsed.data.summary.segmentCount).toBe(0);
  });
});

describe("custom field segments conditions", () => {
  it("returns operators by field type", () => {
    expect(operatorsForFieldType("text")).toContain("contains");
    expect(operatorsForFieldType("number")).toContain("between");
    expect(operatorsForFieldType("boolean")).toContain("is_true");
    expect(operatorsForFieldType("select")).toContain("is_any_of");
    expect(operatorsForFieldType("date")).toContain("in_last_n_days");
  });

  it("marks empty operators complete without values", () => {
    expect(
      isConditionComplete(
        {
          id: "c1",
          fieldSource: "custom",
          fieldKey: "notes",
          operator: "is_empty",
          value: null,
        },
        fieldTypes,
      ),
    ).toBe(true);
  });

  it("requires values for between and any-of", () => {
    expect(
      isConditionComplete(
        {
          id: "c1",
          fieldSource: "custom",
          fieldKey: "budget",
          operator: "between",
          value: [100, 500],
        },
        fieldTypes,
      ),
    ).toBe(true);
    expect(
      isConditionComplete(
        {
          id: "c1",
          fieldSource: "custom",
          fieldKey: "budget",
          operator: "between",
          value: [100],
        },
        fieldTypes,
      ),
    ).toBe(false);
    expect(
      isConditionComplete(
        {
          id: "c1",
          fieldSource: "custom",
          fieldKey: "trading_experience",
          operator: "is_any_of",
          value: [],
        },
        fieldTypes,
      ),
    ).toBe(false);
  });

  it("builds parameterized predicates for complete trees", () => {
    const tree = segmentConditionsTreeSchema.parse({
      rootCombinator: "and",
      groups: [
        {
          id: "g1",
          combinator: "and",
          conditions: [
            {
              id: "c1",
              fieldSource: "learner",
              fieldKey: "status",
              operator: "is",
              value: "ACTIVE",
            },
            {
              id: "c2",
              fieldSource: "custom",
              fieldKey: "certified",
              operator: "is_true",
            },
          ],
        },
      ],
    });
    const completeness = assessConditionsCompleteness(tree, fieldTypes);
    expect(completeness.complete).toBe(true);
    const predicate = buildConditionsPredicate(tree, fieldTypes);
    if (predicate === null)
      throw new Error("expected buildConditionsPredicate to return a predicate");
    expect(predicate.sql).toContain("exists");
    expect(predicate.params).toContain("ACTIVE");
    expect(predicate.params).toContain("certified");
    expect(countConditions(tree)).toEqual({ conditionCount: 2, groupCount: 1 });
  });

  it("builds plain-English condition summary", () => {
    const tree = segmentConditionsTreeSchema.parse({
      rootCombinator: "and",
      groups: [
        {
          id: "g1",
          combinator: "and",
          conditions: [
            {
              id: "c1",
              fieldSource: "custom",
              fieldKey: "trading_experience",
              operator: "is_any_of",
              value: ["3–5 years", "Over 5 years"],
            },
            {
              id: "c2",
              fieldSource: "learner",
              fieldKey: "total_spent_cents",
              operator: "gt",
              value: 1000000,
            },
          ],
        },
      ],
    });
    const labels = new Map([
      ["custom:trading_experience", "Trading experience"],
      ["learner:total_spent_cents", "Total spent"],
    ]);
    const summary = buildConditionSummary(tree, labels);
    expect(summary).toContain("Trading experience is any of");
    expect(summary).toContain("Total spent above");
    expect(summary).toContain("AND");
  });

  it("returns incomplete message when a condition is unfinished", () => {
    const tree = segmentConditionsTreeSchema.parse({
      rootCombinator: "and",
      groups: [
        {
          id: "g1",
          combinator: "and",
          conditions: [
            {
              id: "c1",
              fieldSource: "custom",
              fieldKey: "notes",
              operator: "contains",
              value: "",
            },
          ],
        },
      ],
    });
    const completeness = assessConditionsCompleteness(tree, fieldTypes);
    expect(completeness.complete).toBe(false);
    expect(completeness.message).toMatch(/Finish the highlighted condition/i);
  });

  it("validates segment view analytics response", () => {
    const parsed = customFieldSegmentViewResponseSchema.parse({
      data: {
        segment: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Experienced traders",
          description: null,
          visibility: "shared",
          refreshMode: "live",
          conditions: {
            rootCombinator: "and",
            groups: [
              {
                id: "g1",
                combinator: "and",
                conditions: [
                  {
                    id: "c1",
                    fieldSource: "learner",
                    fieldKey: "status",
                    operator: "is",
                    value: "ACTIVE",
                  },
                ],
              },
            ],
          },
          conditionSummary: "Status is ACTIVE",
          conditionCount: 1,
          groupCount: 1,
          matchedCount: 0,
          previousMatchedCount: null,
          matchedDelta: null,
          matchedCountAt: null,
          isStale: false,
          createdByMembershipId: "22222222-2222-4222-8222-222222222222",
          createdByName: "Admin",
          dependencyCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        analytics: {
          matchedCount: 0,
          previousMatchedCount: null,
          matchedDelta: null,
          matchedCountAt: null,
          totalLearnerCount: 10,
          shareOfLearnersPct: 0,
          averageTotalSpentCents: null,
          currency: "INR",
          averageEnrollmentCount: null,
          activeLast30DaysCount: 0,
          activeLast30DaysPct: null,
          spendHistogram: [],
          tenantMedianSpentCents: null,
          tenantMedianBucketIndex: null,
          signupCohorts: [],
          fieldDivergences: [],
          similarFieldCount: 0,
          overlaps: [],
        },
        zeroMatch: true,
      },
    });
    expect(parsed.data.zeroMatch).toBe(true);
  });
});
