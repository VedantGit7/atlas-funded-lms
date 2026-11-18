import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { auditWriter } from "@atlas/audit";
import { withPlatformScope, withTenantTx, type TenantTx } from "@atlas/db";
import {
  runDueMemberErasures,
  type PendingObject,
} from "@atlas/domain/data-rights/member-erasure.runner";
import { memberErasureOutcomeSchema } from "@atlas/domain/data-rights/privacy-lifecycle.contract";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Launch plan 5.7, docs/engineering/member-erasure.md: a due deletion request
 * erases the member's personal data, keeps what the owner chose to keep, and
 * leaves the audit chain verifiable.
 */
const suite = process.env["DATABASE_URL"] ? describe : describe.skip;

function platformScope(tenantId: string) {
  return {
    principalId: randomUUID(),
    requestId: randomUUID(),
    requiredPermission: "platform.tenant.manage" as const,
    platformPermissions: ["platform.tenant.manage" as const],
    touchedTenantIds: [tenantId],
  };
}

function inTenant<T>(tenant: IsolationTenantFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(tenantCtx(tenant), fn);
}

async function count(tenant: IsolationTenantFixture, table: string, where: string, value: string) {
  return inTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ n: number }>>(
      `select count(*)::int as n from ${table} where ${where} = $1::uuid`,
      value,
    );
    return rows[0]?.n ?? -1;
  });
}

/** A member with a little of everything erasure treats differently. */
async function seedMember(tenant: IsolationTenantFixture) {
  const m = tenant.membershipId;
  const avatarKey = `tenants/${tenant.tenantId}/avatars/${randomUUID()}.png`;
  const postId = randomUUID();
  const contactEmail = `${tenant.slug}@example.test`;
  await inTenant(tenant, async (tx) => {
    await tx.$executeRaw`insert into member_profiles (id, tenant_id, membership_id, display_name, bio, updated_at)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${m}::uuid, 'Real Name', 'About me', now())`;
    await tx.$executeRaw`insert into storage_references (tenant_id, bucket, object_key, purpose, resource_type,
        resource_id, file_name, content_type, size_bytes, visibility, status)
      values (${tenant.tenantId}::uuid, 'test-bucket', ${avatarKey}, 'member.avatar', 'member_profile',
        ${m}::uuid, 'me.png', 'image/png', 10, 'public-safe', 'READY')`;
    // Deleted, and append-only: only an open erasure may remove these.
    await tx.$executeRaw`insert into point_ledger (id, tenant_id, membership_id, points, reason_key, idempotency_key)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${m}::uuid, 10, 'lesson', ${randomUUID()})`;
    await tx.$executeRaw`insert into notification_dispatches (id, tenant_id, membership_id, channel, idempotency_key, payload_json)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${m}::uuid, 'email', ${randomUUID()}, '{"to":"me"}'::jsonb)`;
    // Deleted.
    await tx.$executeRaw`insert into tenant_active_days (tenant_id, membership_id, day)
      values (${tenant.tenantId}::uuid, ${m}::uuid, current_date)`;
    await tx.$executeRaw`insert into device_sessions (id, tenant_id, membership_id, updated_at)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${m}::uuid, now())`;
    await tx.$executeRaw`insert into marketing_contacts (id, tenant_id, email)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${contactEmail})`;
    // Kept.
    await tx.$executeRaw`insert into posts (id, tenant_id, space_id, author_membership_id, body_json, updated_at)
      values (${postId}::uuid, ${tenant.tenantId}::uuid, ${tenant.communitySpaceId}::uuid, ${m}::uuid, '{"text":"hello"}'::jsonb, now())`;
    await tx.$executeRaw`insert into payment_orders (id, tenant_id, membership_id, amount_cents, status, updated_at)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${m}::uuid, 4900, 'paid', now())`;
    await tx.$executeRaw`insert into tenant_legal_acceptances (tenant_id, membership_id, source, accepted_at)
      values (${tenant.tenantId}::uuid, ${m}::uuid, 'signup', now())`;
    // Redacted.
    await auditWriter.write(
      tx,
      {
        tenantId: tenant.tenantId,
        actorMembershipId: m,
        platformPrincipalId: null,
        requestId: randomUUID(),
      },
      {
        action: "identity.profile.updated",
        target: { type: "membership", id: m },
        before: { displayName: "Old Name" },
        after: { displayName: "Real Name", email: contactEmail },
        reason: null,
        metadata: {},
      },
    );
    await tx.$executeRaw`insert into outbox_events (id, tenant_id, event_type, aggregate_type, aggregate_id, payload_json)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, 'membership.updated', 'membership', ${m}, ${JSON.stringify({ membershipId: m, email: contactEmail })}::jsonb)`;
  });
  return { avatarKey, postId };
}

async function requestDeletion(tenant: IsolationTenantFixture, due: boolean) {
  const id = randomUUID();
  await inTenant(tenant, async (tx) => {
    await tx.$executeRaw`insert into deletion_requests (id, tenant_id, requested_by_membership_id, target_type, target_id, status, scheduled_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${tenant.membershipId}::uuid, 'membership', ${tenant.membershipId},
        'QUEUED', now() + ${due ? "-1 minute" : "7 days"}::interval, now())`;
  });
  return id;
}

async function erase(tenant: IsolationTenantFixture, deleted: PendingObject[] = []) {
  return runDueMemberErasures(
    { tenantId: tenant.tenantId, requestId: randomUUID() },
    {
      deleteObject: (object) => {
        deleted.push(object);
        return Promise.resolve();
      },
    },
  );
}

suite("launch plan 5.7: member erasure (PostgreSQL)", () => {
  it("erases the member's data, keeps what the owner chose, and leaves the audit chain intact", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const { avatarKey, postId } = await seedMember(tenantA);
    const otherTenantPoints = await count(
      tenantB,
      "point_ledger",
      "membership_id",
      tenantB.membershipId,
    );
    const requestId = await requestDeletion(tenantA, true);
    const files: PendingObject[] = [];

    expect(await erase(tenantA, files)).toBe(1);

    const m = tenantA.membershipId;
    // Deleted, including append-only rows.
    for (const table of [
      "point_ledger",
      "notification_dispatches",
      "tenant_active_days",
      "device_sessions",
    ]) {
      expect(await count(tenantA, table, "membership_id", m), table).toBe(0);
    }
    expect(files).toEqual([{ bucket: "test-bucket", key: avatarKey }]);
    const leftovers = await inTenant(
      tenantA,
      (tx) =>
        tx.$queryRaw<Array<{ refs: number; contacts: number }>>`
        select (select count(*)::int from storage_references where resource_id = ${m}::uuid) as refs,
               (select count(*)::int from marketing_contacts where lower(email) = ${`${tenantA.slug}@example.test`}) as contacts`,
    );
    expect(leftovers).toEqual([{ refs: 0, contacts: 0 }]);

    // Kept, now pointing at an anonymised tombstone.
    expect(await count(tenantA, "payment_orders", "membership_id", m)).toBe(1);
    expect(await count(tenantA, "tenant_legal_acceptances", "membership_id", m)).toBe(1);
    const tombstone = await inTenant(
      tenantA,
      (tx) =>
        tx.$queryRaw<Array<Record<string, unknown>>>`
        select m.status::text as status, m.auth_principal_id, m.erased_at is not null as erased,
               mp.display_name, mp.bio, p.author_membership_id::text as post_author
        from memberships m
        join member_profiles mp on mp.membership_id = m.id
        join posts p on p.id = ${postId}::uuid
        where m.id = ${m}::uuid`,
    );
    expect(tombstone).toEqual([
      {
        status: "REMOVED",
        auth_principal_id: null,
        erased: true,
        display_name: "Deleted member",
        bio: null,
        post_author: m,
      },
    ]);

    // Redacted, and the chain still verifies.
    const redacted = await inTenant(
      tenantA,
      (tx) =>
        tx.$queryRaw<Array<{ audit: unknown; outbox: unknown }>>`
        select (select after_json from audit_entries where target_id = ${m} and action = 'identity.profile.updated') as audit,
               (select payload_json from outbox_events where aggregate_id = ${m} and event_type = 'membership.updated') as outbox`,
    );
    expect(redacted).toEqual([{ audit: { redacted: true }, outbox: { redacted: true } }]);
    const chain = await withPlatformScope(
      platformScope(tenantA.tenantId),
      "Verifying the audit chain after an erasure",
      (tx) =>
        tx.$queryRaw<
          Array<{ valid: boolean }>
        >`select valid from app.verify_audit_chain(${tenantA.tenantId}::uuid, 100000)`,
    );
    expect(chain).toEqual([{ valid: true }]);

    // The login account was only used here, so it is gone.
    const principal = await withPlatformScope(
      platformScope(tenantA.tenantId),
      "Checking the erased account",
      (tx) =>
        tx.$queryRaw<
          Array<{ n: number }>
        >`select count(*)::int as n from auth_principals where id = ${tenantA.principalId}::uuid`,
    );
    expect(principal).toEqual([{ n: 0 }]);

    // The request records a version 2 outcome.
    const request = await inTenant(
      tenantA,
      (tx) =>
        tx.$queryRaw<Array<{ status: string; outcome_json: unknown }>>`
        select status::text as status, outcome_json from deletion_requests where id = ${requestId}::uuid`,
    );
    expect(request[0]?.status).toBe("SUCCEEDED");
    const outcome = memberErasureOutcomeSchema.parse(request[0]?.outcome_json);
    expect(outcome).toMatchObject({ account: "deleted", files: { deleted: 1, failed: 0 } });
    expect(outcome.deleted).toMatchObject({ point_ledger: 1, notification_dispatches: 1 });
    expect(outcome.auditEntriesRedacted).toBeGreaterThanOrEqual(1);

    // Another academy is untouched.
    expect(await count(tenantB, "point_ledger", "membership_id", tenantB.membershipId)).toBe(
      otherTenantPoints,
    );

    // Running again changes nothing and finds nothing due.
    expect(await erase(tenantA)).toBe(0);
  });

  it("keeps the login account when another academy still uses it", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seedMember(tenantA);
    // The same person also belongs to the other academy.
    const otherMembership = randomUUID();
    await withPlatformScope(
      platformScope(tenantB.tenantId),
      "Adding a second academy membership",
      (tx) =>
        tx.$executeRaw`insert into memberships (id, tenant_id, auth_principal_id, status, joined_at, created_at, updated_at)
        values (${otherMembership}::uuid, ${tenantB.tenantId}::uuid, ${tenantA.principalId}::uuid, 'ACTIVE', now(), now(), now())`,
    );
    const requestId = await requestDeletion(tenantA, true);

    expect(await erase(tenantA)).toBe(1);

    const principal = await withPlatformScope(
      platformScope(tenantA.tenantId),
      "Checking the shared account",
      (tx) =>
        tx.$queryRaw<
          Array<{ n: number }>
        >`select count(*)::int as n from auth_principals where id = ${tenantA.principalId}::uuid`,
    );
    expect(principal).toEqual([{ n: 1 }]);
    const request = await inTenant(
      tenantA,
      (tx) =>
        tx.$queryRaw<
          Array<{ outcome_json: unknown }>
        >`select outcome_json from deletion_requests where id = ${requestId}::uuid`,
    );
    expect(memberErasureOutcomeSchema.parse(request[0]?.outcome_json).account).toBe(
      "kept_for_other_academies",
    );
    // The other academy's membership is untouched.
    expect(await count(tenantB, "memberships", "id", otherMembership)).toBe(1);
  });

  it("waits for the request to be due", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedMember(tenantA);
    await requestDeletion(tenantA, false);
    expect(await erase(tenantA)).toBe(0);
    expect(await count(tenantA, "point_ledger", "membership_id", tenantA.membershipId)).toBe(1);
  });

  it("refuses to erase the academy owner, and says why", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await inTenant(tenantA, async (tx) => {
      const roleId = randomUUID();
      await tx.$executeRaw`insert into roles (id, tenant_id, key, name, is_system, updated_at)
        values (${roleId}::uuid, ${tenantA.tenantId}::uuid, 'owner', 'Owner', true, now())`;
      await tx.$executeRaw`insert into user_roles (id, tenant_id, membership_id, role_id)
        values (${randomUUID()}::uuid, ${tenantA.tenantId}::uuid, ${tenantA.membershipId}::uuid, ${roleId}::uuid)`;
    });
    const requestId = await requestDeletion(tenantA, true);
    expect(await erase(tenantA)).toBe(0);
    const request = await inTenant(
      tenantA,
      (tx) =>
        tx.$queryRaw<Array<{ status: string; outcome_json: unknown }>>`
        select status::text as status, outcome_json from deletion_requests where id = ${requestId}::uuid`,
    );
    expect(request).toEqual([
      {
        status: "FAILED",
        outcome_json: { version: 2, operation: "erase_member", error: "ACADEMY_OWNER" },
      },
    ]);
  });

  it("keeps append-only tables append-only outside an erasure, for the application role", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedMember(tenantA);
    await expect(
      inTenant(
        tenantA,
        (tx) =>
          tx.$executeRaw`delete from point_ledger where tenant_id = ${tenantA.tenantId}::uuid`,
      ),
    ).rejects.toThrow(/append-only/);
    // The application can't open an erasure itself...
    await expect(
      inTenant(
        tenantA,
        (tx) => tx.$executeRaw`insert into member_erasures (tenant_id, membership_id, txid)
        values (${tenantA.tenantId}::uuid, ${tenantA.membershipId}::uuid, txid_current())`,
      ),
    ).rejects.toThrow(/permission denied/);
    // ...nor erase a member without a due request.
    await expect(
      inTenant(
        tenantA,
        (tx) =>
          tx.$queryRaw`select app.erase_member(${tenantA.tenantId}::uuid, ${tenantA.membershipId}::uuid, ${randomUUID()}::uuid)`,
      ),
    ).rejects.toThrow(/no due deletion request/);
  });
});
