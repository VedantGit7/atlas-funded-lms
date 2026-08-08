import { describe, expect, it } from "vitest";
import {
  LEARNER_CORE_EXPORT_COLUMNS,
  createCustomFieldExportBodySchema,
  customFieldExportHistoryItemSchema,
  customFieldExportsResponseSchema,
} from "@atlas/domain/reports/custom-field-exports.dto";

describe("custom field exports dto", () => {
  it("exposes learner core columns with email marked sensitive", () => {
    const email = LEARNER_CORE_EXPORT_COLUMNS.find((c) => c.key === "email");
    expect(email?.sensitive).toBe(true);
    expect(LEARNER_CORE_EXPORT_COLUMNS.length).toBeGreaterThanOrEqual(5);
  });

  it("parses create body defaults and empty value mode", () => {
    const parsed = createCustomFieldExportBodySchema.parse({
      columns: ["learner_name", "email", "cf:department"],
      format: "xlsx",
      emptyValueMode: "emdash",
    });
    expect(parsed.dataset).toBe("learner_roster");
    expect(parsed.emptyValueMode).toBe("emdash");
    expect(parsed.delivery).toBe("download");
    expect(parsed.scheduleEnabled).toBe(false);
  });

  it("requires segment for segment_members when validated by service, but accepts segmentId on body", () => {
    const parsed = createCustomFieldExportBodySchema.parse({
      dataset: "segment_members",
      columns: ["learner_name"],
      segmentId: "11111111-1111-4111-8111-111111111111",
      segmentName: "Experienced traders",
    });
    expect(parsed.dataset).toBe("segment_members");
    expect(parsed.segmentId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("rejects tenant fields on create body", () => {
    expect(() =>
      createCustomFieldExportBodySchema.parse({
        columns: ["email"],
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });

  it("validates history item and list payload shape", () => {
    const item = customFieldExportHistoryItemSchema.parse({
      id: "22222222-2222-4222-8222-222222222222",
      fileName: "custom-field-learners-2026-08-07.csv",
      format: "csv",
      dataset: "learner_roster",
      datasetLabel: "Learner roster",
      scopeLabel: "All learners",
      rowCount: 1240,
      sizeLabel: "~80KB",
      status: "SUCCEEDED",
      expired: false,
      expiresAt: "2026-08-14T00:00:00.000Z",
      createdAt: "2026-08-07T14:32:00.000Z",
      completedAt: "2026-08-07T14:32:10.000Z",
      errorCode: null,
      errorMessage: null,
      errorTrace: null,
      progressPercent: 100,
      downloadAvailable: true,
      columns: ["learner_name", "email"],
    });
    expect(item.downloadAvailable).toBe(true);

    const payload = customFieldExportsResponseSchema.parse({
      data: {
        history: [item],
        schedules: [],
        learnerColumns: LEARNER_CORE_EXPORT_COLUMNS.map((c) => ({
          key: c.key,
          label: c.label,
          sensitive: c.sensitive,
          defaultSelected: c.defaultSelected,
          group: c.group,
          typeBadge: c.typeBadge,
          fieldType: null,
        })),
        customFieldColumns: [],
        capabilities: {
          formats: ["csv", "xlsx", "json"],
          datasets: ["learner_roster", "field_coverage", "segment_members"],
          canSchedule: true,
          canEmailDelivery: true,
          canWebhookDelivery: true,
          note: "ok",
        },
      },
    });
    expect(payload.data.history).toHaveLength(1);
  });
});
