import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { removeBetterAuthTestRows } from "../../helpers/better-auth-cleanup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAuthPrismaForTests } from "@atlas/db/auth-client";
import { withGlobalDb } from "@atlas/db/global-db";
import {
  changePasswordWithBetterAuth,
  establishSessionFromTokenHash,
  loginWithPassword,
  requestPasswordResetWithBetterAuth,
  requireBetterAuthUser,
  resetPasswordWithBetterAuth,
  setAtlasAuthForTests,
  signOutWithBetterAuth,
  signupWithPassword,
  type AuthEmail,
} from "@atlas/auth";
import { authRequestContext } from "@atlas/auth/better-auth-flows";
import { requireSessionUser, resolveSessionPrincipal } from "@atlas/api/session-user";

/**
 * Launch plan task 3.2 against Postgres, with AUTH_PROVIDER=better-auth: the
 * password flows the routes call, end to end through Better Auth and our
 * tables. Emails are captured, not sent; their tokens drive the next step.
 */

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const HOST = "academy.localhost.test";
const PASSWORD = "a-long-test-password";
const NEW_PASSWORD = "another-long-password";
const emailPrefix = "ba-flow-";
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
  return new Request(`http://${HOST}/api/v1/public/auth/test`, { method: "POST", headers });
}

/** The cookie pairs a response set, ready to send back, minus any it cleared. */
function cookieHeader(setCookies: string[]): string {
  return setCookies
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
}

function tokenOf(emails: AuthEmail[] | undefined, kind: AuthEmail["kind"]): string {
  const email = emails?.find((candidate) => candidate.kind === kind);
  if (!email) throw new Error(`no ${kind} email`);
  return email.token;
}

async function signUpAndVerify(email: string): Promise<{ cookie: string; principalId: string }> {
  const signup = await signupWithPassword({
    db: perStatement,
    input: { email, password: PASSWORD, displayName: "Test Learner" },
    req: request(),
  });
  const verified = await establishSessionFromTokenHash({
    db: perStatement,
    tokenHash: tokenOf(signup.emails, "verify-email"),
    type: "signup",
    req: request(),
  });
  if (!("setCookies" in verified.session)) throw new Error("expected Better Auth cookies");
  return {
    cookie: cookieHeader(verified.session.setCookies),
    principalId: await principalIdOf(email),
  };
}

/** The session-safe identity carries no id, so tests read it from the table. */
async function principalIdOf(email: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    "select id::text from auth_principals where email_normalized = $1",
    [email],
  );
  if (!rows[0]) throw new Error("no principal");
  return rows[0].id;
}

suite("Better Auth password flows", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: process.env.DATABASE_URL });
    await owner.connect();
    for (const key of ["AUTH_PROVIDER", "BETTER_AUTH_SECRET"]) savedEnv[key] = process.env[key];
    process.env["AUTH_PROVIDER"] = "better-auth";
    process.env["BETTER_AUTH_SECRET"] = randomBytes(32).toString("base64url");
  });

  beforeEach(() => {
    // A fresh instance and session cache for each test.
    setAtlasAuthForTests(undefined);
  });

  afterAll(async () => {
    await removeBetterAuthTestRows(owner, emailPrefix);
    await owner.end();
    // Restore the environment the suite started with.
    Object.assign(process.env, savedEnv);
    if (savedEnv["AUTH_PROVIDER"] === undefined) delete process.env["AUTH_PROVIDER"];
    if (savedEnv["BETTER_AUTH_SECRET"] === undefined) delete process.env["BETTER_AUTH_SECRET"];
    setAtlasAuthForTests(undefined);
    await closeAuthPrismaForTests();
  });

  it("signs up with a verification email, and its link signs the person in", async () => {
    const email = freshEmail();
    const signup = await signupWithPassword({
      db: perStatement,
      input: { email, password: PASSWORD, displayName: "Test Learner" },
      req: request(),
    });
    expect(signup.status).toBe("verification_required");
    expect(signup.emails).toEqual([
      { kind: "verify-email", email, token: expect.any(String) as string },
    ]);

    // Not before the address is proven (audit H6).
    await expect(
      loginWithPassword({ db: perStatement, input: { email, password: PASSWORD }, req: request() }),
    ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

    const verified = await establishSessionFromTokenHash({
      db: perStatement,
      tokenHash: tokenOf(signup.emails, "verify-email"),
      type: "signup",
      req: request(),
    });
    expect(verified.status).toBe("signed_in");
    expect(verified.identity.email).toBe(email);
    if (!("setCookies" in verified.session)) throw new Error("expected Better Auth cookies");
    const cookie = cookieHeader(verified.session.setCookies);
    expect(cookie).toMatch(/^atlas_session=/);

    const user = await requireSessionUser(request(cookie));
    expect(user).toMatchObject({
      provider: "better-auth",
      email,
      emailConfirmed: true,
      mfaEnabled: false,
      sessionAssuranceLevel: "aal1",
    });
    const principal = await resolveSessionPrincipal({ db: perStatement, user });
    expect(principal.id).toBe(await principalIdOf(email));
  });

  it("answers a sign-up for a registered address the same way, and sends nothing", async () => {
    const email = freshEmail();
    await signUpAndVerify(email);

    const again = await signupWithPassword({
      db: perStatement,
      input: { email, password: "a-different-password", displayName: "Someone Else" },
      req: request(),
    });
    expect(again).toMatchObject({ status: "verification_required", emails: [] });
  });

  it("signs in with the password, and refuses a wrong one", async () => {
    const email = freshEmail();
    await signUpAndVerify(email);

    const signedIn = await loginWithPassword({
      db: perStatement,
      input: { email, password: PASSWORD, rememberMe: true },
      req: request(),
    });
    expect(signedIn.identity.email).toBe(email);
    if (!("setCookies" in signedIn.session)) throw new Error("expected Better Auth cookies");
    expect(signedIn.session.setCookies.join("\n")).toMatch(/atlas_session=.+Max-Age=2592000/);

    await expect(
      loginWithPassword({
        db: perStatement,
        input: { email, password: "not-the-password" },
        req: request(),
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("claims an unclaimed placeholder when its owner signs up and verifies", async () => {
    const email = freshEmail();
    const placeholderId = randomUUID();
    await owner.query(
      `insert into auth_principals (id, supabase_user_id, email, email_normalized, global_status, updated_at)
       values ($1, $2, $3, $3, 'unclaimed', now())`,
      [placeholderId, randomUUID(), email],
    );

    const { principalId } = await signUpAndVerify(email);
    expect(principalId).toBe(placeholderId);
    const { rows } = await owner.query(
      "select global_status, email_verified from auth_principals where id = $1",
      [placeholderId],
    );
    expect(rows[0]).toEqual({ global_status: "active", email_verified: true });
  });

  it("resets a forgotten password from the emailed token and ends every session", async () => {
    const email = freshEmail();
    const { cookie, principalId } = await signUpAndVerify(email);

    const { emails } = await requestPasswordResetWithBetterAuth({
      ctx: authRequestContext(request()),
      email,
    });
    const reset = await resetPasswordWithBetterAuth({
      ctx: authRequestContext(request()),
      token: tokenOf(emails, "reset-password"),
      password: NEW_PASSWORD,
    });
    expect(reset).toEqual({ principalId, email });

    setAtlasAuthForTests(undefined);
    await expect(requireBetterAuthUser(request(cookie))).rejects.toMatchObject({ status: 401 });
    await expect(
      loginWithPassword({
        db: perStatement,
        input: { email, password: NEW_PASSWORD },
        req: request(),
      }),
    ).resolves.toMatchObject({ status: "signed_in" });

    // The token works once.
    await expect(
      resetPasswordWithBetterAuth({
        ctx: authRequestContext(request()),
        token: tokenOf(emails, "reset-password"),
        password: "yet-another-password",
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("sends no reset email for an unknown address, and answers the same", async () => {
    const { emails } = await requestPasswordResetWithBetterAuth({
      ctx: authRequestContext(request()),
      email: freshEmail(),
    });
    expect(emails).toEqual([]);
  });

  it("changes the password, keeps this session and ends the others", async () => {
    const email = freshEmail();
    const { cookie: here } = await signUpAndVerify(email);
    const elsewhere = await loginWithPassword({
      db: perStatement,
      input: { email, password: PASSWORD },
      req: request(),
    });
    if (!("setCookies" in elsewhere.session)) throw new Error("expected Better Auth cookies");
    const other = cookieHeader(elsewhere.session.setCookies);

    await changePasswordWithBetterAuth({
      ctx: authRequestContext(request(here)),
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    setAtlasAuthForTests(undefined);
    await expect(requireBetterAuthUser(request(here))).resolves.toMatchObject({ email });
    await expect(requireBetterAuthUser(request(other))).rejects.toMatchObject({ status: 401 });

    await expect(
      changePasswordWithBetterAuth({
        ctx: authRequestContext(request(here)),
        currentPassword: "not-the-password",
        newPassword: "yet-another-password",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("signs out by deleting the session", async () => {
    const { cookie, principalId } = await signUpAndVerify(freshEmail());
    await signOutWithBetterAuth({ ctx: authRequestContext(request(cookie)) });

    await expect(requireBetterAuthUser(request(cookie))).rejects.toMatchObject({ status: 401 });
    const { rows } = await owner.query(
      "select count(*)::int as n from auth_sessions where user_id = $1",
      [principalId],
    );
    expect(rows[0].n).toBe(0);
  });

  it("refuses a disabled principal's existing session on the next request", async () => {
    const { cookie, principalId } = await signUpAndVerify(freshEmail());
    const user = await requireSessionUser(request(cookie));
    await owner.query("update auth_principals set global_status = 'disabled' where id = $1", [
      principalId,
    ]);

    await expect(resolveSessionPrincipal({ db: perStatement, user })).rejects.toMatchObject({
      code: "ACCOUNT_DISABLED",
    });
  });
});
