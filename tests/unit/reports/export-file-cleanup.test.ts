import { describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import { exportSettingsRepository } from "@atlas/domain/reports/export-settings.repository";
import { deleteExportRunFileResponseSchema } from "@atlas/domain/reports/export-run-detail.dto";

describe("export cleanup requests", () => {
  it("queues expired files without discarding storage references", async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: TemplateStringsArray) => {
      statements.push(sql.join("?"));
      return [{ count: 2 }];
    });
    const tx = { $queryRaw: query, $executeRaw: query } as unknown as TenantTx;
    await exportSettingsRepository.purgeExpiredFiles(tx);
    expect(statements.join("\n")).not.toMatch(/r2_object_key\s*=\s*null/);
    expect(statements.join("\n")).toContain("export_file_cleanup_requests");
    expect(statements.join("\n")).toContain("'SUCCEEDED', 'FAILED', 'CANCELLED'");
  });

  it("represents accepted deletion without claiming that the file is gone", () => {
    expect(
      deleteExportRunFileResponseSchema.safeParse({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          sourceType: "export_job",
          deleted: false,
          hasFile: true,
          deletionPending: true,
        },
      }).success,
    ).toBe(true);
  });
  it("does not queue a cancelled export until its upload writer acknowledges stopping", async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: TemplateStringsArray) => {
      statements.push(sql.join("?"));
      return [{ count: 0 }];
    });
    await exportSettingsRepository.purgeExpiredFiles({ $queryRaw: query } as unknown as TenantTx);
    const exportStatement = statements.find((sql) => sql.includes("update export_jobs"));
    expect(exportStatement).toContain("writerStoppedAt");
    expect(exportStatement).toContain("status <> 'CANCELLED'");
  });
});
