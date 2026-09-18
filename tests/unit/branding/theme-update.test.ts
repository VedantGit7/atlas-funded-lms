import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateTenantThemeRequestSchema } from "@atlas/domain-branding/schemas/theme";
import {
  mapTenantThemeToSemanticPayload,
  RESERVED_SEMANTIC_THEME_TOKEN_KEYS,
} from "@atlas/domain-branding/utils/theme-semantic-tokens";

const tenantId = "018f0000-0000-7000-8000-000000000001";

const { upsertTenantThemeDraftMock } = vi.hoisted(() => ({
  upsertTenantThemeDraftMock: vi.fn(),
}));

vi.mock("@atlas/domain-branding/repositories/theme.repository", () => ({
  upsertTenantThemeDraft: (...args: unknown[]) => upsertTenantThemeDraftMock(...args),
}));

import { updateTenantThemeDraft } from "@atlas/domain-branding/services/branding-update.service";

const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() } as unknown as Parameters<
  typeof updateTenantThemeDraft
>[0];

const validTokens = {
  primary: "#112233",
  accent: "#445566",
  header: "#778899",
  radius: "md" as const,
  modeDefault: "system" as const,
};

const draftRow = {
  tenant_id: tenantId,
  tokens_json: validTokens,
  status: "DRAFT",
  version: 0,
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
  published_at: null,
};

describe("theme update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertTenantThemeDraftMock.mockResolvedValue(draftRow);
  });

  it("validates hex colors", () => {
    expect(() =>
      UpdateTenantThemeRequestSchema.parse({
        tokens: {
          ...validTokens,
          primary: "112233",
        },
      }),
    ).toThrow();

    expect(() =>
      UpdateTenantThemeRequestSchema.parse({
        tokens: {
          ...validTokens,
          accent: "#gggggg",
        },
      }),
    ).toThrow();

    const parsed = UpdateTenantThemeRequestSchema.parse({
      tokens: {
        primary: "#abc",
        accent: "#AABBCC",
      },
    });

    expect(parsed.tokens.primary).toBe("#abc");
    expect(parsed.tokens.accent).toBe("#AABBCC");
  });

  it("rejects unsafe invalid tokens", () => {
    for (const reservedKey of RESERVED_SEMANTIC_THEME_TOKEN_KEYS) {
      expect(() =>
        UpdateTenantThemeRequestSchema.parse({
          tokens: {
            primary: "#112233",
            [reservedKey]: "#ff0000",
          },
        }),
      ).toThrow();
    }

    expect(() =>
      UpdateTenantThemeRequestSchema.parse({
        tokens: {
          primary: "#112233",
          javascript: "alert(1)",
        },
      }),
    ).toThrow();
  });

  it("maps to semantic token payload", () => {
    const parsed = UpdateTenantThemeRequestSchema.parse({
      tokens: validTokens,
    });

    expect(mapTenantThemeToSemanticPayload(parsed.tokens)).toEqual({
      color: {
        primary: "#112233",
        accent: "#445566",
        header: "#778899",
      },
      radius: "md",
      modeDefault: "system",
    });
  });

  it("does not override destructive, warning, or success semantics", () => {
    const parsed = UpdateTenantThemeRequestSchema.parse({
      tokens: {
        primary: "#112233",
      },
    });

    const payload = mapTenantThemeToSemanticPayload(parsed.tokens);

    for (const reservedKey of RESERVED_SEMANTIC_THEME_TOKEN_KEYS) {
      expect(payload).not.toHaveProperty(reservedKey);
      expect(payload.color).not.toHaveProperty(reservedKey);
    }
  });

  it("persists validated theme tokens as draft only", async () => {
    const result = await updateTenantThemeDraft(tx, { tokens: validTokens });

    expect(upsertTenantThemeDraftMock).toHaveBeenCalledWith(tx, {
      tokens: expect.objectContaining({
        primary: "#112233",
      }),
    });
    expect(result.data.status).toBe("DRAFT");
    expect(result.data.tokens).toEqual(validTokens);
  });

  it("rejects low-contrast theme tokens", async () => {
    await expect(
      updateTenantThemeDraft(tx, {
        tokens: {
          ...validTokens,
          primary: "#ffff00",
        },
      }),
    ).rejects.toThrow("THEME_CONTRAST_FAILED");

    expect(upsertTenantThemeDraftMock).not.toHaveBeenCalled();
  });
});
