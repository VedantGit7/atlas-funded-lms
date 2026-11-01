import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { removeBetterAuthTestRows } from "../../helpers/better-auth-cleanup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAuthPrismaForTests } from "@atlas/db/auth-client";
import { withGlobalDb } from "@atlas/db/global-db";
import {
  createAccountFromInvitation,
  establishSessionFromTokenHash,
  invitedAccountState,
  loginWithPassword,
  requireBetterAuthUser,
  setAtlasAuthForTests,
  signupWithPassword,
  type AuthEmail,
} from "@atlas/auth";
import { authRequestContext } from "@atlas/auth/better-auth-flows";

/**
 * Launch plan task 3.6 against Postgres, with AUTH_PROVIDER=better-auth: an
 * invitee with no account sets a password and is signed in; an address that
 * can already sign in is asked to; a placeholder gets its first login method.
 */

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const HOST = "academy.localhost.test";
const PASSWORD = "a-long-test-password";
const emailPrefix = "ba-invite-";
const freshEmail = () => `${emailPrefix}${randomUUID().slice(0, 12)}@example.test`;

const perStatement = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

let owner: Client;
const savedEnv: Record<string, string | undefined> = {};

function request(cookie?: string): Request {
  const headers = new Headers({ host: HOST, "user-agent": "vitest" });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`http://${HOST}/api/v1/public/invitations/set-password`, {
    method: "POST",
    headers,
  });
}

function cookieHeader(setCookies: string[]): string {
  return setCookies
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
}

function only(emails: AuthEmail[] | undefined, kind: AuthEmail["kind"]): AuthEmail {
  const email = emails?.find((candidate) => candidate.kind === kind);
  if (!email) throw new Error(`no ${kind} email`);
  return email;
}

suite("Better Auth invitations", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: process.env.DATABASE_URL });
    await owner.connect();
    for (const key of ["AUTH_PROVIDER", "BETTER_AUTH_SECRET"]) savedEnv[key] = process.env[key];
    process.env["AUTH_PROVIDER"] = "better-auth";
    process.env["BETTER_AUTH_SECRET"] = randomBytes(32).toString("base64url");
  });

  beforeEach(() => {
    setAtlasAuthForTests(undefined);
  });

  afterAll(async () => {
    await removeBetterAuthTestRows(owner, emailPrefix);
    await owner.end();
    Object.assign(process.env, savedEnv);
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
    }
    setAtlasAuthForTests(undefined);
    await closeAuthPrismaForTests();
  });

  it("creates a verified account with the chosen password and signs the invitee in", async () => {
    const email = freshEmail();
    expect(await invitedAccountState(email)).toBe("none");

    const created = await createAccountFromInvitation({
      ctx: authRequestContext(request()),
      email,
      password: PASSWORD,
    });

    const user = await requireBetterAuthUser(request(cookieHeader(created.cookies.setCookies)));
    expect(user).toMatchObject({ principalId: created.principalId, email, emailConfirmed: true });
    expect(await invitedAccountState(email)).toBe("exists");
    await expect(
      loginWithPassword({ db: perStatement, input: { email, password: PASSWORD }, req: request() }),
    ).resolves.toMatchObject({ status: "signed_in" });
  });

  it("asks an address that can already sign in to sign in, and keeps its password", async () => {
    const email = freshEmail();
    const signup = await signupWithPassword({
      db: perStatement,
      input: { email, password: PASSWORD, displayName: "Existing" },
      req: request(),
    });
    await establishSessionFromTokenHash({
      db: perStatement,
      tokenHash: only(signup.emails, "verify-email").token,
      type: "signup",
      req: request(),
    });

    await expect(
      createAccountFromInvitation({
        ctx: authRequestContext(request()),
        email,
        password: "someone-elses-password",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      loginWithPassword({ db: perStatement, input: { email, password: PASSWORD }, req: request() }),
    ).resolves.toMatchObject({ status: "signed_in" });
  });

  it("gives an unclaimed placeholder its first login method, and claims it", async () => {
    const email = freshEmail();
    const placeholderId = randomUUID();
    await owner.query(
      `insert into auth_principals (id, supabase_user_id, email, email_normalized, global_status, updated_at)
       values ($1, $2, $3, $3, 'unclaimed', now())`,
      [placeholderId, randomUUID(), email],
    );
    expect(await invitedAccountState(email)).toBe("none");

    const created = await createAccountFromInvitation({
      ctx: authRequestContext(request()),
      email,
      password: PASSWORD,
    });

    expect(created.principalId).toBe(placeholderId);
    const { rows } = await owner.query(
      "select global_status, email_verified from auth_principals where id = $1",
      [placeholderId],
    );
    expect(rows[0]).toEqual({ global_status: "active", email_verified: true });
  });
});
