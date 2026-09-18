import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Dark mode across the web app.
 *
 * Dark mode is global -- ThemeInitScript puts `.dark` on <html> from the user's
 * choice, the tenant default or the OS -- so every surface flips. An audit found
 * that 156 same-element text/background pairs dropped below WCAG AA in dark
 * mode. Most were not individual screens but tokens: status fills
 * (--admin-danger and friends) turned pastel while their text stayed white,
 * --admin-primary stayed #5b5ef0 while being text on dark surfaces in ~1,700
 * places, and brand accents did the same. On top of that, 470 palette
 * utilities and ~170 uncoloured borders were coded for a white page only.
 *
 * This resolves every className string literal's background and text colour
 * the way the browser would in dark mode -- from globals.css and the scoped
 * theme files, and from Tailwind's own palette -- and fails on any pair under
 * 4.5:1. It also rejects palette colours with no `dark:` counterpart outside
 * the surfaces that are deliberately fixed (listed below, with reasons).
 *
 * Literals are checked one at a time: the branches of a ternary are separate
 * strings, and flattening them into one produced false pairings.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const webSrc = join(repoRoot, "frontend", "apps", "web", "src");
const designSystemSrc = join(repoRoot, "frontend", "packages", "design-system", "src");

// ---------------------------------------------------------------- colour maths

type Rgba = { r: number; g: number; b: number; a: number };

function oklchToRgba(lightness: number, chroma: number, hue: number): Rgba {
  const l0 = lightness > 1 ? lightness / 100 : lightness;
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (l0 + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (l0 - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (l0 - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const encode = (x: number) => {
    const c = Math.max(0, Math.min(1, x));
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  };
  return {
    r: encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: 1,
  };
}

function luminance({ r, g, b }: Rgba): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(x: Rgba, y: Rgba): number {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function over(top: Rgba, under: Rgba): Rgba {
  return {
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  };
}

// ---------------------------------------------------------------- CSS tokens

function files(dir: string, extension: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : files(path, extension);
    return entry.name.endsWith(extension) && !entry.name.includes(".test.") ? [path] : [];
  });
}

const palette = new Map<string, string>();
for (const match of readFileSync(
  join(repoRoot, "frontend", "apps", "web", "node_modules", "tailwindcss", "theme.css"),
  "utf8",
).matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
  palette.set(match[1] ?? "", (match[2] ?? "").trim());
}

const scopes = new Map<string, Map<string, string>>();
for (const file of files(webSrc, ".css")) {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (block[1] ?? "").split(";").pop()?.split(",") ?? [];
    for (const raw of selectors) {
      const selector = raw.trim();
      const vars = scopes.get(selector) ?? new Map<string, string>();
      for (const decl of (block[2] ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        vars.set(decl[1] ?? "", (decl[2] ?? "").trim());
      }
      scopes.set(selector, vars);
    }
  }
}
const themeInline = new Map<string, string>();
for (const [selector, vars] of scopes) {
  if (selector.startsWith("@theme")) for (const [k, v] of vars) themeInline.set(k, v);
}

function scopeChain(variable: string, dark: boolean): string[] {
  const family = variable.startsWith("--admin-")
    ? ".admin-theme"
    : variable.startsWith("--fba-")
      ? ".fba-scope"
      : variable.startsWith("--atl-")
        ? ".atlas-landing"
        : null;
  const chain: string[] = [];
  if (family) {
    if (dark) chain.push(`.dark ${family}`, `${family}.atl-dark`);
    chain.push(family);
  }
  if (dark) chain.push(".dark");
  chain.push(":root");
  return chain;
}

function parseColour(value: string, dark: boolean, depth = 0): Rgba | null {
  const v = value.trim();
  if (depth > 12) return null;
  const variable = /^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/.exec(v);
  if (variable) {
    const name = variable[1] ?? "";
    for (const selector of scopeChain(name, dark)) {
      const found = scopes.get(selector)?.get(name);
      if (found !== undefined) return parseColour(found, dark, depth + 1);
    }
    const inline = themeInline.get(name);
    if (inline !== undefined) return parseColour(inline, dark, depth + 1);
    return variable[2] ? parseColour(variable[2], dark, depth + 1) : null;
  }
  if (v.startsWith("#")) {
    let hex = v.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  const oklch = /^oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/.exec(v);
  if (oklch) return oklchToRgba(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  const rgb = /^rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\)$/.exec(v);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] === "%" ? 100 : 1);
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: alpha };
  }
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+?)\)$/.exec(v);
  if (mix) {
    const first = parseColour(mix[1] ?? "", dark, depth + 1);
    const second = parseColour(mix[3] ?? "", dark, depth + 1);
    if (!first || !second) return null;
    const p = Number(mix[2]) / 100;
    return {
      r: first.r * p + second.r * (1 - p),
      g: first.g * p + second.g * (1 - p),
      b: first.b * p + second.b * (1 - p),
      a: 1,
    };
  }
  if (v === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (v === "black") return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}

/** `bg-x` / `text-x` -> colour in the given mode, or null if it is not a colour. */
function classColour(cls: string, property: "bg" | "text", dark: boolean): Rgba | null {
  if (!cls.startsWith(`${property}-`)) return null;
  let value = cls.slice(property.length + 1);
  let alpha = 1;
  const withAlpha = /^(.+)\/(\d+)$/.exec(value);
  if (withAlpha && !value.startsWith("[")) {
    value = withAlpha[1] ?? value;
    alpha = Number(withAlpha[2]) / 100;
  }
  let colour: Rgba | null = null;
  if (value.startsWith("[") && value.endsWith("]")) {
    colour = parseColour(
      value
        .slice(1, -1)
        .replace(/^color:/, "")
        .replaceAll("_", " "),
      dark,
    );
  } else if (palette.has(value)) {
    colour = parseColour(palette.get(value) ?? "", dark);
  } else if (themeInline.has(`--color-${value}`)) {
    colour = parseColour(themeInline.get(`--color-${value}`) ?? "", dark);
  } else if (value === "white" || value === "black") {
    colour = parseColour(value, dark);
  }
  return colour ? { ...colour, a: colour.a * alpha } : null;
}

const NOT_A_TEXT_COLOUR =
  /^text-(xs|sm|base|lg|xl|\dxl|left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|\[\d)/;

/** The colour a set of classes paints in dark mode: `dark:` wins over base. */
function darkColour(classes: string[], property: "bg" | "text"): Rgba | null {
  let base: Rgba | null = null;
  let override: Rgba | null = null;
  for (const cls of classes) {
    if (cls.includes(":")) {
      const parts = cls.split(":");
      if (parts.length === 2 && parts[0] === "dark") {
        override = classColour(parts[1] ?? "", property, true) ?? override;
      }
      continue;
    }
    if (property === "text" && NOT_A_TEXT_COLOUR.test(cls)) continue;
    base = classColour(cls, property, true) ?? base;
  }
  return override ?? base;
}

// ---------------------------------------------------------------- the scan

const PALETTE =
  /^(bg|text|border|ring|divide|from|via|to|placeholder|outline|fill|stroke)-(white|black|neutral|gray|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?(\/\d+)?$/;

/**
 * Deliberately fixed surfaces -- they look the same in both themes, and that is
 * correct for them. Each entry needs a reason; a new file does not get in here
 * just to make the test pass.
 */
const FIXED_SURFACES: Record<string, string> = {
  "features/public/components/landing/": "Tenant landing: white CTAs and text on brand bands",
  "features/public/components/atlas-landing/": "Platform landing: white CTAs on accent bands",
  "components/shells/AuthShell.tsx": "Auth brand panel is an indigo fill in both themes",
  "features/certificates/components/VerificationCard.tsx":
    "Printable credential: paper-white with its own ink, like the certificate preview",
  "features/certificates/certificate-builder/": "Certificate artwork and a dark-only editor",
  "app/admin/branding/_components/BrandPreview.tsx": "Simulates both tenant modes explicitly",
  "features/learner/components/dashboard/LearnerPromoSliderCarousel.tsx":
    "Slide dots and controls sit on the promo image, not on a themed surface",
};

/** Overlay colours that are right on either background: scrims and text on photos. */
const OVERLAY = /^(text-white(\/\d+)?|bg-black(\/\d+)?|bg-white\/\d+|border-white\/\d+)$/;

const sources = [...files(webSrc, ".tsx"), ...files(designSystemSrc, ".tsx")];
const pageBackground = parseColour("var(--background)", true) ?? { r: 10, g: 10, b: 10, a: 1 };

type Finding = { at: string; detail: string };
const contrastFailures: Finding[] = [];
const lightOnly: Finding[] = [];

for (const file of sources) {
  const source = readFileSync(file, "utf8");
  const rel = relative(file.startsWith(webSrc) ? webSrc : designSystemSrc, file).replaceAll(
    "\\",
    "/",
  );
  const fixed = Object.keys(FIXED_SURFACES).some((prefix) => rel.startsWith(prefix));
  // Custom properties this file assigns inline (`style={{ "--accent": ... }}`)
  // have a per-element value no static read can know, so pairs using them are
  // not judged here.
  const localVars = [...source.matchAll(/["'](--[\w-]+)["']\s*:/g)].map((m) => m[1] ?? "");
  for (const literal of source.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) {
    const text = (literal[1] ?? literal[2] ?? "").replace(/\$\{[^}]*\}/g, " ");
    const classes = text.split(/\s+/).filter(Boolean);
    // A lone class is still checked for light-only colours below; only the
    // pair check needs two.
    if (classes.length === 0) continue;
    const line = source.slice(0, literal.index).split("\n").length;

    const bg = darkColour(classes, "bg");
    const fg = darkColour(classes, "text");
    const usesLocalVar = localVars.some((name) => text.includes(`var(${name})`));
    if (bg && fg && bg.a > 0 && !usesLocalVar) {
      const surface = over(bg, pageBackground);
      const ratio = contrast(over(fg, surface), surface);
      if (ratio < 4.5) {
        contrastFailures.push({
          at: `${rel}:${line}`,
          detail: `${ratio.toFixed(2)}:1 ${text.trim().slice(0, 90)}`,
        });
      }
    }

    if (fixed) continue;
    const darkProperties = new Set(
      classes.filter((c) => c.startsWith("dark:")).map((c) => c.split(":").pop()?.split("-")[0]),
    );
    for (const cls of classes) {
      if (!PALETTE.test(cls) || OVERLAY.test(cls)) continue;
      if (darkProperties.has(cls.split("-")[0])) continue;
      lightOnly.push({ at: `${rel}:${line}`, detail: cls });
    }
  }
}

describe("dark mode across the web app", () => {
  it("scans the app it is meant to", () => {
    // Guards the guard: an empty scan, or a theme it could not resolve, makes
    // every assertion below vacuous.
    expect(sources.length).toBeGreaterThan(1000);
    expect(parseColour("var(--background)", true)).not.toBeNull();
    expect(parseColour("var(--admin-surface)", true)).not.toBeNull();
    expect(classColour("bg-red-600", "bg", true)).not.toBeNull();
  });

  it("resolves the theme the way the browser does", () => {
    // Anchors: measured by hand when the audit was done. If these move, the
    // resolver is wrong and nothing else here can be trusted.
    const white = { r: 255, g: 255, b: 255, a: 1 };
    const danger = parseColour("var(--admin-danger)", false);
    expect(danger && contrast(white, danger)).toBeCloseTo(4.83, 1);
    const onPrimary = parseColour("var(--admin-on-primary)", true);
    const primary = parseColour("var(--admin-primary)", true);
    expect(onPrimary && primary && contrast(onPrimary, primary)).toBeGreaterThan(7);
  });

  it("keeps every text/background pair at AA in dark mode", () => {
    expect(contrastFailures).toEqual([]);
  });

  it("does not paint light-only palette colours on themed surfaces", () => {
    // Use a theme token (bg-card, text-muted-foreground, text-destructive-text,
    // bg-success/10 ...) so the colour follows the theme. A surface that must
    // not change with the theme belongs in FIXED_SURFACES, with its reason.
    expect(lightOnly).toEqual([]);
  });

  it("gives borders a theme colour by default", () => {
    // Tailwind v4 draws an uncoloured border in currentColor. The base rule in
    // globals.css restores a themed default for the ~170 bare borders.
    const globals = readFileSync(join(webSrc, "app", "globals.css"), "utf8");
    expect(globals).toMatch(/@layer base\s*\{[^}]*\*,[\s\S]*?border-color:\s*var\(--border\)/);
  });
});
