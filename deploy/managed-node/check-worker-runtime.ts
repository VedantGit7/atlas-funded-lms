import { renderCertificatePdfBuffer } from "../../backend/apps/api/src/server/certificates/certificate-pdf.service";
import { createEmptyDesignDocument } from "../../backend/apps/api/src/server/certificates/certificate-design-document";
import { renderReportXlsx } from "../../backend/packages/domain/src/reports/reports-export-runner";
import { sanitizeSvg } from "../../backend/packages/storage/src/svg-sanitize";

// Runs, in the built worker image, the code paths a bundle or a missing system
// library breaks without breaking imports: they load data files, native
// pieces or a browser lazily. No network, database or provider is used.
//
// Certificate PDFs matter most: a failed render falls back to HTML quietly, so
// a worker without a working Chromium would otherwise ship unnoticed.

function fail(check: string, detail: string): never {
  throw new Error(`Worker runtime check failed: ${check}: ${detail}`);
}

// jsdom, DOMPurify and css-tree (style attributes), as SVG uploads use them.
const svg = (
  await sanitizeSvg(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1" style="fill: red" onclick="x()"/></svg>',
    ),
  )
).toString("utf8");
if (!svg.includes("<rect") || /script|onclick/i.test(svg)) fail("svg-sanitize", svg);

// exceljs, as report exports use it.
const xlsx = await renderReportXlsx({ columns: ["name"], rows: [{ name: "Learner" }] });
if (Buffer.from(xlsx).subarray(0, 2).toString("latin1") !== "PK") fail("report-xlsx", "not a zip");

// playwright-core and Chromium, as certificate PDFs use them.
const pdf = await renderCertificatePdfBuffer({ designSnapshotJson: createEmptyDesignDocument() });
if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-" || pdf.length < 1000) {
  fail("certificate-pdf", `${String(pdf.length)} bytes`);
}

console.info(
  JSON.stringify({
    check: "worker-runtime",
    passed: true,
    svgBytes: svg.length,
    xlsxBytes: xlsx.length,
    pdfBytes: pdf.length,
  }),
);
process.exit(0);
