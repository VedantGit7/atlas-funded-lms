import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import {
  createTenantIsolationFixture,
  type TenantIsolationFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";
import { GET as landing } from "../../../backend/apps/api/src/app/api/v1/public/landing/[slug]/route";
import { GET as legal } from "../../../backend/apps/api/src/app/api/v1/public/legal/[slug]/route";
import { GET as ctas } from "../../../backend/apps/api/src/app/api/v1/public/marketing/ctas/route";

/**
 * Audit H3: requests that held one pooled connection while waiting for a
 * second deadlocked the pool once concurrency reached DATABASE_POOL_MAX. These
 * public routes did exactly that until they resolved the tenant on a released
 * connection first. Twice the pool size in concurrent requests must all finish.
 */
const POOL_MAX = Number.parseInt(process.env["DATABASE_POOL_MAX"] ?? "20", 10) || 20;
const CONCURRENCY = POOL_MAX * 2;

const suite =
  process.env.DATABASE_URL && process.env.PLATFORM_DATABASE_URL ? describe : describe.skip;

suite("pooled connections under concurrency (audit H3)", () => {
  let fixture: TenantIsolationFixture;
  let host: string;

  beforeAll(async () => {
    fixture = await createTenantIsolationFixture();
    host = `${fixture.tenantA.slug}.pool-concurrency.test`;
    // tenant_domains is tenant-scoped under RLS: write it as that tenant.
    await withTenantTx(
      {
        tenantId: fixture.tenantA.tenantId,
        requestId: randomUUID(),
        allowAnonymousTenantRead: true,
      },
      (tx) => tx.$executeRaw`
        insert into tenant_domains (id, tenant_id, hostname, type, status, updated_at)
        values (${randomUUID()}::uuid, ${fixture.tenantA.tenantId}::uuid, ${host},
                'ATLAS_SUBDOMAIN', 'ACTIVE', now())
      `,
    );
  });

  afterAll(async () => {
    await withTenantTx(
      {
        tenantId: fixture.tenantA.tenantId,
        requestId: randomUUID(),
        allowAnonymousTenantRead: true,
      },
      (tx) => tx.$executeRaw`delete from tenant_domains where hostname = ${host}`,
    );
    vi.unstubAllEnvs();
  });

  const request = (path: string) =>
    new NextRequest(`https://${host}${path}`, {
      headers: { host, "x-forwarded-for": "198.51.100.7" },
    });

  it("control: the old nested shape stalls and fails at twice the pool size", async () => {
    // As in production, the nesting guard only logs here, so the old shape runs as it used to.
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const nested = () =>
      withGlobalDb(async (db) => {
        const tenant = await resolveTenantFromRequest({ req: request("/"), db });
        return withTenantTx(
          { tenantId: tenant.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
          (tx) => tx.$queryRaw`select 1`,
        );
      });
    const started = Date.now();
    const outcomes = await Promise.allSettled(Array.from({ length: CONCURRENCY }, nested));
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    expect(outcomes.filter((outcome) => outcome.status === "rejected").length).toBeGreaterThan(0);
    // Failures arrive only after the pool's connect timeout: the requests were stuck, not refused.
    expect(Date.now() - started).toBeGreaterThan(5_000);
  }, 60_000);

  it("public routes now serve twice the pool size concurrently, every request completing", async () => {
    const calls = Array.from({ length: CONCURRENCY }, (_, index) => {
      if (index % 3 === 0) return landing(request("/api/v1/public/landing/home"));
      if (index % 3 === 1) return legal(request("/api/v1/public/legal/terms"));
      return ctas(request("/api/v1/public/marketing/ctas"));
    });
    const started = Date.now();
    const responses = await Promise.all(calls);
    const statuses = responses.map((response) => response.status);
    // 200 or 404 (no page configured) are both answers; 5xx would be a stalled pool.
    expect(statuses.filter((status) => status >= 500)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(5_000);
  }, 60_000);
});
