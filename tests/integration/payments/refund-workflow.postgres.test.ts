import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import {
  reserveRefund,
  lockRefundOrder,
  listRefundIntents,
  findRefundRequest,
  claimRefund,
  type RefundTx,
  type RefundIntent,
  type RefundPayload,
} from "@atlas/domain/payments/refund-intents.repository";
import {
  processOneRefund,
  recordRefundOutcome,
  recordRefundWebhook,
  applyRefundLedger,
} from "@atlas/domain/payments/refund-workflow";
import type {
  PaymentProvider,
  RefundInput,
  RefundResult,
} from "@atlas/domain/payments/payment-provider";
import { paymentsRosterRepository } from "@atlas/domain/reports/payments-roster.repository";
import type { TenantTx } from "@atlas/db";

const connectionString = process.env.F07_TEST_DATABASE_URL;
const suite = connectionString ? describe : describe.skip;
const schema = `f07_test_${randomUUID().replaceAll("-", "")}`;
const tenantA = randomUUID(),
  tenantB = randomUUID(),
  gatewayId = randomUUID();
let admin: Client;
function adapter(db: Client): RefundTx {
  const sql = (parts: TemplateStringsArray) =>
    parts.reduce((all, part, index) => all + (index ? `$${index}` : "") + part, "");
  return {
    $queryRaw: async <T>(parts: TemplateStringsArray, ...values: unknown[]) =>
      (await db.query(sql(parts), values)).rows as T,
    $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) =>
      (await db.query(sql(parts), values)).rowCount ?? 0,
  };
}
async function transaction<T>(
  fn: (tx: RefundTx, db: Client) => Promise<T>,
  tenantId = tenantA,
): Promise<T> {
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`SET LOCAL search_path TO "${schema}",public`);
    await db.query("SET LOCAL ROLE atlas_app");
    await db.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    const result = await fn(adapter(db), db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}
async function order(amount = 1000, tenantId = tenantA) {
  const id = randomUUID(),
    membershipId = randomUUID(),
    courseId = randomUUID();
  await admin.query(
    "INSERT INTO payment_orders(id,tenant_id,amount_cents,currency,status,metadata_json,updated_at) VALUES ($1,$2,$3,'USD','paid','{}'::jsonb,now())",
    [id, tenantId, amount],
  );
  await admin.query("INSERT INTO enrollments VALUES($1,$2,$3,$4,'active')", [
    randomUUID(),
    tenantId,
    membershipId,
    courseId,
  ]);
  return { id, membershipId, courseId };
}
const payload: RefundPayload = {
  mode: "partial",
  reason: "customer_requested",
  note: "Test refund",
  revokeAccess: true,
  notifyLearner: false,
  actorMembershipId: randomUUID(),
  membershipId: null,
  courseId: null,
  refundMethod: "gateway",
};
async function reserve(
  orderId: string,
  amount: number,
  key = randomUUID(),
  details = payload,
): Promise<RefundIntent> {
  return transaction(async (tx, db) => {
    await lockRefundOrder(tx, orderId);
    const rows = await db.query(
      "SELECT amount_cents,metadata_json FROM payment_orders WHERE id=$1",
      [orderId],
    );
    const row = rows.rows[0] as {
      amount_cents: number;
      metadata_json: { refunds?: Array<{ amountCents: number }> };
    };
    const intents = await listRefundIntents(tx, orderId);
    const used = (row.metadata_json.refunds ?? []).reduce(
      (sum, refund) => sum + refund.amountCents,
      0,
    );
    const reserved = intents
      .filter((intent) =>
        ["requested", "processing", "pending", "reconciliation_required"].includes(intent.status),
      )
      .reduce((sum, intent) => sum + intent.amount_cents, 0);
    return reserveRefund(tx, {
      tenantId: tenantA,
      orderId,
      requestKey: key,
      fingerprint: `${orderId}:${amount}:${key}`,
      amountCents: amount,
      availableCents: row.amount_cents - used - reserved,
      currency: "USD",
      gatewayKey: "stripe",
      gatewayId,
      externalId: `cs_${orderId}`,
      payload: details,
    });
  });
}
function provider() {
  const external = new Map<string, RefundResult>();
  const refund = vi.fn(async (args: RefundInput) => {
    const result: RefundResult = {
      refundId: `re_${args.intentId}`,
      status: "succeeded",
      amountCents: args.amountCents,
      currency: "USD",
      externalId: args.externalId,
      intentId: args.intentId,
    };
    external.set(args.intentId, result);
    return result;
  });
  const findRefund = vi.fn(
    async (args: { intentId: string }) => external.get(args.intentId) ?? null,
  );
  const instance = { refund, findRefund } as unknown as PaymentProvider;
  return { external, refund, findRefund, instance };
}
async function expire(intent: RefundIntent) {
  await admin.query(
    "UPDATE payment_refund_intents SET lease_until=now()-interval '1 minute',next_attempt_at=now()-interval '1 minute' WHERE id=$1",
    [intent.id],
  );
}
async function state(id: string) {
  return (await admin.query("SELECT * FROM payment_refund_intents WHERE id=$1", [id]))
    .rows[0] as RefundIntent;
}

suite("F07 refund durability in isolated local Postgres", () => {
  beforeAll(async () => {
    if (
      !connectionString ||
      !["localhost", "127.0.0.1"].includes(new URL(connectionString).hostname)
    )
      throw new Error("Requires explicit local maintenance database");
    admin = new Client({ connectionString });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}",public`);
    await admin.query(
      "CREATE TABLE tenants(id uuid PRIMARY KEY); CREATE TABLE payment_orders(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,amount_cents int,currency text,status text,metadata_json jsonb,updated_at timestamptz); CREATE TABLE enrollments(id uuid PRIMARY KEY,tenant_id uuid,membership_id uuid,course_id uuid,status text)",
    );
    await admin.query(
      "ALTER TABLE payment_orders ADD membership_id uuid, ADD product_title text, ADD gateway_key text, ADD invoice_number text, ADD paid_at timestamptz, ADD created_at timestamptz DEFAULT now(), ADD external_id text; CREATE TABLE memberships(id uuid,tenant_id uuid,auth_principal_id uuid,invited_email_normalized text); CREATE TABLE member_profiles(membership_id uuid,tenant_id uuid,display_name text,deleted_at timestamptz); CREATE TABLE auth_principals(id uuid,email text)",
    );
    await admin.query("INSERT INTO tenants VALUES($1),($2)", [tenantA, tenantB]);
    await admin.query(
      readFileSync(
        "backend/prisma/migrations/20260920010000_108_refund_intents/migration.sql",
        "utf8",
      ),
    );
    await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO atlas_app,atlas_worker`);
    await admin.query("GRANT SELECT,UPDATE ON payment_orders,enrollments TO atlas_app");
    await admin.query("GRANT SELECT ON memberships,member_profiles,auth_principals TO atlas_app");
  });
  afterAll(async () => {
    if (admin) {
      if (!/^f07_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe cleanup schema");
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  });
  it("reserves only one of two concurrent oversized partial refunds", async () => {
    const payment = await order();
    const results = await Promise.allSettled([reserve(payment.id, 700), reserve(payment.id, 700)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
  it("deduplicates concurrent same-key requests permanently", async () => {
    const payment = await order();
    const key = randomUUID();
    const [first, second] = await Promise.all([
      reserve(payment.id, 600, key),
      reserve(payment.id, 600, key),
    ]);
    expect(first.id).toBe(second.id);
    await expect(reserve(payment.id, 500, key)).rejects.toThrow();
  });
  it("an intent rolled back with the request is never claimable", async () => {
    const payment = await order();
    const key = randomUUID();
    await expect(
      transaction(async (tx) => {
        await lockRefundOrder(tx, payment.id);
        await reserveRefund(tx, {
          tenantId: tenantA,
          orderId: payment.id,
          requestKey: key,
          fingerprint: key,
          amountCents: 100,
          availableCents: 1000,
          currency: "USD",
          gatewayKey: "stripe",
          gatewayId,
          externalId: "cs_test",
          payload,
        });
        throw new Error("request rollback");
      }),
    ).rejects.toThrow("request rollback");
    expect(await transaction((tx) => findRefundRequest(tx, key))).toBeNull();
  });
  it("tenant RLS denies reading or creating another tenant's intent", async () => {
    const payment = await order();
    const intent = await reserve(payment.id, 100);
    expect(await transaction((tx) => listRefundIntents(tx, payment.id), tenantB)).toEqual([]);
    const other = await order(1000, tenantB);
    await expect(
      transaction((tx) =>
        reserveRefund(tx, {
          tenantId: tenantB,
          orderId: other.id,
          requestKey: randomUUID(),
          fingerprint: "cross",
          amountCents: 100,
          availableCents: 1000,
          currency: "USD",
          gatewayKey: "stripe",
          gatewayId,
          externalId: "cs_other",
          payload,
        }),
      ),
    ).rejects.toThrow();
    expect((await state(intent.id)).tenant_id).toBe(tenantA);
  });
  it("timeout after gateway success reconciles once without another POST or early access change", async () => {
    // Pause other tests' pending work so this worker claims only this case.
    await admin.query("UPDATE payment_refund_intents SET next_attempt_at=now()+interval '1 day'");
    const payment = await order();
    const intent = await reserve(payment.id, 500, randomUUID(), {
      ...payload,
      membershipId: payment.membershipId,
      courseId: payment.courseId,
    });
    const gateway = provider();
    const success = gateway.refund.getMockImplementation();
    gateway.refund.mockImplementation(async (args) => {
      await success?.(args);
      throw new Error("timeout after success");
    });
    let inTransaction = false;
    const deps = {
      transaction: async <T>(fn: (tx: RefundTx) => Promise<T>) =>
        transaction(async (tx) => {
          inTransaction = true;
          try {
            return await fn(tx);
          } finally {
            inTransaction = false;
          }
        }),
      resolveProvider: async () => ({
        provider: gateway.instance,
        gatewayId,
        gatewayKey: "stripe",
      }),
    };
    gateway.refund.mockImplementation(async (args) => {
      expect(inTransaction).toBe(false);
      await success?.(args);
      throw new Error("timeout after success");
    });
    await processOneRefund(deps);
    expect((await state(intent.id)).status).toBe("reconciliation_required");
    expect(
      (
        await admin.query("SELECT status FROM enrollments WHERE membership_id=$1", [
          payment.membershipId,
        ])
      ).rows[0]?.status,
    ).toBe("active");
    await expire(intent);
    await processOneRefund(deps);
    expect(gateway.refund).toHaveBeenCalledTimes(1);
    expect(gateway.findRefund).toHaveBeenCalledTimes(1);
    expect((await state(intent.id)).status).toBe("succeeded");
    expect(
      (
        await admin.query("SELECT status FROM enrollments WHERE membership_id=$1", [
          payment.membershipId,
        ])
      ).rows[0]?.status,
    ).toBe("revoked");
  });
  it("a DB rollback after provider success is recovered by read-only reconciliation", async () => {
    await admin.query("UPDATE payment_refund_intents SET next_attempt_at=now()+interval '1 day'");
    const payment = await order();
    const intent = await reserve(payment.id, 1000);
    const gateway = provider();
    let calls = 0;
    const deps = {
      transaction: async <T>(fn: (tx: RefundTx) => Promise<T>) =>
        transaction(async (tx) => {
          const result = await fn(tx);
          calls++;
          if (calls === 2) throw new Error("outcome commit failure");
          return result;
        }),
      resolveProvider: async () => ({
        provider: gateway.instance,
        gatewayId,
        gatewayKey: "stripe",
      }),
    };
    await expect(processOneRefund(deps)).rejects.toThrow("outcome commit failure");
    expect((await state(intent.id)).status).toBe("processing");
    expect(
      (await admin.query("SELECT metadata_json FROM payment_orders WHERE id=$1", [payment.id]))
        .rows[0]?.metadata_json,
    ).toEqual({});
    await expire(intent);
    await processOneRefund(deps);
    expect(gateway.refund).toHaveBeenCalledTimes(1);
    expect((await state(intent.id)).status).toBe("succeeded");
  });
  it("editable webhook metadata only wakes ownership-checked reconciliation", async () => {
    await admin.query("UPDATE payment_refund_intents SET next_attempt_at=now()+interval '1 day'");
    const payment = await order();
    const intent = await reserve(payment.id, 300);
    await admin.query(
      "UPDATE payment_refund_intents SET status='reconciliation_required',next_attempt_at=now()+interval '1 day' WHERE id=$1",
      [intent.id],
    );
    const result: RefundResult = {
      refundId: `re_${intent.id}`,
      status: "succeeded",
      amountCents: 300,
      currency: "USD",
      externalId: intent.external_id ?? "",
      intentId: intent.id,
    };
    await Promise.all([
      transaction((tx) => recordRefundWebhook(tx, "stripe", gatewayId, result)),
      transaction((tx) => recordRefundWebhook(tx, "stripe", gatewayId, result)),
    ]);
    expect((await state(intent.id)).status).toBe("reconciliation_required");
    expect((await state(intent.id)).provider_refund_id).toBeNull();
    expect(
      (await admin.query("SELECT metadata_json FROM payment_orders WHERE id=$1", [payment.id]))
        .rows[0]?.metadata_json,
    ).toEqual({});
    const gateway = provider();
    const deps = {
      transaction,
      resolveProvider: async () => ({
        provider: gateway.instance,
        gatewayId,
        gatewayKey: "stripe",
      }),
    };
    await processOneRefund(deps);
    expect((await state(intent.id)).status).toBe("reconciliation_required");
    gateway.external.set(intent.id, result);
    await transaction((tx) => recordRefundWebhook(tx, "stripe", gatewayId, result));
    await processOneRefund(deps);
    await transaction((tx) =>
      recordRefundWebhook(tx, "stripe", gatewayId, { ...result, status: "pending" }),
    );
    const row = (
      await admin.query("SELECT metadata_json FROM payment_orders WHERE id=$1", [payment.id])
    ).rows[0] as { metadata_json: { refunds: unknown[] } };
    expect(row.metadata_json.refunds).toHaveLength(1);
    expect((await state(intent.id)).status).toBe("succeeded");
    expect(gateway.refund).not.toHaveBeenCalled();
    expect(gateway.findRefund).toHaveBeenCalledTimes(2);
  });
  it("refuses a fallback provider even when its ID matches", async () => {
    await admin.query("UPDATE payment_refund_intents SET next_attempt_at=now()+interval '1 day'");
    const payment = await order();
    const intent = await reserve(payment.id, 300);
    const gateway = provider();
    await processOneRefund({
      transaction,
      resolveProvider: async () => ({
        provider: gateway.instance,
        gatewayId,
        gatewayKey: "razorpay",
      }),
    });
    expect(gateway.refund).not.toHaveBeenCalled();
    expect(gateway.findRefund).not.toHaveBeenCalled();
    expect((await state(intent.id)).status).toBe("reconciliation_required");
  });
  it("confirmed provider failure releases balance without changing access", async () => {
    await admin.query("UPDATE payment_refund_intents SET next_attempt_at=now()+interval '1 day'");
    const payment = await order();
    const intent = await reserve(payment.id, 1000);
    const gateway = provider();
    gateway.refund.mockResolvedValue({
      refundId: "re_failed",
      status: "failed",
      amountCents: 1000,
      currency: "USD",
      externalId: intent.external_id ?? "",
      intentId: intent.id,
    });
    await processOneRefund({
      transaction,
      resolveProvider: async () => ({
        provider: gateway.instance,
        gatewayId,
        gatewayKey: "stripe",
      }),
    });
    expect((await state(intent.id)).status).toBe("failed");
    expect((await reserve(payment.id, 1000)).status).toBe("requested");
  });
  it("wrong gateway/amount results never alter the ledger", async () => {
    const payment = await order();
    const intent = await reserve(payment.id, 300);
    const result: RefundResult = {
      refundId: "re_invalid",
      status: "succeeded",
      amountCents: 999,
      currency: "USD",
      externalId: intent.external_id ?? "",
      intentId: intent.id,
    };
    expect(
      (await transaction((tx) => recordRefundWebhook(tx, "stripe", randomUUID(), result))).updated,
    ).toBe(false);
    await transaction((tx) => recordRefundOutcome(tx, intent, result));
    expect((await state(intent.id)).status).toBe("reconciliation_required");
  });
  it("manual adjustments are recorded once without invoking a provider", async () => {
    const payment = await order();
    const intent = await reserve(payment.id, 400, randomUUID(), {
      ...payload,
      refundMethod: "manual_adjustment",
      manualReference: "bank-ref-test",
    });
    await transaction(async (tx) => {
      await lockRefundOrder(tx, payment.id);
      await applyRefundLedger(tx, intent);
      await applyRefundLedger(tx, intent);
    });
    const row = (
      await admin.query("SELECT metadata_json FROM payment_orders WHERE id=$1", [payment.id])
    ).rows[0] as { metadata_json: { refunds: Array<{ fulfillment: string }> } };
    expect(row.metadata_json.refunds).toHaveLength(1);
    expect(row.metadata_json.refunds[0]?.fulfillment).toBe("manual_adjustment");
  });
  it("a claim lease is held by only one worker", async () => {
    await admin.query("UPDATE payment_refund_intents SET next_attempt_at=now()+interval '1 day'");
    const payment = await order();
    await reserve(payment.id, 200);
    const claims = await Promise.all([
      transaction((tx) => claimRefund(tx)),
      transaction((tx) => claimRefund(tx)),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
  it("ledger queues and totals subtract reservations and retain fully reserved orders", async () => {
    const payment = await order();
    const intent = await reserve(payment.id, 1000);
    await admin.query("UPDATE payment_orders SET invoice_number=$1 WHERE id=$2", [
      intent.id,
      payment.id,
    ]);
    const filter = { q: intent.id };
    const summary = await transaction((tx) =>
      paymentsRosterRepository.getRefundsQueueSummary(tx as TenantTx, filter),
    );
    expect(summary.refundable_amount_cents).toBe(0);
    expect(summary.refundable_count).toBe(0);
    expect(summary.refunded_count).toBe(0);
    expect(
      await transaction((tx) =>
        paymentsRosterRepository.countRefundLedger(tx as TenantTx, { ...filter, queue: "all" }),
      ),
    ).toBe(1);
    expect(
      await transaction((tx) =>
        paymentsRosterRepository.countRefundLedger(tx as TenantTx, {
          ...filter,
          queue: "refunded",
        }),
      ),
    ).toBe(0);
    const rows = await transaction((tx) =>
      paymentsRosterRepository.listRefundLedger(tx as TenantTx, {
        ...filter,
        queue: "all",
        sortBy: "created_at",
        sortDir: "desc",
        limit: 10,
        page: 1,
      }),
    );
    expect(rows[0]?.reserved_amount_cents).toBe(1000);
    expect(rows[0]?.refundable_amount_cents).toBe(0);
    expect(rows[0]?.refunded_amount_cents).toBe(0);
  });
});
