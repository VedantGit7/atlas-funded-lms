import { describe, expect, it } from "vitest";
import { exportBuilderPreviewBodySchema } from "@atlas/domain/reports/export-builder.dto";

describe("export builder preview dto", () => {
  it("parses defaults and rejects tenant fields", () => {
    const parsed = exportBuilderPreviewBodySchema.parse({
      definitionKey: "payments",
      params: { status: "paid" },
      columns: ["id", "amount"],
      format: "csv",
    });
    expect(parsed.sampleLimit).toBe(10);
    expect(parsed.definitionKey).toBe("payments");
    expect(parsed.columns).toEqual(["id", "amount"]);

    expect(() =>
      exportBuilderPreviewBodySchema.parse({
        definitionKey: "payments",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
