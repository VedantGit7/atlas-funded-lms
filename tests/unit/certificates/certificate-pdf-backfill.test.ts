import { describe, expect, it } from "vitest";
import { pdfMatchesPage, readPdfPageSize } from "../../../scripts/data/certificate-pdf-backfill";

const pdfWithBox = (box: string) => Buffer.from(`%PDF-1.4\n<< /Type /Page /MediaBox [${box}] >>\n`);
const mm = (width: number, height: number) =>
  ({ width, height, unit: "mm", orientation: width >= height ? "landscape" : "portrait" }) as const;

// /MediaBox values Chromium 149 wrote in the managed-node worker image.
describe("certificate PDF backfill page check", () => {
  it("reads the first /MediaBox", () => {
    expect(readPdfPageSize(pdfWithBox("0 0 841.91998 595.91998"))).toEqual({
      width: 841.91998,
      height: 595.91998,
    });
    expect(readPdfPageSize(Buffer.from("not a pdf"))).toBeNull();
  });

  it("accepts the fixed renders, rounding included", () => {
    expect(pdfMatchesPage(pdfWithBox("0 0 841.91998 595.91998"), mm(297, 210))).toBe(true);
    expect(pdfMatchesPage(pdfWithBox("0 0 595.91998 841.91998"), mm(210, 297))).toBe(true);
    expect(
      pdfMatchesPage(pdfWithBox("0 0 842.88 595.91998"), {
        width: 1123,
        height: 794,
        unit: "px",
        orientation: "landscape",
      }),
    ).toBe(true);
    expect(
      pdfMatchesPage(pdfWithBox("0 0 792 612"), {
        width: 11,
        height: 8.5,
        unit: "in",
        orientation: "landscape",
      }),
    ).toBe(true);
  });

  it("flags the old A4 portrait render of a landscape design", () => {
    expect(pdfMatchesPage(pdfWithBox("0 0 595.91998 842.88"), mm(297, 210))).toBe(false);
  });

  it("returns null when there is no page size to compare", () => {
    expect(pdfMatchesPage(Buffer.from("%PDF-1.4 truncated"), mm(297, 210))).toBeNull();
  });
});
