import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPORT_SETTINGS,
  exportSettingsSchema,
  updateExportSettingsBodySchema,
} from "@atlas/domain/reports/export-settings.dto";
import { retentionCutoff, retentionLabel } from "@atlas/domain/reports/export-settings.repository";

describe("export settings helpers", () => {
  it("parses default settings and rejects tenant fields", () => {
    const parsed = exportSettingsSchema.parse(DEFAULT_EXPORT_SETTINGS);
    expect(parsed.fileRetentionValue).toBe(7);
    expect(parsed.runRecordRetention).toBe("2y");

    expect(() =>
      updateExportSettingsBodySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
        settings: DEFAULT_EXPORT_SETTINGS,
      }),
    ).toThrow();
  });

  it("labels retention and builds cutoffs", () => {
    expect(retentionLabel(7, "days")).toBe("7 days");
    expect(retentionLabel(1, "hours")).toBe("1 hour");
    const cutoff = retentionCutoff(7, "days");
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });
});
