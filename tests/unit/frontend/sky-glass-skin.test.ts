import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TenantThemeTokensSchema } from "../../../frontend/packages/contracts/src/domain-branding/schemas/theme";
import { validateThemeContrast } from "../../../frontend/packages/contracts/src/domain-branding/utils/theme-contrast";
import { THEME_PRESETS } from "../../../frontend/packages/contracts/src/domain-branding/utils/theme-presets";
import { readThemeSkin } from "../../../frontend/apps/web/src/lib/server/tenant-theme-vars";

/**
 * The Sky Glass theme skin: a complete look an academy can pick in its theme,
 * built from a brand kit (November 2026). It restyles the existing palettes
 * from src/styles/skins/sky-glass.css when <html> carries data-skin.
 */
const css = readFileSync(
  resolve(import.meta.dirname, "../../../frontend/apps/web/src/styles/skins/sky-glass.css"),
  "utf8",
);

describe("the theme's skin token", () => {
  it("reads a theme saved before skins existed as classic", () => {
    const tokens = TenantThemeTokensSchema.parse({ primary: "#224466" });
    expect(tokens.skin).toBe("classic");
  });

  it("refuses a skin it doesn't know", () => {
    expect(TenantThemeTokensSchema.safeParse({ primary: "#224466", skin: "neon" }).success).toBe(
      false,
    );
  });

  it("is applied only when it is a known skin", () => {
    expect(readThemeSkin({ skin: "sky-glass" })).toBe("sky-glass");
    expect(readThemeSkin({ skin: "classic" })).toBe("classic");
    expect(readThemeSkin({ skin: "anything" })).toBe("classic");
    expect(readThemeSkin(null)).toBe("classic");
  });
});

describe("the Sky Glass preset", () => {
  const preset = THEME_PRESETS.find((entry) => entry.key === "sky-glass");

  it("selects the skin, light by default, under a name that advertises no academy", () => {
    expect(preset?.tokens).toMatchObject({ skin: "sky-glass", modeDefault: "light" });
    expect(preset?.label).toBe("Sky Glass");
  });

  it("passes the editor's contrast check, as every preset does", () => {
    for (const entry of THEME_PRESETS) {
      expect(validateThemeContrast(entry.tokens), entry.key).toEqual([]);
      expect(TenantThemeTokensSchema.parse(entry.tokens)).toEqual(entry.tokens);
    }
  });
});

describe("sky-glass.css", () => {
  it("styles nothing unless the skin is selected", () => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...withoutComments.matchAll(/(^|})\s*([^{}@]+)\{/g)]
      .map((match) => match[2]?.trim() ?? "")
      .filter((selector) => selector && !/^(from|to|\d+%)$/.test(selector));
    expect(selectors.length).toBeGreaterThan(10);
    for (const group of selectors) {
      for (const selector of group.split(",")) {
        expect(selector.trim(), group).toMatch(/^html\[data-skin="sky-glass"\]/);
      }
    }
  });

  // WCAG 2 relative luminance and contrast, for the text tokens the skin sets.
  const luminance = (hex: string) => {
    const channels = (hex.match(/[0-9a-f]{2}/gi) ?? []).map((part) => {
      const value = Number.parseInt(part, 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const [r = 0, g = 0, b = 0] = channels;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (high + 0.05) / (low + 0.05);
  };
  const block = (selectorStart: string) => {
    const start = css.indexOf(`${selectorStart}`);
    const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
    return Object.fromEntries(
      [...body.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
    ) as Record<string, string>;
  };

  it.each([
    [
      'html[data-skin="sky-glass"] .fba-scope {',
      "--fba-tx",
      ["--fba-bg", "--fba-bg2", "--fba-surf"],
    ],
    [
      'html[data-skin="sky-glass"] .fba-scope {',
      "--fba-tx3",
      ["--fba-bg", "--fba-bg2", "--fba-surf"],
    ],
    [
      'html[data-skin="sky-glass"] .fba-scope {',
      "--fba-ind-tx",
      ["--fba-bg", "--fba-surf", "--fba-ind-l"],
    ],
    ['html[data-skin="sky-glass"] .fba-scope {', "--fba-gld-tx", ["--fba-bg", "--fba-surf"]],
    [
      'html[data-skin="sky-glass"] .fba-scope.fba-dark',
      "--fba-tx3",
      ["--fba-bg", "--fba-bg2", "--fba-surf"],
    ],
    ['html[data-skin="sky-glass"] .fba-scope.fba-dark', "--fba-ind-tx", ["--fba-bg", "--fba-surf"]],
    [
      'html[data-skin="sky-glass"] .admin-theme {',
      "--admin-on-surface-variant",
      ["--admin-bg", "--admin-surface", "--admin-surface-high"],
    ],
    [
      'html[data-skin="sky-glass"].dark .admin-theme {',
      "--admin-on-surface-variant",
      ["--admin-bg", "--admin-surface", "--admin-surface-high"],
    ],
    [
      'html[data-skin="sky-glass"] .account-settings-theme,',
      "--acct-on-surface-variant",
      ["--acct-bg", "--acct-surface", "--acct-surface-high"],
    ],
    [
      'html[data-skin="sky-glass"].dark .account-settings-theme,',
      "--acct-on-surface-variant",
      ["--acct-bg", "--acct-surface", "--acct-surface-high"],
    ],
  ] as const)("%s %s is readable (WCAG AA 4.5:1)", (selector, text, backgrounds) => {
    const tokens = block(selector);
    const color = tokens[text];
    expect(color, text).toBeDefined();
    for (const background of backgrounds) {
      expect(tokens[background], background).toBeDefined();
      expect(contrast(color ?? "", tokens[background] ?? "")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ['html[data-skin="sky-glass"] .fba-scope {', "--fba-ind"],
    ['html[data-skin="sky-glass"] .admin-theme {', "--admin-primary"],
    ['html[data-skin="sky-glass"] .account-settings-theme,', "--acct-primary"],
  ] as const)("%s %s carries white button text (WCAG AA)", (selector, fill) => {
    const tokens = block(selector);
    expect(contrast("#ffffff", tokens[fill] ?? "")).toBeGreaterThanOrEqual(4.5);
  });
});
