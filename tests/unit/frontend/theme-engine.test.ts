import { describe, expect, it } from "vitest";

import { resolveTenantLogoUrl } from "../../../frontend/packages/design-system/src/components/tenant-logo";
import { buildThemeCssVars } from "../../../frontend/packages/contracts/src/domain-branding/utils/theme-css-vars";
import { diffThemeTokens } from "../../../frontend/packages/contracts/src/domain-branding/utils/theme-diff";
import { validateThemeContrast } from "../../../frontend/packages/contracts/src/domain-branding/utils/theme-contrast";
import { THEME_PRESETS } from "../../../frontend/packages/contracts/src/domain-branding/utils/theme-presets";
import { mapTenantThemeToSemanticPayload } from "../../../frontend/packages/contracts/src/domain-branding/utils/theme-semantic-tokens";

describe("resolveTenantLogoUrl", () => {
  it("prefers explicit logoUrl", () => {
    expect(
      resolveTenantLogoUrl({
        logoUrl: "https://cdn.example/logo.svg",
        logoLightUrl: "https://cdn.example/light.svg",
        logoDarkUrl: "https://cdn.example/dark.svg",
        mode: "dark",
      }),
    ).toBe("https://cdn.example/logo.svg");
  });

  it("selects dark logo in dark mode with light fallback", () => {
    expect(
      resolveTenantLogoUrl({
        logoLightUrl: "https://cdn.example/light.svg",
        logoDarkUrl: null,
        mode: "dark",
      }),
    ).toBe("https://cdn.example/light.svg");
  });
});

describe("buildThemeCssVars", () => {
  it("maps semantic tenant colors to CSS variables", () => {
    const semantic = mapTenantThemeToSemanticPayload(THEME_PRESETS[0]!.tokens);
    expect(buildThemeCssVars(semantic)).toMatchObject({
      "--brand-primary": "#224466",
      "--tenant-background": "#ffffff",
      "--tenant-foreground": "#101010",
      "--radius": "0.5rem",
    });
  });
});

describe("diffThemeTokens", () => {
  it("lists changed token keys against published baseline", () => {
    const baseline = THEME_PRESETS[0]!.tokens;
    const draft = { ...baseline, primary: "#112233" };
    const diff = diffThemeTokens(baseline, draft);
    expect(diff).toEqual([
      {
        key: "primary",
        before: "#224466",
        after: "#112233",
      },
    ]);
  });
});

describe("validateThemeContrast", () => {
  it("flags low-contrast primary buttons", () => {
    const issues = validateThemeContrast({
      ...THEME_PRESETS[0]!.tokens,
      primary: "#ffff00",
      background: "#ffffff",
      foreground: "#101010",
    });
    expect(issues.some((issue) => issue.pair === "white on primary")).toBe(true);
  });
});
