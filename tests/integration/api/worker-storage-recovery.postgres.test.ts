import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { appendTenantUsageEvent } from "@atlas/api/tenant-usage-meter";
import { enqueueExportCleanup } from "@atlas/domain/reports/export-file-cleanup.repository";
import { LocalFilesystemStorageProvider } from "@atlas/storage/providers/local-filesystem-storage-provider";
import { StorageEnvSchema } from "@atlas/storage/schemas/storage-env";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

type ChildResult = {
  checkpoint?: string;
  result?: { processed?: number; deleted?: number; failed?: number };
  exitCode: number | null;
  signal: string | null;
};
function child(input: object, checkpoint?: string): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const worker = spawn(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/reliability/worker-storage-db-child.mts",
      ],
      {
        env: {
          ...process.env,
          TSX_TSCONFIG_PATH: "backend/apps/api/tsconfig.json",
          ATLAS_WORKER_STORAGE_FIXTURE: JSON.stringify(input),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "",
      errors = "",
      killed = false;
    const timeout = setTimeout(() => {
      worker.kill("SIGKILL");
      reject(new Error("Child deadline"));
    }, 30_000);
    worker.stdout.on("data", (chunk) => {
      output += chunk;
      if (checkpoint && output.includes(checkpoint) && !killed) {
        killed = true;
        worker.kill("SIGKILL");
      }
    });
    worker.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    worker.on("error", reject);
    worker.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (code !== 0 && !killed) return reject(new Error(`Child ${code}: ${errors}`));
      try {
        resolve({ ...JSON.parse(output.trim().split("\n").at(-1) ?? ""), exitCode: code, signal });
      } catch {
        reject(new Error(`Invalid child output: ${output} ${errors}`));
      }
    });
  });
}
const suite =
  process.env.ATLAS_RELIABILITY_DRILL === "1" && process.env.DATABASE_URL
    ? describe
    : describe.skip;
const base = path.resolve(".test-results/reliability");
suite("real worker process loss with disposable PostgreSQL and filesystem", () => {
  it("rolls back an abruptly killed usage drain and counts once after fresh process restart", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    for (const tenant of [tenantA, tenantB])
      await withTenantTx(tenantCtx(tenant), async (tx) => {
        for (let i = 0; i < (tenant === tenantA ? 7 : 1); i++)
          await appendTenantUsageEvent(tx, {
            id: randomUUID(),
            tenantId: tenant.tenantId,
            periodStart: new Date("2026-09-01"),
            requests: 1,
            durationMs: 25,
            emails: 1,
          });
      });
    const context = tenantCtx(tenantA);
    const interrupted = await child(
      { mode: "usage-crash", context },
      "usage-drained-before-commit",
    );
    expect(interrupted.checkpoint).toBe("usage-drained-before-commit");
    const before = await withTenantTx(context, async (tx) => ({
      events: await tx.$queryRaw<
        Array<{ count: number }>
      >`SELECT count(*)::int AS count FROM tenant_usage_events WHERE processed_at IS NULL`,
      rollups:
        await tx.$queryRaw`SELECT id FROM analytics_rollups WHERE rollup_key='usage.api_requests'`,
    }));
    expect(before.events[0]?.count).toBe(7);
    expect(before.rollups).toEqual([]);
    const recovered = await child({ mode: "usage-recover", context });
    const replay = await child({ mode: "usage-recover", context });
    expect(recovered.result).toEqual({ processed: 7 });
    expect(replay.result).toEqual({ processed: 0 });
    const total = await withTenantTx(
      context,
      (tx) =>
        tx.$queryRaw<
          Array<{ metrics: { count: number; durationMs: number } }>
        >`SELECT metrics_json AS metrics FROM analytics_rollups WHERE rollup_key='usage.api_requests'`,
    );
    expect(Number(total[0]?.metrics.count)).toBe(7);
    expect(Number(total[0]?.metrics.durationMs)).toBe(175);
    const foreign = await withTenantTx(
      tenantCtx(tenantB),
      (tx) =>
        tx.$queryRaw<
          Array<{ count: number }>
        >`SELECT count(*)::int AS count FROM tenant_usage_events WHERE processed_at IS NULL`,
    );
    expect(foreign[0]?.count).toBe(1);
    await mkdir(base, { recursive: true });
    await writeFile(
      path.join(base, "worker-storage-usage-restart.json"),
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          interrupted,
          recovered,
          replay,
          pendingAfterCrash: 7,
          committedCount: 7,
          foreignPending: 1,
        },
        null,
        2,
      ) + "\n",
    );
  });

  it("retains cleanup references through provider failure and crash after actual deletion, then safely retries", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(path.join(base, "worker-storage-cleanup-"));
    const storage = new LocalFilesystemStorageProvider(
      StorageEnvSchema.parse({ STORAGE_LOCAL_ROOT: root }),
    );
    const sources = [
      { tenant: tenantA, id: randomUUID(), status: "SUCCEEDED" },
      { tenant: tenantA, id: randomUUID(), status: "RUNNING" },
      { tenant: tenantB, id: randomUUID(), status: "SUCCEEDED" },
    ].map((source) => ({
      ...source,
      key: `tenants/${source.tenant.tenantId}/exports/${source.id}/fixture.json`,
    }));
    try {
      for (const source of sources) {
        await storage.putObject({
          bucket: "fixture",
          key: source.key,
          body: Buffer.from(source.id),
          contentType: "application/json",
        });
        await withTenantTx(
          tenantCtx(source.tenant),
          (tx) => tx.$executeRaw`
          INSERT INTO export_jobs(id,tenant_id,requested_by_membership_id,status,scope_json,r2_object_key,expires_at,artifact_json,updated_at)
          VALUES(${source.id}::uuid,${source.tenant.tenantId}::uuid,${source.tenant.membershipId}::uuid,${source.status}::"JobStatus",'{}'::jsonb,${source.key},now()-interval '1 day',${JSON.stringify({ version: 1, provider: "local-fs", bucket: "fixture" })}::jsonb,now())`,
        );
      }
      const target = sources[0];
      if (!target) throw new Error("Missing fixture source");
      const context = tenantCtx(tenantA);
      expect(await withTenantTx(context, (tx) => enqueueExportCleanup(tx))).toBe(1);
      const reference = () =>
        withTenantTx(
          context,
          (tx) =>
            tx.$queryRaw<
              Array<{ r2_object_key: string | null; artifact_json: unknown }>
            >`SELECT r2_object_key,artifact_json FROM export_jobs WHERE id=${target.id}::uuid`,
        );
      const expireFixtureLease = () =>
        withTenantTx(
          context,
          (tx) =>
            tx.$executeRaw`UPDATE export_file_cleanup_requests SET lease_until=now()-interval '1 second' WHERE source_id=${target.id}::uuid`,
        );
      const failed = await child({ mode: "cleanup-fail", context, root });
      expect(failed.result).toEqual({ deleted: 0, failed: 1 });
      expect((await reference())[0]?.r2_object_key).toBe(target.key);
      expect(await storage.headObject({ bucket: "fixture", key: target.key })).not.toBeNull();
      await expireFixtureLease();
      const interrupted = await child(
        { mode: "cleanup-crash", context, root },
        "object-absent-before-acknowledgement",
      );
      expect(await storage.headObject({ bucket: "fixture", key: target.key })).toBeNull();
      expect((await reference())[0]?.r2_object_key).toBe(target.key);
      await expireFixtureLease();
      const recovered = await child({ mode: "cleanup-recover", context, root });
      expect(recovered.result).toEqual({ deleted: 1, failed: 0 });
      expect((await reference())[0]).toEqual({ r2_object_key: null, artifact_json: null });
      const queue = await withTenantTx(
        context,
        (tx) =>
          tx.$queryRaw<
            Array<{ status: string; attempts: number }>
          >`SELECT status,attempts FROM export_file_cleanup_requests WHERE source_id=${target.id}::uuid`,
      );
      expect(queue).toEqual([{ status: "succeeded", attempts: 3 }]);
      for (const source of sources.slice(1)) {
        expect(
          (await storage.getObjectBody({ bucket: "fixture", key: source.key }))?.toString(),
        ).toBe(source.id);
        const rows = await withTenantTx(
          tenantCtx(source.tenant),
          (tx) =>
            tx.$queryRaw<
              Array<{ r2_object_key: string }>
            >`SELECT r2_object_key FROM export_jobs WHERE id=${source.id}::uuid`,
        );
        expect(rows[0]?.r2_object_key).toBe(source.key);
      }
      await writeFile(
        path.join(base, "worker-storage-cleanup-restart.json"),
        JSON.stringify(
          {
            measuredAt: new Date().toISOString(),
            failed,
            interrupted,
            recovered,
            queue,
            activeAndForeignObjectsPreserved: true,
            sourceReferenceRetainedUntilConfirmedAbsent: true,
            fixtureLeaseExpiryAccelerated: true,
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      if (path.dirname(root) === base) await rm(root, { recursive: true, force: true });
    }
  });
});
