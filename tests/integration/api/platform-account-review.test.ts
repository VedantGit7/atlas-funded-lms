import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withGlobalDb } from "@atlas/db/global-db";
import { withPlatformScope, type PlatformTx } from "@atlas/db";
import { upsertAuthPrincipal } from "@atlas/auth";

const supabase = vi.hoisted(() => ({
  users: new Map<string, { email: string; emailConfirmed: boolean }>(),
}));

// Supabase Auth is the one external system here: stand in for its admin API.
vi.mock("@atlas/auth/supabase-admin-users", () => ({
  inspectSupabaseUser: vi.fn(async (id: string) => {
    const user = supabase.users.get(id);
    return user ? { exists: true, ...user } : { exists: false };
  }),
}));

import {
  approveRelinkRequest,
  listPendingRelinkRequests,
  lookupPlatformAccount,
  rejectRelinkRequest,
  setPlatformAccountStatus,
} from "../../../backend/apps/api/src/server/platform-identity/account-review.service";

/**
 * Audit H6: the platform decision path. A relink moves the principal only when
 * the earlier Supabase user is gone and the new one holds the same confirmed
 * email; platform grants are revoked, never carried; every decision is audited.
 */
/**
 * Relink requests and platform grants are evidence the test cleanup will not
 * delete by cascade (it refuses to remove a still-referenced principal), so
 * this suite removes its own, as the database owner.
 */
async function removeIdentityEvidence(emailPrefix: string): Promise<void> {
  const owner = new Client({ connectionString: process.env.DATABASE_URL });
  await owner.connect();
  try {
    await owner.query(
      `delete from auth_principal_relink_requests r using auth_principals p
        where p.id = r.auth_principal_id and p.email_normalized like $1`,
      [`${emailPrefix}%`],
    );
    await owner.query(
      `delete from platform_operators o using auth_principals p
        where p.id = o.auth_principal_id and p.email_normalized like $1`,
      [`${emailPrefix}%`],
    );
  } finally {
    await owner.end();
  }
}

const suite =
  process.env.DATABASE_URL && process.env.PLATFORM_DATABASE_URL ? describe : describe.skip;

const perStatement = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

const freshEmail = () => `h6-review-${randomUUID().slice(0, 12)}@example.test`;

suite("platform account review (audit H6)", () => {
  let operatorId: string;
  const ctx = () => ({ platformPrincipalId: operatorId, requestId: randomUUID() });
  const asPlatform = <T>(fn: (tx: PlatformTx) => Promise<T>) =>
    withPlatformScope(
      {
        principalId: operatorId,
        requestId: randomUUID(),
        requiredPermission: "platform.identity.manage",
        platformPermissions: ["platform.identity.manage"],
      },
      "H6 account review integration test",
      fn,
    );

  /** An account held by `original`, plus a refused sign-in from `newcomer`. */
  async function blockedReRegistration(options: { grant?: boolean } = {}) {
    const email = freshEmail();
    const original = randomUUID();
    const newcomer = randomUUID();
    const principal = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId: original,
      email,
      emailConfirmed: true,
    });
    if (options.grant) {
      await asPlatform(
        (tx) =>
          tx.$executeRaw`
          insert into platform_operators (auth_principal_id, role_key, granted_by_principal_id, grant_reason)
          values (${principal.id}::uuid, 'support', ${operatorId}::uuid, 'H6 review fixture')
        `,
      );
    }
    await expect(
      upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: newcomer,
        email,
        emailConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_REVIEW_REQUIRED" });
    const listed = await asPlatform((tx) => listPendingRelinkRequests(tx));
    const request = listed.data.find((entry) => entry.principalId === principal.id);
    if (!request) throw new Error("relink request was not recorded");
    return { email, original, newcomer, principal, request };
  }

  async function auditActions(principalId: string) {
    const rows = await asPlatform(
      (tx) =>
        tx.$queryRaw<Array<{ action: string; reason: string | null }>>`
        select action, metadata_json->>'reason' as reason from audit_entries
         where target_id = ${principalId} order by occurred_at
      `,
    );
    return rows;
  }

  afterAll(async () => {
    await removeIdentityEvidence("h6-review-");
  });

  beforeAll(async () => {
    const operator = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId: randomUUID(),
      email: freshEmail(),
      emailConfirmed: true,
    });
    operatorId = operator.id;
  });

  beforeEach(() => {
    supabase.users.clear();
  });

  it("lists the refused sign-in with what is at stake", async () => {
    const { request, email } = await blockedReRegistration({ grant: true });
    expect(request).toMatchObject({
      email,
      accountStatus: "active",
      attemptCount: 1,
      platformRole: "support",
    });
  });

  it("refuses to approve while the earlier sign-in still exists", async () => {
    const { request, original, newcomer, email } = await blockedReRegistration();
    supabase.users.set(original, { email, emailConfirmed: true });
    supabase.users.set(newcomer, { email, emailConfirmed: true });

    await expect(
      asPlatform((tx) =>
        approveRelinkRequest(tx, ctx(), request.id, { reason: "Ticket SUP-1: lost access" }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to approve unless the new sign-in holds the same confirmed email", async () => {
    const { request, newcomer, email } = await blockedReRegistration();
    supabase.users.set(newcomer, { email, emailConfirmed: false });
    await expect(
      asPlatform((tx) =>
        approveRelinkRequest(tx, ctx(), request.id, { reason: "Ticket SUP-2: re-registered" }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    supabase.users.set(newcomer, { email: freshEmail(), emailConfirmed: true });
    await expect(
      asPlatform((tx) =>
        approveRelinkRequest(tx, ctx(), request.id, { reason: "Ticket SUP-2: re-registered" }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("moves the account, revokes its platform grant, supersedes siblings and audits", async () => {
    const { request, principal, newcomer, email } = await blockedReRegistration({ grant: true });
    const sibling = randomUUID();
    await expect(
      upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: sibling,
        email,
        emailConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_REVIEW_REQUIRED" });
    supabase.users.set(newcomer, { email, emailConfirmed: true });

    const result = await asPlatform((tx) =>
      approveRelinkRequest(tx, ctx(), request.id, {
        reason: "Ticket SUP-3: account deleted and re-registered",
      }),
    );
    expect(result.data).toEqual({
      id: request.id,
      status: "approved",
      principalId: principal.id,
      platformGrantRevoked: true,
    });

    // The new sign-in now resolves to the original account, without its grant.
    const resolved = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId: newcomer,
      email,
      emailConfirmed: true,
    });
    expect(resolved.id).toBe(principal.id);

    const states = await asPlatform(
      (tx) =>
        tx.$queryRaw<Array<{ requested_supabase_user_id: string; status: string }>>`
        select requested_supabase_user_id::text, status from auth_principal_relink_requests
         where auth_principal_id = ${principal.id}::uuid
      `,
    );
    expect(Object.fromEntries(states.map((s) => [s.requested_supabase_user_id, s.status]))).toEqual(
      {
        [newcomer]: "approved",
        [sibling]: "superseded",
      },
    );

    const grants = await asPlatform(
      (tx) =>
        tx.$queryRaw<Array<{ revoked_at: Date | null }>>`
        select revoked_at from platform_operators where auth_principal_id = ${principal.id}::uuid
      `,
    );
    expect(grants.every((grant) => grant.revoked_at !== null)).toBe(true);

    expect(await auditActions(principal.id)).toContainEqual({
      action: "platform.identity.relink_approved",
      reason: "Ticket SUP-3: account deleted and re-registered",
    });

    await expect(
      asPlatform((tx) =>
        approveRelinkRequest(tx, ctx(), request.id, { reason: "Ticket SUP-3: approve again" }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a request and leaves the account where it was", async () => {
    const { request, principal, original, newcomer, email } = await blockedReRegistration();
    await asPlatform((tx) =>
      rejectRelinkRequest(tx, ctx(), request.id, { reason: "Ticket SUP-4: not the owner" }),
    );

    await expect(
      upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: newcomer,
        email,
        emailConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_REVIEW_REQUIRED" });
    const resolved = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId: original,
      email,
      emailConfirmed: true,
    });
    expect(resolved.id).toBe(principal.id);
    expect(await auditActions(principal.id)).toContainEqual({
      action: "platform.identity.relink_rejected",
      reason: "Ticket SUP-4: not the owner",
    });
  });

  it("disables and re-enables an account, audited, and never the operator's own", async () => {
    const email = freshEmail();
    const supabaseUserId = randomUUID();
    const principal = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId,
      email,
      emailConfirmed: true,
    });

    expect((await asPlatform((tx) => lookupPlatformAccount(tx, email))).data).toMatchObject({
      id: principal.id,
      status: "active",
    });

    const disabled = await asPlatform((tx) =>
      setPlatformAccountStatus(tx, ctx(), principal.id, {
        status: "disabled",
        reason: "Ticket SUP-5: compromised account",
      }),
    );
    expect(disabled.data.status).toBe("disabled");
    await expect(
      upsertAuthPrincipal({ db: perStatement, supabaseUserId, email, emailConfirmed: true }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });

    await asPlatform((tx) =>
      setPlatformAccountStatus(tx, ctx(), principal.id, {
        status: "active",
        reason: "Ticket SUP-5: owner verified, restored",
      }),
    );
    await expect(
      upsertAuthPrincipal({ db: perStatement, supabaseUserId, email, emailConfirmed: true }),
    ).resolves.toMatchObject({ id: principal.id });

    expect((await auditActions(principal.id)).map((entry) => entry.action)).toEqual([
      "platform.identity.status_changed",
      "platform.identity.status_changed",
    ]);

    await expect(
      asPlatform((tx) =>
        setPlatformAccountStatus(tx, ctx(), operatorId, {
          status: "disabled",
          reason: "Ticket SUP-6: self-lockout attempt",
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("returns nothing for an email no account uses", async () => {
    expect((await asPlatform((tx) => lookupPlatformAccount(tx, freshEmail()))).data).toBeNull();
  });
});
