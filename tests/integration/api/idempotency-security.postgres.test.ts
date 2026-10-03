import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  fingerprintRequest,
  purgeExpiredIdempotencyRecords,
  withIdempotency,
  type IdempotencyTx,
} from "@atlas/api/idempotency-registry";
import { withPlatformIdempotency } from "@atlas/api/platform-idempotency-registry";

// Deliberately separate from DATABASE_URL: the general test teardown must not
// purge real development tenants. All test objects live in one random schema.
const connectionString = process.env.F03_TEST_DATABASE_URL;
const suite = connectionString ? describe : describe.skip;
const schema = `f03_test_${randomUUID().replaceAll("-", "")}`;
const tenantA = randomUUID(),
  tenantB = randomUUID(),
  actorA = randomUUID(),
  actorB = randomUUID();
let admin: Client;

function adapter(db: Client): IdempotencyTx {
  function statement(parts: TemplateStringsArray) {
    return parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, "");
  }
  return {
    $queryRaw: async <T>(parts: TemplateStringsArray, ...values: unknown[]) =>
      (await db.query(statement(parts), values)).rows as T,
    $executeRaw: async (parts, ...values) =>
      (await db.query(statement(parts), values)).rowCount ?? 0,
  };
}
async function transaction<T>(fn: (tx: IdempotencyTx, db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`SET LOCAL search_path TO "${schema}", public`);
    const value = await fn(adapter(db), db);
    await db.query("COMMIT");
    return value;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}
function claim(key = randomUUID()) {
  return {
    tenantId: tenantA,
    actorMembershipId: actorA,
    idempotencyKey: key,
    scope: "POST /api/v1/action",
    requestFingerprint: fingerprintRequest({
      method: "POST",
      path: "/api/v1/action",
      body: { a: 1 },
    }),
  };
}
function platformClaim(key = randomUUID()) {
  return {
    idempotencyKey: key,
    actorPrincipalId: actorA,
    scope: "POST /api/v1/platform/action",
    requestId: randomUUID(),
    requestFingerprint: "fingerprint-a",
  };
}

suite("F03 real Postgres claims in an isolated schema", () => {
  beforeAll(async () => {
    if (!connectionString) throw new Error("Missing F03 test database");
    const target = new URL(connectionString);
    if (!["localhost", "127.0.0.1"].includes(target.hostname))
      throw new Error("This test only accepts a local maintenance database");
    admin = new Client({ connectionString });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}", public`);
    await admin.query(
      "CREATE TABLE tenants(id uuid PRIMARY KEY); CREATE TABLE auth_principals(id uuid PRIMARY KEY)",
    );
    await admin.query("INSERT INTO tenants VALUES ($1),($2)", [tenantA, tenantB]);
    await admin.query("INSERT INTO auth_principals VALUES ($1),($2)", [actorA, actorB]);
    await admin.query(
      readFileSync(
        "backend/prisma/migrations/20260820120000_102_idempotency_registry/migration.sql",
        "utf8",
      ),
    );
    await admin.query(
      readFileSync(
        "backend/prisma/migrations/20260919120000_107_platform_idempotency/migration.sql",
        "utf8",
      ),
    );
    await admin.query(
      `GRANT USAGE ON SCHEMA "${schema}" TO atlas_app, atlas_worker, atlas_platform`,
    );
  });
  afterAll(async () => {
    if (admin) {
      if (!/^f03_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Invalid test cleanup target");
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
  it("atomically serializes concurrent identical tenant requests", async () => {
    const c = claim();
    let calls = 0;
    const run = () =>
      transaction((tx) =>
        withIdempotency(tx, c, async () => {
          calls++;
          return { created: c.idempotencyKey };
        }),
      );
    const [first, second] = await Promise.all([run(), run()]);
    expect(first).toEqual(second);
    expect(calls).toBe(1);
  });
  it("rejects a different tenant actor and keeps tenants isolated", async () => {
    const c = claim();
    await transaction((tx) => withIdempotency(tx, c, async () => ({ secret: "a" })));
    await expect(
      transaction((tx) =>
        withIdempotency(tx, { ...c, actorMembershipId: actorB }, async () => ({ secret: "b" })),
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      transaction((tx) =>
        withIdempotency(tx, { ...c, tenantId: tenantB, actorMembershipId: actorB }, async () => ({
          secret: "b",
        })),
      ),
    ).resolves.toEqual({ secret: "b" });
  });
  it("rolls back a failed claim and permits a clean retry", async () => {
    const c = claim();
    await expect(
      transaction((tx) =>
        withIdempotency(tx, c, async () => {
          throw new Error("operation failed");
        }),
      ),
    ).rejects.toThrow("operation failed");
    await expect(
      transaction((tx) => withIdempotency(tx, c, async () => ({ ok: true }))),
    ).resolves.toEqual({ ok: true });
  });
  it("refuses expired and actor-less cached results", async () => {
    const c = claim();
    await transaction((tx) => withIdempotency(tx, c, async () => ({ ok: true })));
    await admin.query(
      "UPDATE idempotency_records SET expires_at=now()-interval '1 minute' WHERE idempotency_key=$1",
      [c.idempotencyKey],
    );
    await expect(
      transaction((tx) => withIdempotency(tx, c, async () => ({ ok: false }))),
    ).rejects.toMatchObject({ status: 409 });
    await admin.query(
      "UPDATE idempotency_records SET actor_membership_id=NULL WHERE idempotency_key=$1",
      [c.idempotencyKey],
    );
    await expect(
      transaction((tx) => withIdempotency(tx, c, async () => ({ ok: false }))),
    ).rejects.toMatchObject({ status: 422 });
    expect(await transaction((tx) => purgeExpiredIdempotencyRecords(tx))).toBe(1);
  });
  it("serializes platform writes and checks the original principal", async () => {
    const c = platformClaim();
    let calls = 0;
    const run = () =>
      transaction(async (tx, db) => {
        await db.query("SET LOCAL ROLE atlas_platform");
        await db.query("SELECT set_config('app.platform_scope','true',true)");
        return withPlatformIdempotency(tx, c, async () => {
          calls++;
          return { ok: true };
        });
      });
    expect(await Promise.all([run(), run()])).toEqual([{ ok: true }, { ok: true }]);
    expect(calls).toBe(1);
    await expect(
      transaction((tx) =>
        withPlatformIdempotency(tx, { ...c, actorPrincipalId: actorB }, async () => ({
          ok: false,
        })),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("does not expose platform responses to tenant or worker roles", async () => {
    for (const role of ["atlas_app", "atlas_worker"]) {
      await expect(
        transaction(async (_tx, db) => {
          await db.query(`SET LOCAL ROLE ${role}`);
          return db.query("SELECT * FROM platform_idempotency_records");
        }),
      ).rejects.toMatchObject({ code: "42501" });
    }
  });
  it("enables and forces RLS on the platform table", async () => {
    const rows = await admin.query(
      "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=$1::regclass",
      [`${schema}.platform_idempotency_records`],
    );
    expect(rows.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
});
