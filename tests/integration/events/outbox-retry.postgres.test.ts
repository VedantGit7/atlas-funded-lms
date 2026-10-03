import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import type { EventsDbTx } from "@atlas/events/transaction";
import type { TenantTx } from "@atlas/db";
import { reportDeliveryEffectsRepository as effects } from "@atlas/domain/reports/report-delivery-effects.repository";
import {
  processOutboxBatch,
  OutboxDeliveryError,
  type OutboxHandler,
} from "@atlas/events/services/outbox-worker.service";
import {
  materializeDeliveryJobs,
  claimDeliveryJob,
  replayDeliveryJob,
} from "@atlas/events/repositories/outbox-job.repository";

const connectionString = process.env.F08_TEST_DATABASE_URL;
const suite = connectionString ? describe : describe.skip;
const schema = `f08_test_${randomUUID().replaceAll("-", "")}`;
const tenantA = randomUUID(),
  tenantB = randomUUID();
let legacyFailed: { id: string; type: string };
let legacySent: { id: string; type: string };
let admin: Client;
function adapter(db: Client): EventsDbTx & Pick<TenantTx, "$executeRaw"> {
  return {
    $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const sql = parts.reduce((all, part, index) => all + (index ? `$${index}` : "") + part, "");
      return (await db.query(sql, values)).rowCount ?? 0;
    },
    $queryRaw: async <T>(parts: TemplateStringsArray, ...values: unknown[]) => {
      const sql = parts.reduce((all, part, index) => all + (index ? `$${index}` : "") + part, "");
      return (await db.query(sql, values)).rows as T;
    },
  };
}
let openTransactions = 0;
async function transaction<T>(
  fn: (tx: EventsDbTx, db: Client) => Promise<T>,
  tenantId = tenantA,
  role = "atlas_app",
): Promise<T> {
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`SET LOCAL search_path TO "${schema}",public`);
    if (!["atlas_app", "atlas_platform"].includes(role)) throw new Error("Invalid test role");
    await db.query(`SET LOCAL ROLE ${role}`);
    await db.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    openTransactions++;
    try {
      const result = await fn(adapter(db), db);
      await db.query("COMMIT");
      return result;
    } finally {
      openTransactions--;
    }
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}
async function seed(tenantId = tenantA) {
  const id = randomUUID(),
    type = `test.${id}`;
  await admin.query(
    "INSERT INTO outbox_events(id,tenant_id,event_type,payload_json,metadata_json) VALUES($1,$2,$3,'{}',$4)",
    [id, tenantId, type, JSON.stringify({ requestId: `req_${id}` })],
  );
  return { id, type };
}
const subscriptions = (type: string) => [{ eventType: type, destinationKey: "a" }];
async function run(type: string, handlers: OutboxHandler[], maxRetries = 3, db = { transaction }) {
  return processOutboxBatch(db, { limit: 10, maxRetries, handlers: { [type]: handlers } });
}
async function job(eventId: string, destination = "a") {
  return (
    await admin.query(
      "SELECT * FROM outbox_delivery_jobs WHERE outbox_event_id=$1 AND destination_key=$2",
      [eventId, destination],
    )
  ).rows[0] as {
    id: string;
    status: string;
    attempt_count: number;
    cycle_attempt_count: number;
    next_attempt_at: Date;
    last_dead_letter_id: string;
    lease_token: string;
  };
}
async function due(eventId: string) {
  await admin.query(
    "UPDATE outbox_delivery_jobs SET next_attempt_at=now()-interval '1 minute',lease_until=now()-interval '1 minute' WHERE outbox_event_id=$1",
    [eventId],
  );
}

suite("F08 durable delivery against isolated local PostgreSQL", () => {
  beforeAll(async () => {
    if (
      !connectionString ||
      !["localhost", "127.0.0.1"].includes(new URL(connectionString).hostname)
    )
      throw new Error("Local maintenance DB required");
    admin = new Client({ connectionString });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}",public`);
    await admin.query(`CREATE TYPE "DispatchStatus" AS ENUM('QUEUED','SENT','FAILED','CANCELLED');
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE outbox_events(id uuid PRIMARY KEY,tenant_id uuid,event_type text,payload_json jsonb,metadata_json jsonb,available_at timestamptz DEFAULT now(),occurred_at timestamptz DEFAULT now());
    CREATE TABLE event_deliveries(id uuid PRIMARY KEY,tenant_id uuid,outbox_event_id uuid,destination_key text,status "DispatchStatus",attempt_count int,last_attempt_at timestamptz,response_json jsonb,created_at timestamptz DEFAULT now());
    CREATE UNIQUE INDEX event_deliveries_outbox_event_id_destination_key_key ON event_deliveries(outbox_event_id,destination_key);
    CREATE TABLE dead_letter_events(id uuid PRIMARY KEY,tenant_id uuid,outbox_event_id uuid,destination_key text,error_json jsonb,failed_at timestamptz);`);
    await admin.query("INSERT INTO tenants VALUES($1),($2)", [tenantA, tenantB]);
    legacyFailed = await seed();
    legacySent = await seed();
    await admin.query(
      "INSERT INTO event_deliveries(id,tenant_id,outbox_event_id,destination_key,status,attempt_count) VALUES($1,$2,$3,'a','FAILED',1),($4,$2,$5,'a','SENT',1)",
      [randomUUID(), tenantA, legacyFailed.id, randomUUID(), legacySent.id],
    );
    await admin.query(
      "INSERT INTO dead_letter_events(id,tenant_id,outbox_event_id,destination_key,error_json,failed_at) VALUES($1,$2,$3,'a','{}',now())",
      [randomUUID(), tenantA, legacyFailed.id],
    );
    await admin.query(
      readFileSync(
        "backend/prisma/migrations/20260920020000_109_outbox_delivery_jobs/migration.sql",
        "utf8",
      ),
    );
    await admin.query("CREATE TABLE report_runs(id uuid PRIMARY KEY,tenant_id uuid NOT NULL)");
    await admin.query(
      readFileSync(
        "backend/prisma/migrations/20260920021000_110_report_delivery_effects/migration.sql",
        "utf8",
      ),
    );
    await admin.query("GRANT SELECT,UPDATE ON report_runs TO atlas_app");
    await admin.query(
      `GRANT USAGE ON SCHEMA "${schema}" TO atlas_app,atlas_platform,atlas_worker; GRANT SELECT,INSERT ON outbox_events,event_deliveries,dead_letter_events TO atlas_app,atlas_platform;`,
    );
    for (const table of ["outbox_events", "event_deliveries", "dead_letter_events"]) {
      await admin.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_scope ON ${table} TO atlas_app USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
    CREATE POLICY platform_scope ON ${table} TO atlas_platform USING(true) WITH CHECK(true);`);
    }
    await admin.query(
      `CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only'; END $$;`,
    );
    for (const table of ["outbox_events", "event_deliveries", "dead_letter_events"])
      await admin.query(
        `CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_mutation()`,
      );
  });
  afterAll(async () => {
    if (admin) {
      if (!/^f08_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe schema");
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  });
  it("migration keeps historical successes terminal and ambiguous failures held", async () => {
    expect((await job(legacySent.id)).status).toBe("succeeded");
    const held = await job(legacyFailed.id);
    expect(held.status).toBe("reconciliation_required");
    const handle = vi.fn();
    await run(legacyFailed.type, [{ destinationKey: "a", handle }]);
    expect(handle).not.toHaveBeenCalled();
    await expect(
      transaction(
        (tx) =>
          replayDeliveryJob(tx, {
            deadLetterId: held.last_dead_letter_id,
            outboxEventId: legacyFailed.id,
            destinationKey: "a",
          }),
        tenantA,
        "atlas_platform",
      ),
    ).rejects.toThrow("DELIVERY_RECONCILIATION_REQUIRED");
  });
  it("retries transient failure only when due and succeeds outside transactions", async () => {
    const event = await seed();
    const handle = vi.fn(async () => {
      expect(openTransactions).toBe(0);
      if (handle.mock.calls.length === 1) throw new Error("unavailable");
    });
    await run(event.type, [{ destinationKey: "a", handle }]);
    expect((await job(event.id)).status).toBe("retry");
    expect((await job(event.id)).next_attempt_at.getTime()).toBeGreaterThan(Date.now());
    await run(event.type, [{ destinationKey: "a", handle }]);
    expect(handle).toHaveBeenCalledTimes(1);
    await due(event.id);
    await run(event.type, [{ destinationKey: "a", handle }]);
    expect(handle).toHaveBeenCalledTimes(2);
    expect((await job(event.id)).status).toBe("succeeded");
    expect(
      (
        await admin.query(
          "SELECT attempt_count FROM event_deliveries WHERE outbox_event_id=$1 ORDER BY attempt_count",
          [event.id],
        )
      ).rows.map((row) => row.attempt_count),
    ).toEqual([1, 2]);
  });
  it("exhausts a persisted initial-plus-retry budget before creating one dead letter", async () => {
    const event = await seed();
    const handle = vi.fn(async () => {
      throw new Error("down");
    });
    await run(event.type, [{ destinationKey: "a", handle }], 1);
    expect((await job(event.id)).status).toBe("retry");
    await due(event.id);
    await run(event.type, [{ destinationKey: "a", handle }], 99);
    expect(handle).toHaveBeenCalledTimes(2);
    expect((await job(event.id)).status).toBe("dead");
    expect(
      (
        await admin.query(
          "SELECT count(*)::int n FROM dead_letter_events WHERE outbox_event_id=$1",
          [event.id],
        )
      ).rows[0]?.n,
    ).toBe(1);
    await run(event.type, [{ destinationKey: "a", handle }]);
    expect(handle).toHaveBeenCalledTimes(2);
  });
  it("permanent errors stop immediately and redact raw errors", async () => {
    const event = await seed();
    await run(event.type, [
      {
        destinationKey: "a",
        handle: async () => {
          throw new OutboxDeliveryError("permanent", "INVALID_DESTINATION");
        },
      },
    ]);
    expect((await job(event.id)).status).toBe("dead");
  });
  it("only one worker claims a destination concurrently", async () => {
    const event = await seed();
    await transaction((tx) => materializeDeliveryJobs(tx, subscriptions(event.type), 10, 4));
    const claims = await Promise.all([
      transaction((tx) => claimDeliveryJob(tx, subscriptions(event.type))),
      transaction((tx) => claimDeliveryJob(tx, subscriptions(event.type))),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
  it("claim rollback never runs the handler or consumes a durable attempt", async () => {
    const event = await seed();
    const handle = vi.fn();
    let transactions = 0;
    const db = {
      transaction: <T>(fn: (tx: EventsDbTx) => Promise<T>) =>
        transaction(async (tx) => {
          const value = await fn(tx);
          if (++transactions === 2) throw new Error("claim rollback");
          return value;
        }),
    };
    await expect(run(event.type, [{ destinationKey: "a", handle }], 3, db)).rejects.toThrow(
      "claim rollback",
    );
    expect(handle).not.toHaveBeenCalled();
    expect((await job(event.id)).attempt_count).toBe(0);
  });
  it("a result rollback recovers an idempotent destination with the same identity", async () => {
    const event = await seed();
    const keys: string[] = [];
    const handle = vi.fn(async (input: Parameters<OutboxHandler["handle"]>[0]) => {
      keys.push(input.idempotencyKey);
    });
    let transactions = 0;
    const db = {
      transaction: <T>(fn: (tx: EventsDbTx) => Promise<T>) =>
        transaction(async (tx) => {
          const value = await fn(tx);
          if (++transactions === 3) throw new Error("result rollback");
          return value;
        }),
    };
    await expect(run(event.type, [{ destinationKey: "a", handle }], 3, db)).rejects.toThrow(
      "result rollback",
    );
    expect((await job(event.id)).status).toBe("processing");
    await due(event.id);
    await run(event.type, [{ destinationKey: "a", handle }]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect((await job(event.id)).status).toBe("succeeded");
  });
  it("an interrupted SMTP-style destination is held rather than resent", async () => {
    const event = await seed();
    await transaction((tx) => materializeDeliveryJobs(tx, subscriptions(event.type), 10, 4));
    await transaction((tx) => claimDeliveryJob(tx, subscriptions(event.type)));
    await due(event.id);
    const handle = vi.fn();
    await run(event.type, [{ destinationKey: "a", retryOnCrash: false, handle }]);
    expect(handle).not.toHaveBeenCalled();
    expect((await job(event.id)).status).toBe("reconciliation_required");
  });
  it("destination replay retains success elsewhere and deduplicates repeated replay", async () => {
    const event = await seed();
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {
      throw new OutboxDeliveryError("permanent", "TEST_FAILED");
    });
    await run(event.type, [
      { destinationKey: "a", handle: a },
      { destinationKey: "b", handle: b },
    ]);
    const failed = await job(event.id, "b");
    const input = {
      deadLetterId: failed.last_dead_letter_id,
      outboxEventId: event.id,
      destinationKey: "b",
    };
    await Promise.all([
      transaction((tx) => replayDeliveryJob(tx, input), tenantA, "atlas_platform"),
      transaction((tx) => replayDeliveryJob(tx, input), tenantA, "atlas_platform"),
    ]);
    b.mockResolvedValue(undefined);
    await run(event.type, [
      { destinationKey: "a", handle: a },
      { destinationKey: "b", handle: b },
    ]);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    expect((await job(event.id, "b")).status).toBe("succeeded");
    await transaction((tx) => replayDeliveryJob(tx, input), tenantA, "atlas_platform");
    expect((await job(event.id, "b")).status).toBe("succeeded");
  });
  it("ambiguous outcomes cannot be replayed without reconciliation", async () => {
    const event = await seed();
    await run(event.type, [
      {
        destinationKey: "a",
        handle: async () => {
          throw new OutboxDeliveryError("reconciliation_required", "OUTCOME_UNKNOWN");
        },
      },
    ]);
    const held = await job(event.id);
    await expect(
      transaction(
        (tx) =>
          replayDeliveryJob(tx, {
            deadLetterId: held.last_dead_letter_id,
            outboxEventId: event.id,
            destinationKey: "a",
          }),
        tenantA,
        "atlas_platform",
      ),
    ).rejects.toThrow("DELIVERY_RECONCILIATION_REQUIRED");
  });
  it("tenant roles cannot read or claim another tenant's job", async () => {
    const event = await seed();
    await transaction((tx) => materializeDeliveryJobs(tx, subscriptions(event.type), 10, 4));
    expect(
      await transaction((tx) => claimDeliveryJob(tx, subscriptions(event.type)), tenantB),
    ).toBeNull();
    const rows = await transaction(
      (tx) =>
        tx.$queryRaw`SELECT * FROM outbox_delivery_jobs WHERE outbox_event_id=${event.id}::uuid`,
      tenantB,
    );
    expect(rows).toEqual([]);
    await expect(
      transaction(
        (tx) =>
          tx.$queryRaw`INSERT INTO outbox_delivery_jobs(tenant_id,outbox_event_id,destination_key,max_attempts) VALUES(${tenantB}::uuid,${event.id}::uuid,'cross',4) RETURNING id`,
        tenantB,
      ),
    ).rejects.toThrow();
  });
  it("source events and attempt evidence remain append-only", async () => {
    const event = await seed();
    await run(event.type, [{ destinationKey: "a", handle: async () => {} }]);
    await expect(
      admin.query("UPDATE outbox_events SET payload_json='{}' WHERE id=$1", [event.id]),
    ).rejects.toThrow("append-only");
    await expect(
      admin.query("DELETE FROM event_deliveries WHERE outbox_event_id=$1", [event.id]),
    ).rejects.toThrow("append-only");
  });
  it("real database fencing rejects a stale worker result", async () => {
    const event = await seed();
    await run(event.type, [
      {
        destinationKey: "a",
        handle: async () => {
          await admin.query(
            "UPDATE outbox_delivery_jobs SET lease_token=$1 WHERE outbox_event_id=$2",
            [randomUUID(), event.id],
          );
        },
      },
    ]);
    expect((await job(event.id)).status).toBe("processing");
    expect(
      (
        await admin.query("SELECT count(*)::int n FROM event_deliveries WHERE outbox_event_id=$1", [
          event.id,
        ])
      ).rows[0]?.n,
    ).toBe(0);
  });
  it("frozen report endpoint plans retain progress after partial delivery", async () => {
    const runId = randomUUID();
    await admin.query("INSERT INTO report_runs VALUES($1,$2)", [runId, tenantA]);
    const email = {
      effectKey: randomUUID(),
      kind: "email" as const,
      destinationId: null,
      request: { to: "original@example.test" },
      retryOnCrash: false,
    };
    const webhook = {
      effectKey: randomUUID(),
      kind: "webhook" as const,
      destinationId: null,
      request: { body: "frozen-body" },
      retryOnCrash: false,
    };
    const plan = [email, webhook];
    await transaction((tx) => effects.freeze(tx as TenantTx, runId, plan));
    const frozen = await transaction((tx) =>
      effects.freeze(tx as TenantTx, runId, [
        { ...email, request: { to: "changed@example.test" } },
      ]),
    );
    expect(frozen).toEqual(plan);
    const first = await transaction((tx) => effects.claim(tx as TenantTx, email.effectKey));
    expect(first.leaseToken).toBeTruthy();
    await transaction((tx) =>
      effects.finish(
        tx as TenantTx,
        email.effectKey,
        first.leaseToken ?? "",
        "succeeded",
        null,
        null,
      ),
    );
    expect((await transaction((tx) => effects.claim(tx as TenantTx, email.effectKey))).status).toBe(
      "succeeded",
    );
    expect(
      (await transaction((tx) => effects.claim(tx as TenantTx, webhook.effectKey))).status,
    ).toBe("claimed");
  });
  it("an expired report SMTP effect requires reconciliation and stale receipts cannot win", async () => {
    const runId = randomUUID(),
      key = randomUUID();
    await admin.query("INSERT INTO report_runs VALUES($1,$2)", [runId, tenantA]);
    await transaction((tx) =>
      effects.freeze(tx as TenantTx, runId, [
        {
          effectKey: key,
          kind: "email",
          destinationId: null,
          request: { to: "test@example.test" },
          retryOnCrash: false,
        },
      ]),
    );
    const claimed = await transaction((tx) => effects.claim(tx as TenantTx, key));
    await admin.query(
      "UPDATE report_delivery_effects SET lease_until=now()-interval '1 minute' WHERE effect_key=$1",
      [key],
    );
    expect((await transaction((tx) => effects.claim(tx as TenantTx, key))).status).toBe(
      "reconciliation_required",
    );
    expect(
      await transaction((tx) =>
        effects.finish(tx as TenantTx, key, claimed.leaseToken ?? "", "succeeded", null, null),
      ),
    ).toBe(false);
  });
  it("report receipts reject cross-tenant run bindings and deletion", async () => {
    const runId = randomUUID(),
      key = randomUUID();
    await admin.query("INSERT INTO report_runs VALUES($1,$2)", [runId, tenantA]);
    await transaction((tx) =>
      effects.freeze(tx as TenantTx, runId, [
        {
          effectKey: key,
          kind: "email",
          destinationId: null,
          request: { to: "test@example.test" },
          retryOnCrash: false,
        },
      ]),
    );
    expect(await transaction((tx) => effects.list(tx as TenantTx, runId), tenantB)).toEqual([]);
    await expect(
      transaction(
        (tx) =>
          effects.freeze(tx as TenantTx, runId, [
            {
              effectKey: randomUUID(),
              kind: "email",
              destinationId: null,
              request: {},
              retryOnCrash: false,
            },
          ]),
        tenantB,
      ),
    ).rejects.toThrow();
    await expect(
      transaction(
        (tx) =>
          tx.$queryRaw`DELETE FROM report_delivery_effects WHERE effect_key=${key} RETURNING effect_key`,
      ),
    ).rejects.toThrow();
  });
});
