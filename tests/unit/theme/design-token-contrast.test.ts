import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Audit finding H17 — WCAG 2.1 AA contrast on the design tokens.
 *
 * The muted-text token measured **2.36:1** against `--fba-bg2` and accounted for
 * the large majority of 186 serious `color-contrast` violations across the login
 * page and the public landing — the two highest-traffic unauthenticated pages in
 * the product.
 *
 * This asserts the ratios against the token values as they are actually
 * declared in the CSS, so a future palette edit that reintroduces the failure
 * breaks here rather than in a browser suite that needs two dev servers, a
 * seeded database and real Chromium to run.
 *
 * It is deliberately not a substitute for `tests/browser/accessibility` — that
 * catches contrast produced by component styles rather than tokens, and
 * everything axe checks besides contrast. This catches the token-level cause,
 * which is where the violations came from and where they are cheapest to see.
 *
 * The audit measured the light `--fba-*` palette only. Extending the same
 * measurement to its dark counterpart, and to the `--atl-*` palette behind the
 * platform landing, found the identical defect in three more places.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");

/** WCAG 2.1 1.4.3 for normal-size text. These tokens carry helper text and placeholders. */
const AA_NORMAL = 4.5;

function channelToLinear(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Reads custom properties out of a CSS file, scoped to the block a selector
 * opens. Parsing the real stylesheet rather than restating the hexes here is the
 * point: a copy would keep passing after someone edited the CSS.
 */
function readTokens(relativePath: string, selector: string): Record<string, string> {
  const css = readFileSync(resolve(repoRoot, relativePath), "utf8");
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector ${selector} not found in ${relativePath}`);

  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  if (open === -1 || close === -1) throw new Error(`Malformed block for ${selector}`);

  const block = css.slice(open + 1, close);
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = match;
    if (name && value) tokens[name] = value.toLowerCase();
  }
  return tokens;
}

type Palette = {
  label: string;
  file: string;
  selector: string;
  /** Text tokens that must be legible on every surface token listed. */
  text: string[];
  surfaces: string[];
};

const PALETTES: Palette[] = [
  {
    label: ".fba-scope light",
    file: "frontend/apps/web/src/components/theme/fba-theme.css",
    selector: ".fba-scope {",
    text: ["--fba-tx", "--fba-tx2", "--fba-tx3"],
    surfaces: ["--fba-bg", "--fba-bg2", "--fba-surf"],
  },
  {
    label: ".fba-scope dark",
    file: "frontend/apps/web/src/components/theme/fba-theme.css",
    selector: ".dark .fba-scope {",
    text: ["--fba-tx", "--fba-tx2", "--fba-tx3"],
    surfaces: ["--fba-bg", "--fba-bg2", "--fba-surf"],
  },
  {
    label: ".atlas-landing light",
    file: "frontend/apps/web/src/features/public/components/atlas-landing/atlas-landing.css",
    selector: ".atlas-landing {",
    text: ["--atl-tx", "--atl-tx2", "--atl-tx3"],
    surfaces: ["--atl-bg", "--atl-bg2", "--atl-surf"],
  },
  {
    label: ".atlas-landing dark",
    file: "frontend/apps/web/src/features/public/components/atlas-landing/atlas-landing.css",
    selector: ".atlas-landing.atl-dark {",
    text: ["--atl-tx", "--atl-tx2", "--atl-tx3"],
    surfaces: ["--atl-bg", "--atl-bg2", "--atl-surf"],
  },
];

describe("design token contrast (H17)", () => {
  it.each(PALETTES)("$label clears WCAG AA on every surface", (palette) => {
    const tokens = readTokens(palette.file, palette.selector);

    // Guards the guard: an empty or partial parse would make every assertion
    // below vacuous, which is the failure mode this whole check exists to stop.
    for (const name of [...palette.text, ...palette.surfaces]) {
      expect(tokens[name], `${palette.label} ${name} parsed`).toMatch(/^#[0-9a-f]{6}$/);
    }

    for (const textToken of palette.text) {
      for (const surfaceToken of palette.surfaces) {
        const fg = tokens[textToken] as string;
        const bg = tokens[surfaceToken] as string;
        const measured = contrastRatio(fg, bg);
        expect(
          measured,
          `${palette.label}: ${textToken} (${fg}) on ${surfaceToken} (${bg}) = ${measured.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it("keeps the three text tiers visually distinct", () => {
    // Raising the muted tier to 4.5 is only half the fix. Done naively it lands
    // on top of the secondary tier -- tx2 measured 4.52 on --fba-bg2 -- and the
    // palette silently loses a level of hierarchy while passing the audit.
    const tokens = readTokens(
      "frontend/apps/web/src/components/theme/fba-theme.css",
      ".fba-scope {",
    );
    const bg = tokens["--fba-bg2"] as string;

    const primary = contrastRatio(tokens["--fba-tx"] as string, bg);
    const secondary = contrastRatio(tokens["--fba-tx2"] as string, bg);
    const muted = contrastRatio(tokens["--fba-tx3"] as string, bg);

    expect(primary).toBeGreaterThan(secondary * 1.5);
    expect(secondary).toBeGreaterThan(muted * 1.3);
  });

  it("holds shadcn muted text to AA on a muted panel", () => {
    // --muted-foreground on --muted is the ordinary case for helper text inside
    // a muted panel, and measured 4.35:1 -- passing against white, failing where
    // it is actually used.
    const tokens = readTokens("frontend/apps/web/src/app/globals.css", ":root {");
    const measured = contrastRatio(
      tokens["--muted-foreground"] as string,
      tokens["--muted"] as string,
    );
    expect(measured, `muted-foreground on muted = ${measured.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  // The cases above are a hand-written list, which only ever covers pairs
  // someone remembered to add. This one derives its pairs from the naming
  // convention instead, so a token introduced later is measured without anybody
  // deciding to measure it -- the difference between a check that passes and a
  // check that is true.
  it("holds every convention-paired token in every palette to AA", () => {
    const CSS_FILES = [
      "frontend/apps/web/src/app/globals.css",
      "frontend/apps/web/src/components/theme/fba-theme.css",
      "frontend/apps/web/src/features/public/components/atlas-landing/atlas-landing.css",
    ];

    /** Every `selector { ... }` block and the hex custom properties it sets. */
    function blocks(css: string): { selector: string; vars: Record<string, string> }[] {
      const out: { selector: string; vars: Record<string, string> }[] = [];
      const re = /(^|\})\s*([^{}@/][^{}]*?)\{([^{}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(css))) {
        const vars: Record<string, string> = {};
        for (const v of (m[3] as string).matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
          vars[v[1] as string] = (v[2] as string).toLowerCase();
        }
        if (Object.keys(vars).length > 0) {
          out.push({ selector: (m[2] as string).trim().replace(/\s+/g, " "), vars });
        }
      }
      return out;
    }

    /**
     * Pair a text token with the surface it is NAMED for, never with every
     * surface in the block. `--admin-on-primary` belongs on `--admin-primary`;
     * measuring it against `--admin-surface` invents a combination the design
     * never renders, and a sweep full of invented pairs gets ignored.
     */
    function pairsFor(vars: Record<string, string>): [string, string][] {
      const names = Object.keys(vars);
      const pairs: [string, string][] = [];
      for (const text of names) {
        // Material: --scope-on-thing sits on --scope-thing.
        const onMatch = text.match(/^(--[a-z0-9-]*?)on-(.+)$/);
        if (onMatch) {
          const scope = onMatch[1] as string;
          const thing = onMatch[2] as string;
          const direct = `${scope}${thing}`;
          if (vars[direct]) pairs.push([text, direct]);
          // on-surface is the body colour across every surface tier in the same
          // family. Text tokens are not surfaces, and an inverse- text token
          // belongs only on inverse- surfaces.
          if (thing === "surface") {
            const inverse = scope.includes("inverse");
            for (const cand of names) {
              if (cand === direct) continue;
              if (/(^|-)on-|-foreground$/.test(cand)) continue;
              if (!/surface(-(low|high|variant|lowest|container))?$/.test(cand)) continue;
              if (cand.includes("inverse") !== inverse) continue;
              pairs.push([text, cand]);
            }
          }
          continue;
        }
        // shadcn: --thing-foreground sits on --thing; --foreground on --background.
        const fgMatch = text.match(/^(--[a-z0-9-]+)-foreground$/);
        if (fgMatch) {
          const direct = fgMatch[1] as string;
          if (vars[direct]) pairs.push([text, direct]);
          continue;
        }
        if (text === "--foreground" && vars["--background"]) pairs.push([text, "--background"]);
      }
      return pairs;
    }

    const failures: string[] = [];
    let measured = 0;

    for (const relativePath of CSS_FILES) {
      const css = readFileSync(resolve(repoRoot, relativePath), "utf8");
      for (const { selector, vars } of blocks(css)) {
        for (const [text, surface] of pairsFor(vars)) {
          measured += 1;
          const value = contrastRatio(vars[text] as string, vars[surface] as string);
          if (value < AA_NORMAL) {
            failures.push(
              `${value.toFixed(2)}:1  ${text} ${vars[text]} on ${surface} ${vars[surface]}` +
                `  [${selector}] ${relativePath.split("/").pop()}`,
            );
          }
        }
      }
    }

    // Vacuity guard. Without it a regex that stops matching turns this into a
    // test that passes by measuring nothing, which is the failure mode the whole
    // programme kept running into.
    // 28 pairs across 6 blocks / 111 hex tokens at the time of writing. The
    // floor allows a token to be retired without churn but still trips to zero
    // if the block or declaration regex stops matching.
    expect(measured, "convention-derived pairs discovered").toBeGreaterThanOrEqual(24);
    expect(failures, `${failures.length} paired tokens below AA:\n${failures.join("\n")}`).toEqual(
      [],
    );
  });
});
