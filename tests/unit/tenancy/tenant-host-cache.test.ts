import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetResolvedTenantHosts,
  lookupTenantFromHost,
  resolveTenantFromHost,
  resolveTenantFromRecentLookup,
} from "../../../backend/packages/tenancy/src/tenant-resolver";

/** Recently resolved hostnames are kept briefly per process (audit §3.1). */
describe("tenant host lookups", () => {
  const row = (state = "ACTIVE") => ({
    tenant_id: "tenant-1",
    tenant_slug: "academy",
    tenant_state: state,
    domain_id: "domain-1",
    domain_status: "ACTIVE",
    hostname: "academy.example.test",
  });
  const db = (rows: unknown[]) => ({ $queryRaw: vi.fn(async () => rows) });
  const request = (host: string) => new Request(`https://${host}/`, { headers: { host } });
  const resolve = (database: ReturnType<typeof db>, host = "academy.example.test") =>
    resolveTenantFromHost({ host, requestId: "req-1", db: database });

  beforeEach(() => {
    forgetResolvedTenantHosts();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the database once for a host found within 30 s, case-insensitively", async () => {
    const database = db([row()]);
    await resolve(database);
    await resolve(database, "ACADEMY.example.test");
    expect(database.$queryRaw).toHaveBeenCalledTimes(1);
    expect(resolveTenantFromRecentLookup(request("academy.example.test"))).toMatchObject({
      tenantId: "tenant-1",
      host: "academy.example.test",
    });

    vi.advanceTimersByTime(30_001);
    expect(resolveTenantFromRecentLookup(request("academy.example.test"))).toBeNull();
    await resolve(database);
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("never keeps an unknown host, so a new domain works at once", async () => {
    const missing = db([]);
    expect(
      await lookupTenantFromHost({ host: "new.example.test", requestId: "r", db: missing }),
    ).toBeNull();
    expect(resolveTenantFromRecentLookup(request("new.example.test"))).toBeNull();
    const found = db([{ ...row(), hostname: "new.example.test" }]);
    await expect(
      resolveTenantFromHost({ host: "new.example.test", requestId: "r", db: found }),
    ).resolves.toMatchObject({ tenantId: "tenant-1" });
  });

  it("forgets every host after a committed tenant or domain change", async () => {
    const database = db([row()]);
    await resolve(database);
    forgetResolvedTenantHosts();
    expect(resolveTenantFromRecentLookup(request("academy.example.test"))).toBeNull();
    await resolve(database);
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("still refuses a suspended tenant when answering from a recent lookup", async () => {
    await expect(resolve(db([row("SUSPENDED")]))).rejects.toMatchObject({
      code: "TENANT_UNAVAILABLE",
    });
    expect(() => resolveTenantFromRecentLookup(request("academy.example.test"))).toThrow(
      expect.objectContaining({ code: "TENANT_UNAVAILABLE" }),
    );
  });
});
