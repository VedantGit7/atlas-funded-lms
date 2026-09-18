import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The platform console must follow light and dark mode from theme tokens alone.
 *
 * It did not. Thirty-five palette colours (`bg-white`, `bg-neutral-900`,
 * `text-red-700`, amber banners) and a fixed `#171717` nav accent were spread
 * across the console, and every bare `border` fell back to Tailwind v4's
 * `currentColor`. In dark mode that meant white dialogs and panels, harsh white
 * table rules, and an active nav item rendered dark-on-dark and unreadable. The
 * frontend rules already forbid all of it; nothing enforced them here, so lint
 * passed with every one in place.
 *
 * Scans the console's components, pages and shell, including class strings
 * built in multi-line template literals, which a line-based grep misses.
 */

const webRoot = resolve(import.meta.dirname, "..", "..", "frontend", "apps", "web", "src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

const files = [
  ...tsxFiles(join(webRoot, "features", "platform", "components")),
  ...tsxFiles(join(webRoot, "app", "platform")),
  join(webRoot, "components", "shells", "PlatformConsoleShell.tsx"),
  join(webRoot, "components", "shells", "PlatformConsoleShellClient.tsx"),
];

const PALETTE =
  /\b(?:bg|text|border|ring|divide|outline|fill|stroke|from|via|to|placeholder)-(?:white|black|neutral|gray|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d+)?\b/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;

/** Every class string: "..." attributes and `...` template literals, across lines. */
function classStrings(source: string): string[] {
  return [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/gs)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

describe("platform console theming", () => {
  it("scans the console files it is meant to", () => {
    // Guards the guard: an empty file list makes every assertion below vacuous.
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files.map((file) => [file.slice(webRoot.length + 1), file]))(
    "%s uses no palette colours or hex values in classes",
    (_label, file) => {
      const offenders = classStrings(readFileSync(file, "utf8")).filter(
        (value) => PALETTE.test(value) || HEX.test(value),
      );
      expect(offenders).toEqual([]);
    },
  );

  it.each(files.map((file) => [file.slice(webRoot.length + 1), file]))(
    "%s gives every border a theme colour",
    (_label, file) => {
      // Tailwind v4 draws an uncoloured border in currentColor -- near-black in
      // light mode, near-white in dark. A class string that sets a border width
      // must also name a token colour (or take one from a variable it
      // interpolates, as the cost screen's notices do).
      const offenders = classStrings(readFileSync(file, "utf8")).filter((value) => {
        const setsBorder = /(?:^|\s)border(?:-[btlrxy])?(?=\s|$)/.test(value);
        const coloured = /border-(?:border|input|primary|warning|destructive|success)\b|\$\{/.test(
          value,
        );
        return setsBorder && !coloured;
      });
      expect(offenders).toEqual([]);
    },
  );

  it("does not give the shell a fixed accent colour", () => {
    const shell = readFileSync(
      join(webRoot, "components", "shells", "PlatformConsoleShellClient.tsx"),
      "utf8",
    );
    // The active nav item pairs this with text-primary-foreground; a fixed
    // near-black made that pair unreadable in dark mode.
    expect(shell).toContain('accentColor="var(--primary)"');
    expect(shell).not.toMatch(/accentColor="#/);
  });
});
