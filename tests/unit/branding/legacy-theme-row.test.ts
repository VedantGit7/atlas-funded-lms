import { describe, expect, it } from "vitest";
import { mapTheme } from "@atlas/domain-branding/services/branding-read.service";
import { TenantThemeViewSchema } from "@atlas/domain-branding/schemas/theme";

describe("legacy stored theme rows", () => {
  const legacyRow = {
    tenant_id: "3f1d9a4e-5c2b-4a7d-9f80-11c2b3d4e5f6",
    tokens_json: {
      primary: "#224466",
      accent: "#8899aa",
      header: "#112233",
      background: "#0F172A",
      foreground: "#F8FAFC",
      radius: "md",
      modeDefault: "system",
    },
    status: "PUBLISHED",
    version: 3,
    updated_at: new Date("2026-08-01T00:00:00.000Z"),
    published_at: new Date("2026-08-01T00:00:00.000Z"),
  } as never;

  it("still validates against the strict view schema after the fields were removed", () => {
    const mapped = mapTheme(legacyRow);
    expect(mapped.tokens).not.toHaveProperty("background");
    expect(mapped.tokens).not.toHaveProperty("foreground");
    expect(() => TenantThemeViewSchema.parse(mapped)).not.toThrow();
  });

  it("control: the raw row would fail, so the strip is doing the work", () => {
    const raw = {
      ...mapTheme(legacyRow),
      tokens: (legacyRow as never as { tokens_json: unknown }).tokens_json,
    };
    expect(() => TenantThemeViewSchema.parse(raw)).toThrow(/unrecognized_key/i);
  });
});
