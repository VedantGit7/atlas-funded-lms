import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Audit finding M1 — CSV formula injection, adoption half.
 *
 * `tests/unit/export/csv-injection.test.ts` already proves both `csvEscape`
 * implementations are correct: they neutralise a leading `=`, `+`, `-`, `@`,
 * tab or carriage return, and they quote per RFC 4180.
 *
 * That was never the gap. M1 was recorded as closed while seven call sites
 * still built CSV by hand with `"${cell.replace(/"/g, '""')}"` — correct
 * quoting, no formula guard. A shared escaper that call sites do not use is a
 * control that exists without being applied, and a unit test on the escaper
 * cannot see the difference. This test looks at the call sites instead.
 *
 * The sites found in the 2026-08-22 sweep were:
 *   backend/packages/domain/src/reports/reports-export-runner.ts
 *   features/admin/grow/CampaignAnalyticsPanel.tsx
 *   features/admin/grow/CampaignsListPanel.tsx
 *   features/admin/grow/CouponBuilderPanel.tsx
 *   features/admin/reports/AdminLiveClassAttendanceLearnersPage.tsx
 *   features/admin/reports/AdminPollNonRespondentsPage.tsx
 *   features/admin/reports/AdminSuperLiveInsightsComparePage.tsx
 *
 * All of them export learner-controlled data to an administrator's spreadsheet.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");

const SCAN_ROOTS = ["backend", "frontend"];

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  ".next",
  ".turbo",
  "generated",
  "coverage",
]);

/**
 * The two files that are *allowed* to implement CSV quoting, because they are
 * the shared implementations everything else must call.
 */
const ESCAPER_IMPLEMENTATIONS = new Set([
  "backend/packages/core/src/csv/escape.ts",
  "frontend/apps/web/src/lib/export/csv.ts",
]);

/**
 * RFC 4180 doubling of a quote character. In a CSV builder this is the
 * signature of a hand-rolled escaper; `&quot;` HTML escaping is a different
 * thing and is not matched.
 */
const HAND_ROLLED_CSV_QUOTING = /replace(All)?\(\s*\/"\/g\s*,\s*['"`]""['"`]\s*\)/;

function walk(directory: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = join(directory, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

describe("CSV escaping adoption (M1)", () => {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) walk(join(repoRoot, root), files);

  it("scans a meaningful number of source files", () => {
    // Vacuity guard. A broken walk or an over-eager skip list would make every
    // assertion below pass by inspecting nothing -- the exact failure mode this
    // programme kept finding in its own guards.
    expect(files.length).toBeGreaterThan(2000);
  });

  it("routes every CSV export through a shared escaper", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const relativePath = relative(repoRoot, file).split("\\").join("/");
      if (ESCAPER_IMPLEMENTATIONS.has(relativePath)) continue;

      const source = readFileSync(file, "utf8");
      if (HAND_ROLLED_CSV_QUOTING.test(source)) {
        offenders.push(relativePath);
      }
    }

    expect(
      offenders,
      `these files quote CSV by hand instead of calling csvEscape, so a leading ` +
        `=, +, - or @ from learner-controlled data reaches the spreadsheet as a ` +
        `live formula:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps both shared escapers guarding formula prefixes", () => {
    // If an implementation lost its guard, the adoption check above would still
    // pass while every call site silently became vulnerable again.
    for (const relativePath of ESCAPER_IMPLEMENTATIONS) {
      const source = readFileSync(join(repoRoot, relativePath), "utf8");
      expect(source, `${relativePath} lost its FORMULA_PREFIXES set`).toContain("FORMULA_PREFIXES");
      for (const prefix of ['"="', '"+"', '"-"', '"@"']) {
        expect(source, `${relativePath} no longer guards ${prefix}`).toContain(prefix);
      }
    }
  });
});
