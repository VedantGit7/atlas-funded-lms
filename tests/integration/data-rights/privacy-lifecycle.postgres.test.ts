import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import { processDeletionRequest } from "@atlas/domain/data-rights/data-rights.service";
import { removeMembershipRecord } from "@atlas/membership/member-admin.repository";

const controls = vi.hoisted(() => ({ failAudit: false }));
vi.mock("@atlas/membership", () => ({
  removeMember: async (tx: TenantTx, ctx: { tenantId: string }, id: string) => {
    const result = await removeMembershipRecord({ tx, tenantId: ctx.tenantId, membershipId: id });
    if (!result) throw new Error("Membership not removable");
  },
}));
vi.mock("@atlas/audit", () => ({
  auditWriter: {
    write: async (tx: TenantTx) => {
      if (controls.failAudit) throw new Error("Audit unavailable");
      await tx.$executeRaw`insert into privacy_test_audit (id) values (${randomUUID()}::uuid)`;
    },
  },
}));

const connectionString = process.env["F14_TEST_DATABASE_URL"];
const suite = connectionString ? describe : describe.skip;
const schema = `f14_test_${randomUUID().replaceAll("-", "")}`;
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

async function fixture() {
  const tenant = randomUUID(),
    otherTenant = randomUUID(),
    member = randomUUID(),
    otherMember = randomUUID(),
    principal = randomUUID(),
    request = randomUUID();
  await admin.query("insert into privacy_test_principals values($1,'shared@example.test')", [
    principal,
  ]);
  await admin.query(
    "insert into memberships(id,tenant_id,principal_id,status) values($1,$2,$3,'ACTIVE'),($4,$5,$3,'ACTIVE')",
    [member, tenant, principal, otherMember, otherTenant],
  );
  await admin.query("insert into privacy_test_profiles values($1,$2,'Retained name')", [
    member,
    tenant,
  ]);
  await admin.query(
    "insert into deletion_requests(id,tenant_id,requested_by_membership_id,target_type,target_id,status) values($1,$2,$3::uuid,'membership',$3::uuid::text,'QUEUED')",
    [request, tenant, member],
  );
  return { tenant, otherTenant, member, otherMember, principal, request };
}

suite("F14 isolated PostgreSQL migration and privacy outcomes", () => {
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
      create table memberships(id uuid primary key, tenant_id uuid, principal_id uuid, status text, removed_at timestamptz, updated_at timestamptz default now());
      create table privacy_test_profiles(membership_id uuid, tenant_id uuid, display_name text);
      create table privacy_test_principals(id uuid primary key, email text);
      create table privacy_test_audit(id uuid primary key);
      create table deletion_requests(id uuid primary key, tenant_id uuid, requested_by_membership_id uuid, target_type text, target_id text, status text, reason text, scheduled_at timestamptz, completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
    `);
    await admin.query(
      readFileSync(
        "backend/prisma/migrations/20260920030000_111_privacy_outcomes/migration.sql",
        "utf8",
      ),
    );
  });
  afterAll(async () => {
    if (admin) {
      await admin.query(`drop schema if exists "${schema}" cascade`);
      await admin.end();
    }
  });

  it("keeps unknown outcomes NULL and rejects scalar evidence", async () => {
    const f = await fixture();
    expect(
      (await admin.query("select outcome_json from deletion_requests where id=$1", [f.request]))
        .rows[0].outcome_json,
    ).toBeNull();
    await expect(
      admin.query("update deletion_requests set outcome_json='true'::jsonb where id=$1", [
        f.request,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("persists access removal while retaining profile, other-school membership and shared identity", async () => {
    const f = await fixture();
    const result = await transaction(f.tenant, (tx) =>
      processDeletionRequest(
        tx,
        { tenantId: f.tenant, actorMembershipId: f.member, requestId: randomUUID() },
        f.request,
        { confirm: true },
      ),
    );
    expect(result.data.outcome?.erasure).toBe("not_performed");
    expect(
      (await admin.query("select status from memberships where id=$1", [f.member])).rows[0].status,
    ).toBe("REMOVED");
    expect(
      (await admin.query("select status from memberships where id=$1", [f.otherMember])).rows[0]
        .status,
    ).toBe("ACTIVE");
    expect(
      (
        await admin.query("select display_name from privacy_test_profiles where membership_id=$1", [
          f.member,
        ])
      ).rows[0].display_name,
    ).toBe("Retained name");
    expect(
      (await admin.query("select email from privacy_test_principals where id=$1", [f.principal]))
        .rows[0].email,
    ).toBe("shared@example.test");
    expect(
      (await admin.query("select outcome_json from deletion_requests where id=$1", [f.request]))
        .rows[0].outcome_json,
    ).toEqual(result.data.outcome);
  });

  it("rolls back removal and evidence together if the completion audit fails", async () => {
    const f = await fixture();
    controls.failAudit = true;
    try {
      await expect(
        transaction(f.tenant, (tx) =>
          processDeletionRequest(
            tx,
            { tenantId: f.tenant, actorMembershipId: f.member, requestId: randomUUID() },
            f.request,
            { confirm: true },
          ),
        ),
      ).rejects.toThrow("Audit unavailable");
    } finally {
      controls.failAudit = false;
    }
    expect(
      (
        await admin.query("select status,outcome_json from deletion_requests where id=$1", [
          f.request,
        ])
      ).rows[0],
    ).toEqual({ status: "QUEUED", outcome_json: null });
    expect(
      (await admin.query("select status from memberships where id=$1", [f.member])).rows[0].status,
    ).toBe("ACTIVE");
  });

  it("serializes concurrent processing and replays the recorded result", async () => {
    const f = await fixture();
    const before = Number(
      (await admin.query("select count(*) from privacy_test_audit")).rows[0].count,
    );
    const run = () =>
      transaction(f.tenant, (tx) =>
        processDeletionRequest(
          tx,
          { tenantId: f.tenant, actorMembershipId: f.member, requestId: randomUUID() },
          f.request,
          { confirm: true },
        ),
      );
    const [first, second] = await Promise.all([run(), run()]);
    expect(first.data.outcome).toEqual(second.data.outcome);
    expect(
      Number((await admin.query("select count(*) from privacy_test_audit")).rows[0].count),
    ).toBe(before + 1);
  });

  it("denies another tenant without touching the requested membership", async () => {
    const f = await fixture();
    await expect(
      transaction(f.otherTenant, (tx) =>
        processDeletionRequest(
          tx,
          { tenantId: f.otherTenant, actorMembershipId: f.otherMember, requestId: randomUUID() },
          f.request,
          { confirm: true },
        ),
      ),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(
      (await admin.query("select status from memberships where id=$1", [f.member])).rows[0].status,
    ).toBe("ACTIVE");
  });
});
