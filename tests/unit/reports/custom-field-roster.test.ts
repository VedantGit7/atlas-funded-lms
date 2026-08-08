import { describe, expect, it } from "vitest";
import {
  CUSTOM_FIELD_ROSTER_BASE_COLUMNS,
  createCustomFieldGroupBodySchema,
  customFieldCatalogueQuerySchema,
  customFieldCatalogueResponseSchema,
  customFieldDetailParamsSchema,
  customFieldDetailQuerySchema,
  customFieldDetailResponseSchema,
  customFieldLearnerDetailResponseSchema,
  customFieldRosterListResponseSchema,
  customFieldRosterQuerySchema,
  exportCustomFieldRosterBodySchema,
  sendCustomFieldMessageBodySchema,
  updateCustomFieldLearnerValuesBodySchema,
} from "@atlas/domain/reports/custom-field-roster.dto";

describe("custom field roster dto", () => {
  it("parses roster query defaults", () => {
    const parsed = customFieldRosterQuerySchema.parse({ page: "2" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
    expect(parsed.sortBy).toBe("signed_up_at");
    expect(parsed.columns).toEqual([...CUSTOM_FIELD_ROSTER_BASE_COLUMNS]);
  });

  it("accepts base and dynamic custom field columns", () => {
    const parsed = customFieldRosterQuerySchema.parse({
      columns: "learner_name,cf:gender,email",
      sortBy: "total_spent_cents",
      sortDir: "asc",
    });
    expect(parsed.columns).toEqual(["learner_name", "cf:gender", "email"]);
    expect(parsed.sortBy).toBe("total_spent_cents");
  });

  it("falls back when columns invalid", () => {
    const parsed = customFieldRosterQuerySchema.parse({ columns: "nope" });
    expect(parsed.columns).toEqual([...CUSTOM_FIELD_ROSTER_BASE_COLUMNS]);
  });

  it("accepts export/message/group bodies and rejects tenant fields", () => {
    const exported = exportCustomFieldRosterBodySchema.parse({
      email: "a@example.com",
      minTotalSpentCents: 1000,
    });
    expect(exported.emailDownloadLink).toBe(true);

    const message = sendCustomFieldMessageBodySchema.parse({
      subject: "Hello",
      message: "Welcome",
    });
    expect(message.subject).toBe("Hello");

    const group = createCustomFieldGroupBodySchema.parse({
      title: "High spenders",
    });
    expect(group.title).toBe("High spenders");

    expect(() =>
      sendCustomFieldMessageBodySchema.parse({
        subject: "x",
        message: "y",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("requires coverage summary on roster list response", () => {
    const parsed = customFieldRosterListResponseSchema.parse({
      data: {
        items: [],
        pageInfo: {
          page: 1,
          pageSize: 25,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        columns: [...CUSTOM_FIELD_ROSTER_BASE_COLUMNS],
        fieldDefinitions: [],
        summary: {
          learnerCount: 0,
          activeLearnerCount: 0,
          inactiveLearnerCount: 0,
          customFieldCount: 0,
          averageCoveragePct: null,
          learnersWithAllFieldsFilled: 0,
          fieldsBelow40Coverage: 0,
        },
      },
    });
    expect(parsed.data.summary.customFieldCount).toBe(0);
    expect(parsed.data.summary.averageCoveragePct).toBeNull();
  });

  it("parses catalogue query defaults and response", () => {
    const query = customFieldCatalogueQuerySchema.parse({});
    expect(query.status).toBe("ALL");
    expect(query.coverage).toBe("any");
    expect(query.sortBy).toBe("coverage_asc");

    const response = customFieldCatalogueResponseSchema.parse({
      data: {
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            key: "trading_experience",
            label: "Trading experience",
            fieldType: "select",
            status: "ACTIVE",
            options: ["Under 1 year", "1-3 years"],
            learnerCount: 100,
            filledCount: 68,
            coveragePct: 68,
            distinctValueCount: 2,
            optionsUsedCount: 2,
            unusedOptions: [],
            mostCommonValue: "1-3 years",
            mostCommonSharePct: 41.2,
            lastUpdatedAt: "2024-01-15T12:00:00.000Z",
            createdAt: "2023-01-01T00:00:00.000Z",
          },
        ],
        summary: {
          fieldsDefined: 1,
          activeFieldCount: 1,
          archivedFieldCount: 0,
          averageCoveragePct: 68,
          fullyCoveredFieldCount: 0,
          fieldsBelow40Coverage: 0,
          neverUsedFieldCount: 0,
          learnerCount: 100,
        },
      },
    });
    expect(response.data.items[0]?.key).toBe("trading_experience");
    expect(response.data.summary.averageCoveragePct).toBe(68);
  });

  it("parses field detail params, query defaults, and select response shape", () => {
    expect(customFieldDetailParamsSchema.parse({ fieldKey: "trading_experience" }).fieldKey).toBe(
      "trading_experience",
    );
    expect(() => customFieldDetailParamsSchema.parse({ fieldKey: "Bad-Key" })).toThrow();

    const query = customFieldDetailQuerySchema.parse({ valueFilter: "missing", page: "2" });
    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);
    expect(query.valueFilter).toBe("missing");

    const response = customFieldDetailResponseSchema.parse({
      data: {
        field: {
          id: "11111111-1111-4111-8111-111111111111",
          key: "trading_experience",
          label: "Trading experience",
          fieldType: "select",
          status: "ACTIVE",
          options: ["1-3 years", "3-5 years"],
          createdAt: "2026-02-14T00:00:00.000Z",
        },
        summary: {
          learnerCount: 100,
          filledCount: 72,
          missingCount: 28,
          coveragePct: 72,
          distinctValueCount: 2,
          mostCommonValue: "1-3 years",
          mostCommonSharePct: 55,
          lastUpdatedAt: "2026-03-01T00:00:00.000Z",
        },
        neverUsed: false,
        select: {
          options: [
            { value: "1-3 years", count: 40, sharePct: 55.6, unused: false },
            { value: "3-5 years", count: 32, sharePct: 44.4, unused: false },
          ],
          orphaned: [],
          unusedDefinedCount: 0,
        },
        number: null,
        boolean: null,
        text: null,
        crossTab: {
          otherField: { key: "preferred_market", label: "Preferred market", options: ["Crypto"] },
          rowValues: ["1-3 years"],
          columnValues: ["Crypto"],
          cells: [[12]],
          rowTotals: [12],
          columnTotals: [12],
          grandTotal: 12,
          strongestAssociation: "Strongest overlap: “1-3 years” × “Crypto” (12 learners).",
        },
        compareFields: [
          { key: "preferred_market", label: "Preferred market", fieldType: "select" },
        ],
        learners: {
          items: [],
          pageInfo: {
            page: 1,
            pageSize: 10,
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      },
    });
    expect(response.data.select?.options).toHaveLength(2);
    expect(response.data.crossTab?.grandTotal).toBe(12);
  });

  it("parses learner field-values detail and update body", () => {
    const detail = customFieldLearnerDetailResponseSchema.parse({
      data: {
        learner: {
          membershipId: "22222222-2222-4222-8222-222222222222",
          learnerName: "Priya Raghunathan",
          email: "p.raghu@example.com",
          status: "ACTIVE",
          avatarUrl: null,
          enrollmentCount: 3,
          totalSpentCents: 2499800,
          currency: "INR",
          lastActiveAt: "2026-03-01T00:00:00.000Z",
          signedUpAt: "2026-03-14T00:00:00.000Z",
        },
        summary: {
          fieldCount: 11,
          filledCount: 8,
          missingCount: 3,
          completenessPct: 72.7,
        },
        fields: [
          {
            definitionId: "11111111-1111-4111-8111-111111111111",
            key: "trading_experience",
            label: "Trading experience",
            fieldType: "select",
            status: "ACTIVE",
            options: ["3-5 years"],
            value: "3-5 years",
            valueJson: "3-5 years",
            filled: true,
            updatedAt: "2026-03-14T00:00:00.000Z",
            updatedByName: "Priya Raghunathan",
            auditCaption: "Set by Priya Raghunathan",
          },
        ],
        history: [],
        zeroFieldsDefined: false,
        noValuesSet: false,
      },
    });
    expect(detail.data.summary.filledCount).toBe(8);

    const update = updateCustomFieldLearnerValuesBodySchema.parse({
      values: [
        {
          definitionId: "11111111-1111-4111-8111-111111111111",
          valueJson: "High",
        },
        {
          definitionId: "33333333-3333-4333-8333-333333333333",
          valueJson: null,
        },
      ],
    });
    expect(update.values).toHaveLength(2);
  });
});
