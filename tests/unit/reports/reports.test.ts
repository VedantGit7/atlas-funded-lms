import { describe, expect, it } from "vitest";
import {
  createCustomReportDefinitionBodySchema,
  createReportRunBodySchema,
  createReportScheduleBodySchema,
  reportListQuerySchema,
} from "@atlas/domain/reports/reports.dto";
import {
  filterDatasetByColumns,
  validateSelectedColumns,
} from "@atlas/domain/reports/reports.allowed-columns";
import {
  REPORT_GENERATE_REQUESTED_EVENT,
  REPORT_GENERATE_WORKER_DESTINATION,
  reportGenerateRequestedPayloadSchema,
} from "@atlas/domain/reports/reports.events";
import { renderReportCsv } from "@atlas/domain/reports/reports-export-runner";
import {
  SYSTEM_REPORT_DEFINITION_KEYS,
  SYSTEM_REPORT_DEFINITIONS,
  getSystemReportDefinition,
} from "@atlas/domain/reports/reports.registry";
import { REPORT_ROW_CAP } from "@atlas/domain/reports/reports.contract";

describe("reports registry", () => {
  it("includes all admin catalog slugs plus bonus packs", () => {
    const adminSlugs = [
      "enrollments",
      "active-devices",
      "payments",
      "progress-score",
      "batches",
      "polls",
      "sales-marketing",
      "custom-field",
      "zoom-insights",
      "live-class-attendance",
      "super-live-insights",
      "resource-usage",
      "exports",
    ];

    for (const slug of adminSlugs) {
      expect(SYSTEM_REPORT_DEFINITION_KEYS).toContain(slug);
      expect(getSystemReportDefinition(slug)?.datasetKey).toBe(slug);
    }

    expect(SYSTEM_REPORT_DEFINITION_KEYS).toContain("assessment-items");
    expect(SYSTEM_REPORT_DEFINITION_KEYS).toContain("certificates");
    expect(SYSTEM_REPORT_DEFINITION_KEYS).toContain("at-risk-roster");
    expect(SYSTEM_REPORT_DEFINITIONS.length).toBeGreaterThanOrEqual(16);
  });

  it("uses system scope for seeded definitions", () => {
    for (const definition of SYSTEM_REPORT_DEFINITIONS) {
      expect(definition.scope).toBe("system");
      expect(definition.defaultFormat).toBe("csv");
    }
  });
});

describe("reports dto validation", () => {
  it("parses report list query with allow-listed status", () => {
    expect(reportListQuerySchema.parse({ status: "QUEUED", limit: 10 }).status).toBe("QUEUED");
  });

  it("rejects client tenant fields on create run body", () => {
    expect(() =>
      createReportRunBodySchema.parse({
        definitionKey: "enrollments",
        tenant_id: "bad",
      }),
    ).toThrow();
  });

  it("accepts schedule body with cron and formats", () => {
    const body = createReportScheduleBodySchema.parse({
      definitionKey: "enrollments",
      cronExpression: "0 6 * * *",
      formats: ["csv", "xlsx"],
    });

    expect(body.formats).toEqual(["csv", "xlsx"]);
  });

  it("validates report worker payload schema version", () => {
    const payload = reportGenerateRequestedPayloadSchema.parse({
      reportRunId: "11111111-1111-4111-8111-111111111111",
      reportDefinitionKey: "enrollments",
      requestedAt: new Date().toISOString(),
      requestedByMembershipId: "22222222-2222-4222-8222-222222222222",
      format: "csv",
      schemaVersion: 1,
    });

    expect(payload.schemaVersion).toBe(1);
  });
});

describe("reports allowed columns", () => {
  it("validates selected columns against approved datasets", () => {
    const valid = validateSelectedColumns({
      datasetKey: "enrollments",
      columns: ["id", "status", "learner_name", "enrolled_type"],
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.columns).toEqual(["id", "status", "learner_name", "enrolled_type"]);
    }

    const invalidDataset = validateSelectedColumns({
      datasetKey: "unknown-dataset",
      columns: ["id"],
    });
    expect(invalidDataset.ok).toBe(false);

    const invalidColumn = validateSelectedColumns({
      datasetKey: "enrollments",
      columns: ["not_a_column"],
    });
    expect(invalidColumn.ok).toBe(false);

    const empty = validateSelectedColumns({
      datasetKey: "enrollments",
      columns: [],
    });
    expect(empty.ok).toBe(false);
  });

  it("filters datasets to selected columns", () => {
    const filtered = filterDatasetByColumns(
      {
        columns: ["id", "status", "course_title"],
        rows: [{ id: "1", status: "active", course_title: "Intro" }],
      },
      ["id", "course_title"],
    );

    expect(filtered.columns).toEqual(["id", "course_title"]);
    expect(filtered.rows[0]).toEqual({ id: "1", course_title: "Intro" });
  });
});

describe("custom report definition dto", () => {
  it("parses create custom definition body", () => {
    const body = createCustomReportDefinitionBodySchema.parse({
      title: "Enrollment subset",
      datasetKey: "enrollments",
      columns: ["id", "membership_id"],
    });

    expect(body.title).toBe("Enrollment subset");
    expect(body.columns).toEqual(["id", "membership_id"]);
  });

  it("rejects invalid custom definition columns", () => {
    expect(() =>
      createCustomReportDefinitionBodySchema.parse({
        title: "Bad report",
        datasetKey: "enrollments",
        columns: [],
      }),
    ).toThrow();
  });

  it("rejects client tenant fields on custom definition body", () => {
    expect(() =>
      createCustomReportDefinitionBodySchema.parse({
        title: "Bad report",
        datasetKey: "enrollments",
        columns: ["id"],
        tenant_id: "bad",
      }),
    ).toThrow();
  });
});

describe("reports export rendering", () => {
  it("renders csv with headers and escaped values", () => {
    const csv = renderReportCsv({
      columns: ["name", "note"],
      rows: [{ name: "Alice", note: 'said "hi"' }],
    });

    const text = new TextDecoder().decode(csv);
    expect(text).toContain("name,note");
    expect(text).toContain('"said ""hi"""');
  });

  it("uses approved worker constants", () => {
    expect(REPORT_GENERATE_REQUESTED_EVENT).toBe("report.generate_requested");
    expect(REPORT_GENERATE_WORKER_DESTINATION).toBe("reports.generate");
    expect(REPORT_ROW_CAP).toBe(10_000);
  });
});
