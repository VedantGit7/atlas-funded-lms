import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withGlobalDb } from "@atlas/db/global-db";
import { withPlatformScope, type PlatformTx } from "@atlas/db";
import { upsertAuthPrincipal } from "@atlas/auth";
import { findActivePlatformOperator } from "@atlas/auth/platform-operators.repository";

/**
 * Audit H6 against Postgres: the sign-in path never moves a principal to a
 * different Supabase user, never creates or claims one for an unconfirmed
 * email, refuses disabled accounts, and the database itself refuses the same
 * moves from the tenant roles.
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

/** The sign-in routes' connection mode: each statement commits on its own. */
const perStatement = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

type PrincipalRow = {
  id: string;
  supabase_user_id: string;
  global_status: string;
  updated_at: Date;
  last_login_at: Date | null;
};

const freshEmail = () => `h6-res-${randomUUID().slice(0, 12)}@example.test`;

async function readPrincipal(email: string): Promise<PrincipalRow | undefined> {
  const rows = await withGlobalDb(
    (db) =>
      db.$queryRaw<PrincipalRow[]>`
      select id::text, supabase_user_id::text, global_status, updated_at, last_login_at
      from auth_principals where email_normalized = ${email}
    `,
  );
  return rows[0];
}

async function relinkRequests(principalId: string) {
  return withGlobalDb(
    (db) =>
      db.$queryRaw<
        Array<{ requested_supabase_user_id: string; status: string; attempt_count: number }>
      >`
      select requested_supabase_user_id::text, status, attempt_count
      from auth_principal_relink_requests where auth_principal_id = ${principalId}::uuid
    `,
  );
}

suite("principal resolution (audit H6)", () => {
  let operatorId: string;

  const asPlatform = <T>(fn: (tx: PlatformTx) => Promise<T>) =>
    withPlatformScope(
      {
        principalId: operatorId,
        requestId: randomUUID(),
        requiredPermission: "platform.identity.manage",
        platformPermissions: ["platform.identity.manage"],
      },
      "H6 integration test fixture setup",
      fn,
    );

  afterAll(async () => {
    await removeIdentityEvidence("h6-res-");
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

  it("creates a principal only for a confirmed email", async () => {
    const email = freshEmail();
    await expect(
      upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: randomUUID(),
        email,
        emailConfirmed: false,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(await readPrincipal(email)).toBeUndefined();

    const supabaseUserId = randomUUID();
    const created = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId,
      email: email.toUpperCase(),
      emailConfirmed: true,
    });
    expect(created).toMatchObject({ emailNormalized: email, globalStatus: "active" });
    expect((await readPrincipal(email))?.supabase_user_id).toBe(supabaseUserId);
  });

  it("writes nothing on a repeat request unless something changed", async () => {
    const email = freshEmail();
    const supabaseUserId = randomUUID();
    const first = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId,
      email,
      emailConfirmed: true,
    });
    const before = await readPrincipal(email);

    const again = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId,
      email,
      emailConfirmed: true,
    });
    expect(again.id).toBe(first.id);
    expect((await readPrincipal(email))?.updated_at).toEqual(before?.updated_at);

    await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId,
      email,
      emailConfirmed: true,
      markLogin: true,
    });
    expect((await readPrincipal(email))?.last_login_at).not.toBeNull();
  });

  it("never moves an account to another Supabase user, and records the attempt for review", async () => {
    const email = freshEmail();
    const original = randomUUID();
    const principal = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId: original,
      email,
      emailConfirmed: true,
    });

    const newcomer = randomUUID();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        upsertAuthPrincipal({
          db: perStatement,
          supabaseUserId: newcomer,
          email,
          emailConfirmed: true,
        }),
      ).rejects.toMatchObject({ code: "ACCOUNT_REVIEW_REQUIRED", status: 409 });
    }

    expect((await readPrincipal(email))?.supabase_user_id).toBe(original);
    expect(await relinkRequests(principal.id)).toEqual([
      { requested_supabase_user_id: newcomer, status: "pending", attempt_count: 2 },
    ]);
  });

  it("does not even record an attempt from an unconfirmed email", async () => {
    const email = freshEmail();
    const principal = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId: randomUUID(),
      email,
      emailConfirmed: true,
    });
    await expect(
      upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: randomUUID(),
        email,
        emailConfirmed: false,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(await relinkRequests(principal.id)).toEqual([]);
  });

  it("lets the first confirmed sign-in claim an unclaimed placeholder", async () => {
    const email = freshEmail();
    const placeholderId = randomUUID();
    await withGlobalDb(
      (db) =>
        db.$executeRaw`
        insert into auth_principals (id, supabase_user_id, email, email_normalized, global_status, updated_at)
        values (${placeholderId}::uuid, ${randomUUID()}::uuid, ${email}, ${email}, 'unclaimed', now())
      `,
    );

    const owner = randomUUID();
    await expect(
      upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: owner,
        email,
        emailConfirmed: false,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

    const claimed = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId: owner,
      email,
      emailConfirmed: true,
    });
    expect(claimed).toMatchObject({ id: placeholderId, globalStatus: "active" });
    expect((await readPrincipal(email))?.supabase_user_id).toBe(owner);

    // Claimed once: a second newcomer is a relink, not another claim.
    await expect(
      upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: randomUUID(),
        email,
        emailConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_REVIEW_REQUIRED" });
  });

  it("never lets a sign-in claim a placeholder that carries a platform grant", async () => {
    const email = freshEmail();
    const placeholderId = randomUUID();
    await withGlobalDb(
      (db) =>
        db.$executeRaw`
        insert into auth_principals (id, supabase_user_id, email, email_normalized, global_status, updated_at)
        values (${placeholderId}::uuid, ${randomUUID()}::uuid, ${email}, ${email}, 'unclaimed', now())
      `,
    );
    await asPlatform(
      (tx) =>
        tx.$executeRaw`
        insert into platform_operators (auth_principal_id, role_key, granted_by_principal_id, grant_reason)
        values (${placeholderId}::uuid, 'support', ${operatorId}::uuid, 'H6 integration fixture')
      `,
    );

    await expect(
      upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: randomUUID(),
        email,
        emailConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_REVIEW_REQUIRED" });
    expect((await readPrincipal(email))?.global_status).toBe("unclaimed");
  });

  it("refuses a disabled account, and its platform grant confers nothing", async () => {
    const email = freshEmail();
    const supabaseUserId = randomUUID();
    const principal = await upsertAuthPrincipal({
      db: perStatement,
      supabaseUserId,
      email,
      emailConfirmed: true,
    });
    await asPlatform(async (tx) => {
      await tx.$executeRaw`
        insert into platform_operators (auth_principal_id, role_key, granted_by_principal_id, grant_reason)
        values (${principal.id}::uuid, 'support', ${operatorId}::uuid, 'H6 integration fixture')
      `;
    });
    expect(await withGlobalDb((db) => findActivePlatformOperator(db, principal.id))).not.toBeNull();

    await asPlatform(
      (tx) =>
        tx.$executeRaw`update auth_principals set global_status = 'disabled' where id = ${principal.id}::uuid`,
    );

    await expect(
      upsertAuthPrincipal({ db: perStatement, supabaseUserId, email, emailConfirmed: true }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED", status: 403 });
    expect(await withGlobalDb((db) => findActivePlatformOperator(db, principal.id))).toBeNull();
  });

  describe("database guard on the tenant roles", () => {
    it("refuses to re-point or disable an account from atlas_app", async () => {
      const email = freshEmail();
      const principal = await upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: randomUUID(),
        email,
        emailConfirmed: true,
      });

      await expect(
        withGlobalDb(
          (db) =>
            db.$executeRaw`update auth_principals set supabase_user_id = ${randomUUID()}::uuid where id = ${principal.id}::uuid`,
        ),
      ).rejects.toThrow(/relinking requires platform review/);
      await expect(
        withGlobalDb(
          (db) =>
            db.$executeRaw`update auth_principals set global_status = 'disabled' where id = ${principal.id}::uuid`,
        ),
      ).rejects.toThrow(/set by the platform plane/);
      await expect(
        withGlobalDb(
          (db) =>
            db.$executeRaw`
            insert into auth_principals (id, supabase_user_id, email, email_normalized, global_status, updated_at)
            values (${randomUUID()}::uuid, ${randomUUID()}::uuid, ${freshEmail()}, ${freshEmail()}, 'disabled', now())
          `,
        ),
      ).rejects.toThrow(/set by the platform plane/);
    });

    it("lets atlas_app record a relink attempt but never decide one", async () => {
      const email = freshEmail();
      const principal = await upsertAuthPrincipal({
        db: perStatement,
        supabaseUserId: randomUUID(),
        email,
        emailConfirmed: true,
      });
      await expect(
        upsertAuthPrincipal({
          db: perStatement,
          supabaseUserId: randomUUID(),
          email,
          emailConfirmed: true,
        }),
      ).rejects.toMatchObject({ code: "ACCOUNT_REVIEW_REQUIRED" });

      await expect(
        withGlobalDb(
          (db) =>
            db.$executeRaw`
            update auth_principal_relink_requests
               set status = 'approved', decided_at = now(), decision_reason = 'self-approval attempt'
             where auth_principal_id = ${principal.id}::uuid
          `,
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
});
