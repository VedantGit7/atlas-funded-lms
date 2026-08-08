import ExcelJS from "exceljs";
import type { ReportFormat } from "./reports.contract";
import type { ReportDatasetResult, ServiceCtx } from "./reports.types";
import { buildTenantStorageKey, getStorageProvider, parseStorageEnv } from "@atlas/storage";

function escapeCsvValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  const text =
    typeof value === "string"
      ? value
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildMinimalPdf(lines: string[]): Uint8Array {
  const contentLines = lines.map((line, index) => {
    const y = 780 - index * 14;
    return `BT /F1 10 Tf 50 ${String(y)} Td (${pdfEscape(line)}) Tj ET`;
  });

  const stream = `${contentLines.join("\n")}\n`;
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj",
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}endstream\nendobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${String(objects.length + 1)}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\n`;
  pdf += `startxref\n${String(xrefOffset)}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export function renderReportCsv(dataset: ReportDatasetResult): Uint8Array {
  const lines = [dataset.columns.join(",")];
  for (const row of dataset.rows) {
    lines.push(dataset.columns.map((column) => escapeCsvValue(row[column])).join(","));
  }

  return new TextEncoder().encode(`${lines.join("\n")}\n`);
}

export async function renderReportXlsx(dataset: ReportDatasetResult): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");

  worksheet.addRow(dataset.columns);
  worksheet.getRow(1).font = { bold: true };

  for (const row of dataset.rows) {
    const excelRow = worksheet.addRow(
      dataset.columns.map((column) => {
        const value = row[column];
        if (value == null) {
          return "";
        }
        if (typeof value === "object") {
          return JSON.stringify(value);
        }
        return value;
      }),
    );
    if (row["_is_subtotal"] === true) {
      excelRow.font = { bold: true };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export function renderReportPdf(dataset: ReportDatasetResult, title: string): Uint8Array {
  const lines = [
    title,
    dataset.columns.join(" | "),
    ...dataset.rows.slice(0, 50).map((row) =>
      dataset.columns.map((column) => escapeCsvValue(row[column])).join(" | "),
    ),
  ];

  if (dataset.rows.length > 50) {
    lines.push(`… ${String(dataset.rows.length - 50)} more rows`);
  }

  return buildMinimalPdf(lines);
}

export async function renderReportArtifact(
  format: ReportFormat,
  dataset: ReportDatasetResult,
  title: string,
): Promise<{ content: Uint8Array; contentType: string; fileExtension: string }> {
  switch (format) {
    case "csv":
      return {
        content: renderReportCsv(dataset),
        contentType: "text/csv",
        fileExtension: "csv",
      };
    case "xlsx":
      return {
        content: await renderReportXlsx(dataset),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileExtension: "xlsx",
      };
    case "pdf":
      return {
        content: renderReportPdf(dataset, title),
        contentType: "application/pdf",
        fileExtension: "pdf",
      };
    case "json": {
      const encoder = new TextEncoder();
      return {
        content: encoder.encode(JSON.stringify(dataset.rows, null, 2)),
        contentType: "application/json",
        fileExtension: "json",
      };
    }
    default:
      throw new Error("UNSUPPORTED_REPORT_FORMAT");
  }
}

export async function storeReportArtifact(
  ctx: ServiceCtx,
  args: {
    reportRunId: string;
    content: Uint8Array;
    contentType: string;
    fileExtension: string;
  },
): Promise<{ objectKey: string; expiresAt: Date }> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  const objectKey = buildTenantStorageKey({
    tenantId: ctx.tenantId,
    purpose: "export.file",
    resourceId: args.reportRunId,
    fileName: `report.${args.fileExtension}`,
  });

  const upload = await provider.createSignedUploadUrl({
    bucket: env.R2_BUCKET_NAME,
    key: objectKey,
    contentType: args.contentType,
    sizeBytes: args.content.byteLength,
    expiresInSeconds: env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS,
  });

  if (env.STORAGE_PROVIDER === "r2") {
    const response = await fetch(upload.url, {
      method: "PUT",
      body: Buffer.from(args.content),
      headers: upload.requiredHeaders,
    });

    if (!response.ok) {
      throw new Error("REPORT_UPLOAD_FAILED");
    }
  } else {
    await provider.putObject({
      bucket: env.R2_BUCKET_NAME,
      key: objectKey,
      body: Buffer.from(args.content),
      contentType: args.contentType,
    });
  }

  const expiresAt = new Date(Date.now() + env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS * 1000);
  return { objectKey, expiresAt };
}
