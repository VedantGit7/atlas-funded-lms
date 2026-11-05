import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withGlobalDb } from "@atlas/db/global-db";
import { findActiveSessionPrincipal } from "@atlas/auth";

/**
 * Audit H6 against Postgres: only the platform plane disables or re-enables an
 * account. The tenant roles (and Better Auth's own role, which writes the same
 * table) may create active or unclaimed principals and claim a placeholder,
 * and the database refuses anything else from them. A disabled principal gets
 * no session.
 */

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const emailPrefix = "h6-guard-";
const freshEmail = () => `${emailPrefix}${randomUUID().slice(0, 12)}@example.test`;

const perStatement = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

let owner: Client;

/** A principal written as the database owner, as a platform decision would be. */
async function principal(status: "active" | "unclaimed" | "disabled"): Promise<string> {
  const id = randomUUID();
  const email = freshEmail();
  await owner.query(
    `insert into auth_principals (id, email, email_normalized, global_status, updated_at)
     values ($1, $2, $2, $3, now())`,
    [id, email, status],
  );
  return id;
}

suite("auth principal guard (audit H6)", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: process.env.DATABASE_URL });
    await owner.connect();
  });

  afterAll(async () => {
    await owner.query("delete from auth_principals where email_normalized like $1", [
      `${emailPrefix}%`,
    ]);
    await owner.end();
  });

  it("refuses to disable or re-enable an account from atlas_app", async () => {
    const active = await principal("active");
    await expect(
      withGlobalDb(
        (db) =>
          db.$executeRaw`update auth_principals set global_status = 'disabled' where id = ${active}::uuid`,
      ),
    ).rejects.toThrow(/set by the platform plane/);

    const disabled = await principal("disabled");
    await expect(
      withGlobalDb(
        (db) =>
          db.$executeRaw`update auth_principals set global_status = 'active' where id = ${disabled}::uuid`,
      ),
    ).rejects.toThrow(/set by the platform plane/);
  });

  it("refuses to create a disabled account from atlas_app", async () => {
    const email = freshEmail();
    await expect(
      withGlobalDb(
        (db) =>
          db.$executeRaw`
          insert into auth_principals (id, email, email_normalized, global_status, updated_at)
          values (${randomUUID()}::uuid, ${email}, ${email}, 'disabled', now())
        `,
      ),
    ).rejects.toThrow(/set by the platform plane/);
  });

  it("lets atlas_app claim an unclaimed placeholder", async () => {
    const placeholder = await principal("unclaimed");
    await withGlobalDb(
      (db) =>
        db.$executeRaw`update auth_principals set global_status = 'active' where id = ${placeholder}::uuid`,
    );
    const { rows } = await owner.query("select global_status from auth_principals where id = $1", [
      placeholder,
    ]);
    expect(rows[0]).toEqual({ global_status: "active" });
  });

  it("gives a disabled or unclaimed account no session principal", async () => {
    await expect(
      findActiveSessionPrincipal({ db: perStatement, principalId: await principal("disabled") }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED", status: 403 });
    await expect(
      findActiveSessionPrincipal({ db: perStatement, principalId: await principal("unclaimed") }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });
    await expect(
      findActiveSessionPrincipal({ db: perStatement, principalId: randomUUID() }),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
  });
});
