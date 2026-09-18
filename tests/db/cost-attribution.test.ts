import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withPlatformScope } from "@atlas/db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { writeMeteredBatch } from "@atlas/api/tenant-usage-meter";
import {
  createFixedCost,
  endFixedCost,
  getCostAttributionReport,
  setCostRate,
} from "@atlas/domain-config/services/cost-attribution.service";

/**
 * Per-tenant cost attribution (DoD item 8) against a real database.
 *
 * The allocation arithmetic has unit tests of its own; what only a database can
 * prove is the SQL that feeds it -- which storage rows count, which month an
 * active day falls in, that a superseded rate loses to its correction, that an
 * ended fixed cost stops applying -- and that the privilege model holds: the
 * rate history cannot be rewritten, and the tenant role cannot read supplier
 * costs at all.
 *
 * Fixtures sit in March 2025, before any tenant in the test database was
 * created, so the report for that month contains only what this file puts there.
 */

const databaseUrl = process.env["DATABASE_URL"];
const platformUrl = process.env["PLATFORM_DATABASE_URL"];
const describeWithDb = databaseUrl && platformUrl ? describe : describe.skip;

const MONTH = "2025-03";
const MARCH = new Date(Date.UTC(2025, 2, 1));
const REASON = `cost-attr-test ${randomUUID()}`;

const principalId = randomUUID();
const tenantA = randomUUID();
const tenantB = randomUUID();
const memberA1 = randomUUID();
const memberA2 = randomUUID();
const memberA3 = randomUUID();
const membersA = [memberA1, memberA2, memberA3];
const memberB = randomUUID();

let owner: Client;

function platformCtx() {
  return {
    principalId,
    requestId: randomUUID(),
    requiredPermission: "platform.cost.manage" as const,
    platformPermissions: ["platform.cost.read", "platform.cost.manage"] as const,
  };
}

async function asPlatform<T>(fn: Parameters<typeof withPlatformScope<T>>[2]): Promise<T> {
  return withPlatformScope(platformCtx(), "Cost attribution database test", fn);
}

const serviceCtx = () => ({ platformPrincipalId: principalId, requestId: randomUUID() });

describeWithDb("per-tenant cost attribution", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: databaseUrl });
    await owner.connect();

    await owner.query(
      `insert into auth_principals (id, supabase_user_id, email, email_normalized, updated_at)
       values ($1::uuid, $2::uuid, $3, $3, now())`,
      [principalId, randomUUID(), `cost-attr-${principalId.slice(0, 8)}@example.test`],
    );

    for (const [id, name] of [
      [tenantA, "Cost Test A"],
      [tenantB, "Cost Test B"],
    ] as const) {
      await owner.query(
        `insert into tenants (id, slug, display_name, state, created_at, updated_at)
         values ($1::uuid, $2, $3, 'ACTIVE', '2025-01-01', now())`,
        [id, `cost-${id.slice(0, 8)}`, name],
      );
    }
    for (const id of membersA) {
      await owner.query(
        `insert into memberships (id, tenant_id, status, updated_at) values ($1::uuid, $2::uuid, 'ACTIVE', now())`,
        [id, tenantA],
      );
    }
    await owner.query(
      `insert into memberships (id, tenant_id, status, updated_at) values ($1::uuid, $2::uuid, 'ACTIVE', now())`,
      [memberB, tenantB],
    );

    // Active days. A: 3 distinct members over 5 member-days in March, plus one
    // day in April that must not be counted. B: 1 member on 2 days.
    const days: Array<[string, string, string]> = [
      [tenantA, memberA1, "2025-03-01"],
      [tenantA, memberA1, "2025-03-02"],
      [tenantA, memberA1, "2025-03-31"],
      [tenantA, memberA2, "2025-03-10"],
      [tenantA, memberA3, "2025-03-20"],
      [tenantA, memberA3, "2025-04-01"],
      [tenantB, memberB, "2025-03-05"],
      [tenantB, memberB, "2025-03-06"],
    ];
    for (const [tenant, member, day] of days) {
      await owner.query(
        `insert into tenant_active_days (tenant_id, membership_id, day) values ($1::uuid, $2::uuid, $3::date)`,
        [tenant, member, day],
      );
    }

    // Storage, snapshot at 2025-04-01. A counts 2 GB + 1 GB = 3 GB:
    //   READY 2 GB                       counted
    //   PENDING_UPLOAD 5 GB              never uploaded, excluded
    //   deleted mid-March 4 GB           gone by the snapshot, excluded
    //   deleted in May 1 GB              still stored at the snapshot, counted
    // B counts 0.5 GB; an object created in April is excluded.
    const objects: Array<[string, number, string, string, string | null]> = [
      [tenantA, 2e9, "READY", "2025-02-01", null],
      [tenantA, 5e9, "PENDING_UPLOAD", "2025-02-01", null],
      [tenantA, 4e9, "DELETED", "2025-02-01", "2025-03-15"],
      [tenantA, 1e9, "DELETED", "2025-02-01", "2025-05-01"],
      [tenantB, 0.5e9, "READY", "2025-03-31", null],
      [tenantB, 9e9, "READY", "2025-04-02", null],
    ];
    for (const [tenant, bytes, status, created, deleted] of objects) {
      await owner.query(
        `insert into storage_references (
           tenant_id, bucket, object_key, purpose, resource_type, file_name,
           content_type, size_bytes, visibility, status, created_at, deleted_at
         ) values ($1::uuid, 'test', $2, 'lesson_asset', 'lesson', 'f.bin',
                   'application/octet-stream', $3, 'private', $4, $5::timestamptz, $6::timestamptz)`,
        [tenant, `cost-attr/${randomUUID()}`, bytes, status, created, deleted],
      );
    }

    // Domains: only A's verified custom domain counts; the platform subdomain
    // is not a supplier cost.
    await owner.query(
      `insert into tenant_domains (id, tenant_id, hostname, type, status, created_at, updated_at)
       values ($1::uuid, $2::uuid, $3, 'CUSTOM_DOMAIN', 'ACTIVE', '2025-02-01', now()),
              ($4::uuid, $2::uuid, $5, 'ATLAS_SUBDOMAIN', 'ACTIVE', '2025-02-01', now())`,
      [
        randomUUID(),
        tenantA,
        `a-${tenantA.slice(0, 8)}.example.test`,
        randomUUID(),
        `a-${tenantA.slice(0, 8)}.sub.example.test`,
      ],
    );

    // Requests and emails through the production flush path, twice for A so the
    // accumulation is exercised rather than a single insert.
    await writeMeteredBatch({
      tenantId: tenantA,
      periodStart: MARCH,
      requests: 800,
      durationMs: 40_000,
      emails: 10,
    });
    await writeMeteredBatch({
      tenantId: tenantA,
      periodStart: MARCH,
      requests: 800,
      durationMs: 40_000,
      emails: 10,
    });
    await writeMeteredBatch({
      tenantId: tenantB,
      periodStart: MARCH,
      requests: 400,
      durationMs: 8_000,
      emails: 0,
    });
  });

  afterAll(async () => {
    const tenants = [tenantA, tenantB];
    await owner.query(`delete from platform_cost_rates where reason like 'cost-attr-test%'`);
    await owner.query(`delete from platform_fixed_costs where reason like 'cost-attr-test%'`);
    for (const table of [
      "analytics_rollups",
      "storage_references",
      "tenant_domains",
      "tenant_active_days",
      "memberships",
    ]) {
      await owner.query(`delete from ${table} where tenant_id = any($1::uuid[])`, [tenants]);
    }
    await owner.query(`delete from tenants where id = any($1::uuid[])`, [tenants]);
    await owner.query(`delete from auth_principals where id = $1::uuid`, [principalId]);
    await owner.end();
  });

  it("accumulates metered usage in bigint without overflowing a 32-bit counter", async () => {
    // Three billion requests in a month is not realistic for one tenant, but the
    // column must not be what decides that.
    const february = new Date(Date.UTC(2025, 1, 1));
    await writeMeteredBatch({
      tenantId: tenantB,
      periodStart: february,
      requests: 3_000_000_000,
      durationMs: 0,
      emails: 0,
    });
    const { rows } = await owner.query<{ count: string }>(
      `select metrics_json->>'count' as count from analytics_rollups
       where tenant_id = $1::uuid and rollup_key = 'usage.api_requests' and period_start = $2`,
      [tenantB, february],
    );
    expect(rows[0]?.count).toBe("3000000000");
  });

  it("prices usage, allocates fixed costs, and honours rate history", async () => {
    await asPlatform(async (tx) => {
      await setCostRate(tx, serviceCtx(), {
        driver: "storage_gb_month",
        unitCostUsd: "0.015",
        effectiveFrom: MONTH,
        reason: `${REASON} storage`,
      });
      // A correction for the same month: newest wins, the original stays.
      await setCostRate(tx, serviceCtx(), {
        driver: "storage_gb_month",
        unitCostUsd: "0.02",
        effectiveFrom: MONTH,
        reason: `${REASON} storage corrected`,
      });
      // A later rate must not reach back into March.
      await setCostRate(tx, serviceCtx(), {
        driver: "storage_gb_month",
        unitCostUsd: "9",
        effectiveFrom: "2025-05",
        reason: `${REASON} storage may`,
      });
      await setCostRate(tx, serviceCtx(), {
        driver: "active_member",
        unitCostUsd: "0.00325",
        effectiveFrom: "2025-01",
        reason: `${REASON} members`,
      });
      await setCostRate(tx, serviceCtx(), {
        driver: "email_sent",
        unitCostUsd: "0.0001",
        effectiveFrom: MONTH,
        reason: `${REASON} email`,
      });
      await setCostRate(tx, serviceCtx(), {
        driver: "custom_domain",
        unitCostUsd: "0.10",
        effectiveFrom: MONTH,
        reason: `${REASON} domains`,
      });

      await createFixedCost(tx, serviceCtx(), {
        label: "Server",
        monthlyCostUsd: "24.00",
        allocationKey: "api_requests",
        effectiveFrom: MONTH,
        reason: `${REASON} server`,
      });
      await createFixedCost(tx, serviceCtx(), {
        label: "Database plan",
        monthlyCostUsd: "25",
        allocationKey: "active_members",
        effectiveFrom: "2025-01",
        reason: `${REASON} database`,
      });
      // Ended before March, so it must not apply.
      const old = await createFixedCost(tx, serviceCtx(), {
        label: "Old monitoring",
        monthlyCostUsd: "10",
        allocationKey: "equal",
        effectiveFrom: "2025-01",
        reason: `${REASON} old`,
      });
      await endFixedCost(tx, serviceCtx(), old.data.id, {
        effectiveUntil: "2025-02",
        reason: `${REASON} old ended`,
      });
    });

    const report = await asPlatform((tx) =>
      getCostAttributionReport(tx, { month: MONTH }, new Date("2026-01-01T00:00:00Z")),
    );
    const data = report.data;
    const a = data.tenants.find((t) => t.tenantId === tenantA);
    const b = data.tenants.find((t) => t.tenantId === tenantB);

    expect(data.isPartialMonth).toBe(false);
    expect(data.snapshotAt).toBe("2025-04-01T00:00:00.000Z");

    expect(a?.usage).toEqual({
      activeMembers: 3,
      memberDays: 5,
      apiRequests: 1600,
      apiServerMs: 80_000,
      storageGb: 3,
      emailsSent: 20,
      customDomains: 1,
    });
    expect(b?.usage).toEqual({
      activeMembers: 1,
      memberDays: 2,
      apiRequests: 400,
      apiServerMs: 8_000,
      storageGb: 0.5,
      emailsSent: 0,
      customDomains: 0,
    });

    // Variable: A = 3 GB * 0.02 + 3 * 0.00325 + 20 * 0.0001 + 1 * 0.10 = 0.17175
    //           B = 0.5 GB * 0.02 + 1 * 0.00325                        = 0.01325
    expect(a?.variableCostUsd).toBeCloseTo(0.17175, 8);
    expect(b?.variableCostUsd).toBeCloseTo(0.01325, 8);

    // Fixed: server $24 by requests (1600 : 400), database $25 by members (3 : 1).
    //   A = 19.20 + 18.75 = 37.95   B = 4.80 + 6.25 = 11.05
    expect(a?.fixedCostUsd).toBeCloseTo(37.95, 8);
    expect(b?.fixedCostUsd).toBeCloseTo(11.05, 8);
    expect(a?.totalCostUsd).toBeCloseTo(38.12175, 8);
    expect(a?.costPerActiveMemberUsd).toBeCloseTo(38.12175 / 3, 8);

    expect(data.fixedCosts.map((line) => line.label).sort()).toEqual(["Database plan", "Server"]);
    expect(data.totals.fixedCostUsd).toBeCloseTo(49, 8);

    const storage = data.drivers.find((driver) => driver.key === "storage_gb_month");
    expect(storage?.rate).toEqual({ unitCostUsd: 0.02, effectiveFrom: MONTH });
    // Requests were measured but never priced: named, not treated as free.
    expect(data.unpricedDrivers).toEqual(["api_million_requests"]);
  });

  it("refuses to end a fixed cost twice", async () => {
    await expect(
      asPlatform(async (tx) => {
        const line = await createFixedCost(tx, serviceCtx(), {
          label: "Twice",
          monthlyCostUsd: "1",
          allocationKey: "equal",
          effectiveFrom: MONTH,
          reason: `${REASON} twice`,
        });
        await endFixedCost(tx, serviceCtx(), line.data.id, {
          effectiveUntil: MONTH,
          reason: `${REASON} end once`,
        });
        await endFixedCost(tx, serviceCtx(), line.data.id, {
          effectiveUntil: MONTH,
          reason: `${REASON} end twice`,
        });
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("does not let the platform role rewrite rate history", async () => {
    // Checked on a raw connection rather than through withPlatformScope. That
    // wrapper writes its "failed" exit audit into the transaction the failing
    // statement has already aborted, so what reaches the caller is `25P02
    // current transaction is aborted` instead of the permission error -- the
    // assertion would be testing the wrapper, not the grant.
    for (const statement of [
      "UPDATE platform_cost_rates SET unit_cost_usd = 0",
      "DELETE FROM platform_cost_rates",
      "DELETE FROM platform_fixed_costs",
    ]) {
      await owner.query("BEGIN");
      try {
        await owner.query("SET LOCAL ROLE atlas_platform");
        await expect(owner.query(statement)).rejects.toThrow(/permission denied/i);
      } finally {
        await owner.query("ROLLBACK");
      }
    }
  });

  it("gives the tenant application role no access to supplier costs", async () => {
    await expect(
      withTenantTx(
        { tenantId: tenantA, requestId: randomUUID(), allowAnonymousTenantRead: true },
        (tx) => tx.$queryRaw`SELECT count(*) FROM platform_cost_rates`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      withTenantTx(
        { tenantId: tenantA, requestId: randomUUID(), allowAnonymousTenantRead: true },
        (tx) => tx.$queryRaw`SELECT count(*) FROM platform_fixed_costs`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
