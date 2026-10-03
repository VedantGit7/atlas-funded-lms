import { createHash } from "node:crypto";
import { mkdtemp, open, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServiceCtx } from "./data-rights.types";
import { TENANT_EXPORT_COVERAGE } from "./privacy-lifecycle.contract";

export const EXPORT_SECTIONS = ["memberships", "memberProfiles", "courses", "enrollments"] as const;
export type ExportSection = (typeof EXPORT_SECTIONS)[number];
export type ExportPageRow = { cursor: string; data: Record<string, unknown> | null };
export const EXPORT_PAGE_SIZE = 100;
export type ExportSpool = {
  path: string;
  sizeBytes: number;
  checksumSha256: string;
  cleanup: () => Promise<void>;
};
export class ExportLimitError extends Error {}

/** Bounded pages and a private disk spool keep memory independent of tenant size. */
export async function spoolTenantExport(
  ctx: ServiceCtx,
  loadPage: (section: ExportSection, cursor?: string) => Promise<ExportPageRow[]>,
  limits = { maxRows: 100_000, maxBytes: 64 * 1024 * 1024 },
): Promise<ExportSpool> {
  const directory = await mkdtemp(join(tmpdir(), "atlas-export-"));
  const path = join(directory, "tenant-export.json");
  const cleanup = async () => {
    await unlink(path).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
    await rmdir(directory).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  };
  const handle = await open(path, "wx", 0o600).catch(async (error: unknown) => {
    await cleanup();
    throw error;
  });
  const hash = createHash("sha256");
  let sizeBytes = 0;
  let rows = 0;
  const started = Date.now();
  async function write(value: string) {
    const bytes = Buffer.from(value);
    sizeBytes += bytes.length;
    if (sizeBytes > limits.maxBytes) throw new ExportLimitError("EXPORT_BYTE_LIMIT");
    hash.update(bytes);
    await handle.writeFile(bytes);
  }
  try {
    await write(
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        tenantId: ctx.tenantId,
        coverage: TENANT_EXPORT_COVERAGE,
        consistency: "paged_read_committed",
      }).slice(0, -1),
    );
    for (const section of EXPORT_SECTIONS) {
      await write(`,${JSON.stringify(section)}:[`);
      let cursor: string | undefined;
      let first = true;
      for (;;) {
        if (Date.now() - started > 120_000) throw new ExportLimitError("EXPORT_TIME_LIMIT");
        const page = await loadPage(section, cursor);
        if (page.length > EXPORT_PAGE_SIZE) throw new ExportLimitError("EXPORT_PAGE_LIMIT");
        for (const row of page) {
          if (!row.data) throw new ExportLimitError("EXPORT_RECORD_LIMIT");
          if (cursor && row.cursor <= cursor) throw new Error("EXPORT_CURSOR_INVALID");
          cursor = row.cursor;
          if (++rows > limits.maxRows) throw new ExportLimitError("EXPORT_ROW_LIMIT");
          await write(`${first ? "" : ","}${JSON.stringify(row.data)}`);
          first = false;
        }
        if (page.length < EXPORT_PAGE_SIZE) break;
      }
      await write("]");
    }
    await write("}");
    await handle.close();
    return { path, sizeBytes, checksumSha256: hash.digest("hex"), cleanup };
  } catch (error) {
    try {
      await handle.close();
    } finally {
      await cleanup();
    }
    throw error;
  }
}
