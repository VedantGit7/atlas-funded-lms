import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TenantTx } from "@atlas/db";
import {
  enqueueExportCleanup,
  exportFileCleanupRepository,
} from "@atlas/domain/reports/export-file-cleanup.repository";
import { runExportFileCleanup } from "@atlas/domain/reports/export-file-cleanup";
import { exportSettingsRepository } from "@atlas/domain/reports/export-settings.repository";

const connectionString = process.env["F15_TEST_DATABASE_URL"];
const suite = connectionString ? describe : describe.skip;
const schema = `f15_cleanup_${randomUUID().replaceAll("-", "")}`;
let admin: Client;

function adapter(db: Client): TenantTx {
  const sql = (parts: TemplateStringsArray) =>
    parts.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, "");
  return {
    $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) =>
      (await db.query(sql(parts), values)).rows,
    $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) =>
      (await db.query(sql(parts), values)).rowCount,
  } as unknown as TenantTx;
}

async function transaction<T>(tenantId: string, callback: (tx: TenantTx) => Promise<T>) {
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query("begin");
    await db.query(`set local search_path to "${schema}", public`);
    await db.query("set local role atlas_app");
    await db.query("select set_config('app.tenant_id',$1,true)", [tenantId]);
    const result = await callback(adapter(db));
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}

async function fixture(status = "SUCCEEDED", stopped = false) {
  const tenant = randomUUID(),
    otherTenant = randomUUID(),
    id = randomUUID();
  const key = `tenants/${tenant}/exports/${id}/tenant-export.json`;
  const manifest = {
    version: 1,
    provider: "local-fs",
    bucket: "atlas-assets",
    verifiedAt: null,
    ...(stopped ? { writerStoppedAt: new Date().toISOString() } : {}),
  };
  await admin.query("insert into tenants(id) values($1),($2)", [tenant, otherTenant]);
  await admin.query(
    "insert into export_jobs(id,tenant_id,status,r2_object_key,expires_at,artifact_json) values($1,$2,$3,$4,now()-interval '1 day',$5)",
    [id, tenant, status, key, manifest],
  );
  return { tenant, otherTenant, id, key };
}

suite("F15 isolated PostgreSQL cleanup lifecycle", () => {
  beforeAll(async () => {
    if (!connectionString) throw new Error("Disposable test DB required");
    const url = new URL(connectionString);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !["/atlas_lms_test", "/atlas_lms_ci"].includes(url.pathname)
    )
      throw new Error("Use a dedicated local test database only");
    admin = new Client({ connectionString });
    await admin.connect();
    await admin.query(`create schema "${schema}"`);
    await admin.query(`set search_path to "${schema}", public`);
    await admin.query(`
      grant usage on schema "${schema}" to atlas_app, atlas_worker;
      create table tenants(id uuid primary key);
      create table export_jobs(id uuid primary key, tenant_id uuid references tenants(id), status text, r2_object_key text, expires_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
      create table report_runs(id uuid primary key, tenant_id uuid references tenants(id), status text, r2_object_key text, expires_at timestamptz, completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
      grant select, insert, update on export_jobs, report_runs to atlas_app, atlas_worker;
      alter table export_jobs enable row level security;
      alter table report_runs enable row level security;
      create policy exports_scope on export_jobs for all to atlas_app, atlas_worker using (tenant_id = current_setting('app.tenant_id')::uuid) with check (tenant_id = current_setting('app.tenant_id')::uuid);
      create policy reports_scope on report_runs for all to atlas_app, atlas_worker using (tenant_id = current_setting('app.tenant_id')::uuid) with check (tenant_id = current_setting('app.tenant_id')::uuid);
    `);
    await admin.query(
      readFileSync(
        "backend/prisma/migrations/20260920040000_112_export_artifacts/migration.sql",
        "utf8",
      ),
    );
    // The production function lives in app; redirect that namespace only so the
    // entire migration remains confined to this disposable maintenance schema.
    const migration = readFileSync(
      "backend/prisma/migrations/20260920050000_113_export_file_cleanup/migration.sql",
      "utf8",
    ).replaceAll("app.guard_export_cleanup_key", `"${schema}".guard_export_cleanup_key`);
    await admin.query(migration);
  });
  afterAll(async () => {
    if (admin) {
      await admin.query(`drop schema if exists "${schema}" cascade`);
      await admin.end();
    }
  });

  it("preserves the reference through enqueue, retry and confirmed storage deletion", async () => {
    const f = await fixture();
    expect(await transaction(f.tenant, (tx) => enqueueExportCleanup(tx))).toBe(1);
    expect(
      (await admin.query("select r2_object_key from export_jobs where id=$1", [f.id])).rows[0]
        .r2_object_key,
    ).toBe(f.key);
    let fail = true;
    const deps = {
      provider: "local-fs",
      bucket: "atlas-assets",
      claim: () =>
        transaction(f.tenant, (tx) => exportFileCleanupRepository.claim(tx, randomUUID(), 10)),
      complete: (request: Parameters<typeof exportFileCleanupRepository.complete>[1]) =>
        transaction(f.tenant, (tx) => exportFileCleanupRepository.complete(tx, request)),
      fail: (request: Parameters<typeof exportFileCleanupRepository.fail>[1]) =>
        transaction(f.tenant, (tx) => exportFileCleanupRepository.fail(tx, request)),
      deleteObject: async () => {
        if (fail) throw new Error("provider unavailable");
      },
      headObject: async () => null,
    };
    expect(await runExportFileCleanup({ tenantId: f.tenant, requestId: "test" }, deps)).toEqual({
      deleted: 0,
      failed: 1,
    });
    expect(
      (await admin.query("select r2_object_key from export_jobs where id=$1", [f.id])).rows[0]
        .r2_object_key,
    ).toBe(f.key);
    await admin.query(
      "update export_file_cleanup_requests set lease_until=null where source_id=$1",
      [f.id],
    );
    fail = false;
    expect(await runExportFileCleanup({ tenantId: f.tenant, requestId: "test" }, deps)).toEqual({
      deleted: 1,
      failed: 0,
    });
    expect(
      (await admin.query("select r2_object_key,artifact_json from export_jobs where id=$1", [f.id]))
        .rows[0],
    ).toEqual({ r2_object_key: null, artifact_json: null });
    expect(
      (
        await admin.query("select status from export_file_cleanup_requests where source_id=$1", [
          f.id,
        ])
      ).rows[0].status,
    ).toBe("succeeded");
  });

  it("excludes running and queued writers and waits for a cancelled upload to stop", async () => {
    for (const status of ["RUNNING", "QUEUED", "CANCELLED"]) {
      const f = await fixture(status);
      expect(await transaction(f.tenant, (tx) => enqueueExportCleanup(tx))).toBe(0);
    }
    const f = await fixture("CANCELLED", true);
    expect(await transaction(f.tenant, (tx) => enqueueExportCleanup(tx))).toBe(1);
  });
  it("shortens a younger file's remaining retention without extending expired files", async () => {
    const f = await fixture();
    await admin.query(
      "update export_jobs set created_at=now()-interval '12 hours',expires_at=now()+interval '7 days' where id=$1",
      [f.id],
    );
    await transaction(f.tenant, (tx) =>
      exportSettingsRepository.shortenFileRetention(tx, 86_400_000),
    );
    const remaining = Number(
      (
        await admin.query(
          "select extract(epoch from (expires_at-now())) as remaining from export_jobs where id=$1",
          [f.id],
        )
      ).rows[0].remaining,
    );
    expect(remaining).toBeGreaterThan(43_190);
    expect(remaining).toBeLessThanOrEqual(43_200);
    await admin.query("update export_jobs set expires_at=now()-interval '1 day' where id=$1", [
      f.id,
    ]);
    await transaction(f.tenant, (tx) =>
      exportSettingsRepository.shortenFileRetention(tx, 7 * 86_400_000),
    );
    expect(
      Number(
        (
          await admin.query(
            "select extract(epoch from (expires_at-now())) as remaining from export_jobs where id=$1",
            [f.id],
          )
        ).rows[0].remaining,
      ),
    ).toBeLessThan(0);
  });

  it("starts export retention at artifact preparation even after a long queue delay", async () => {
    const f = await fixture();
    await admin.query(
      "update export_jobs set created_at=now()-interval '30 days',expires_at=now()+interval '7 days',artifact_json=artifact_json || jsonb_build_object('retentionStartedAt',now()) where id=$1",
      [f.id],
    );
    const cutoff = new Date(Date.now() - 86_400_000);
    expect(
      await transaction(f.tenant, (tx) =>
        exportSettingsRepository.countFilesOutsideRetention(tx, cutoff),
      ),
    ).toBe(0);
    expect(await transaction(f.tenant, (tx) => enqueueExportCleanup(tx, { cutoff }))).toBe(0);
    await transaction(f.tenant, (tx) =>
      exportSettingsRepository.shortenFileRetention(tx, 86_400_000),
    );
    const remaining = Number(
      (
        await admin.query(
          "select extract(epoch from (expires_at-now())) as remaining from export_jobs where id=$1",
          [f.id],
        )
      ).rows[0].remaining,
    );
    expect(remaining).toBeGreaterThan(86_390);
    expect(remaining).toBeLessThanOrEqual(86_400);
  });

  it("only automatically cleans managed reports, while explicit legacy cleanup remains available", async () => {
    const f = await fixture("RUNNING");
    const reportId = randomUUID();
    const key = `tenants/${f.tenant}/exports/${reportId}/report.csv`;
    await admin.query(
      "insert into report_runs(id,tenant_id,status,r2_object_key,expires_at) values($1,$2,'SUCCEEDED',$3,now()-interval '1 day')",
      [reportId, f.tenant, key],
    );
    expect(await transaction(f.tenant, (tx) => enqueueExportCleanup(tx))).toBe(0);
    expect(
      await transaction(f.tenant, (tx) =>
        enqueueExportCleanup(tx, { sourceType: "report_run", sourceId: reportId }),
      ),
    ).toBe(1);
    const [request] = await transaction(f.tenant, (tx) =>
      exportFileCleanupRepository.claim(tx, randomUUID(), 10),
    );
    if (!request) throw new Error("Expected report claim");
    expect(
      await transaction(f.tenant, (tx) => exportFileCleanupRepository.complete(tx, request)),
    ).toBe(true);
    expect(
      (await admin.query("select r2_object_key from report_runs where id=$1", [reportId])).rows[0]
        .r2_object_key,
    ).toBeNull();
    const managedId = randomUUID();
    await admin.query(
      "insert into report_runs(id,tenant_id,status,r2_object_key,expires_at,file_retention_managed) values($1,$2,'SUCCEEDED',$3,now()-interval '1 day',true)",
      [managedId, f.tenant, `tenants/${f.tenant}/exports/${managedId}/report.csv`],
    );
    expect(await transaction(f.tenant, (tx) => enqueueExportCleanup(tx))).toBe(1);
  });

  it("enforces tenant isolation on requests and denies platform/global grants", async () => {
    const f = await fixture();
    await transaction(f.tenant, (tx) => enqueueExportCleanup(tx));
    expect(
      await transaction(f.otherTenant, (tx) =>
        exportFileCleanupRepository.claim(tx, randomUUID(), 10),
      ),
    ).toEqual([]);
    await expect(
      transaction(
        f.otherTenant,
        (tx) => tx.$executeRaw`
      insert into export_file_cleanup_requests(tenant_id,source_type,source_id,object_key)
      values(${f.otherTenant}::uuid,'export_job',${f.id}::uuid,${f.key})
    `,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const grants = await admin.query(
      "select has_table_privilege('atlas_platform',$1,'SELECT') as platform,has_table_privilege('atlas_app',$1,'DELETE') as can_delete",
      [`${schema}.export_file_cleanup_requests`],
    );
    expect(grants.rows[0]).toEqual({ platform: false, can_delete: false });
  });

  it("blocks writer resurrection and reuse of a cleanup key", async () => {
    const f = await fixture();
    await transaction(f.tenant, (tx) => enqueueExportCleanup(tx));
    await expect(
      transaction(
        f.tenant,
        (tx) => tx.$executeRaw`update export_jobs set status='RUNNING' where id=${f.id}::uuid`,
      ),
    ).rejects.toThrow("reserved for cleanup");
    await expect(
      transaction(
        f.tenant,
        (tx) => tx.$executeRaw`
      insert into export_jobs(id,tenant_id,status,r2_object_key) values(${randomUUID()}::uuid,${f.tenant}::uuid,'SUCCEEDED',${f.key})
    `,
      ),
    ).rejects.toThrow("reserved for cleanup");
  });

  it("rejects a stale lease and changed source key without clearing either reference", async () => {
    const f = await fixture();
    await transaction(f.tenant, (tx) => enqueueExportCleanup(tx));
    const [request] = await transaction(f.tenant, (tx) =>
      exportFileCleanupRepository.claim(tx, randomUUID(), 10),
    );
    if (!request) throw new Error("Expected claim");
    expect(
      await transaction(f.tenant, (tx) =>
        exportFileCleanupRepository.complete(tx, { ...request, lease_token: randomUUID() }),
      ),
    ).toBe(false);
    await admin.query("update export_jobs set r2_object_key=$1 where id=$2", [
      `${f.key}.new`,
      f.id,
    ]);
    await expect(
      transaction(f.tenant, (tx) => exportFileCleanupRepository.complete(tx, request)),
    ).rejects.toThrow("source changed");
    expect(
      (await admin.query("select r2_object_key from export_jobs where id=$1", [f.id])).rows[0]
        .r2_object_key,
    ).toBe(`${f.key}.new`);
  });
});
