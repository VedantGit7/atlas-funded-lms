import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAuthPrismaForTests } from "@atlas/db/auth-client";
import { withGlobalDb } from "@atlas/db/global-db";
import {
  changeEmailWithBetterAuth,
  establishSessionFromTokenHash,
  requestMagicLinkWithBetterAuth,
  requireBetterAuthUser,
  setAtlasAuthForTests,
  signupWithPassword,
  type AuthEmail,
} from "@atlas/auth";
import { authRequestContext } from "@atlas/auth/better-auth-flows";

/**
 * Launch plan task 3.4 against Postgres, with AUTH_PROVIDER=better-auth:
 * sign-in links and the two-step email change, through the same confirm
 * service the /auth/confirm page uses. Emails are captured, not sent.
 */

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const HOST = "academy.localhost.test";
const PASSWORD = "a-long-test-password";
const emailPrefix = "ba-links-";
const freshEmail = () => `${emailPrefix}${randomUUID().slice(0, 12)}@example.test`;

const perStatement = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

let owner: Client;
let startedAt: Date;
const savedEnv: Record<string, string | undefined> = {};

function request(cookie?: string): Request {
  const headers = new Headers({ host: HOST, "user-agent": "vitest" });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`http://${HOST}/api/v1/public/auth/confirm`, { method: "POST", headers });
}

function cookieHeader(setCookies: string[]): string {
  return setCookies
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
}

function only(emails: AuthEmail[] | undefined, kind: AuthEmail["kind"]): AuthEmail {
  const matching = emails?.filter((email) => email.kind === kind) ?? [];
  if (matching.length !== 1) throw new Error(`expected one ${kind} email, got ${matching.length}`);
  return matching[0] as AuthEmail;
}

async function verifiedUser(email: string): Promise<{ cookie: string }> {
  const signup = await signupWithPassword({
    db: perStatement,
    input: { email, password: PASSWORD, displayName: "Test Learner" },
    req: request(),
  });
  const verified = await establishSessionFromTokenHash({
    db: perStatement,
    tokenHash: only(signup.emails, "verify-email").token,
    type: "signup",
    req: request(),
  });
  if (verified.status !== "signed_in" || !("setCookies" in verified.session)) {
    throw new Error("expected a Better Auth sign-in");
  }
  return { cookie: cookieHeader(verified.session.setCookies) };
}

suite("Better Auth email links", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: process.env.DATABASE_URL });
    await owner.connect();
    startedAt = new Date();
    for (const key of ["AUTH_PROVIDER", "BETTER_AUTH_SECRET"]) savedEnv[key] = process.env[key];
    process.env["AUTH_PROVIDER"] = "better-auth";
    process.env["BETTER_AUTH_SECRET"] = randomBytes(32).toString("base64url");
  });

  beforeEach(() => {
    setAtlasAuthForTests(undefined);
  });

  afterAll(async () => {
    await owner.query("delete from auth_principals where email_normalized like $1", [
      `${emailPrefix}%`,
    ]);
    await owner.query("delete from auth_verifications where created_at >= $1", [startedAt]);
    await owner.end();
    Object.assign(process.env, savedEnv);
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
    }
    setAtlasAuthForTests(undefined);
    await closeAuthPrismaForTests();
  });

  it("signs in from an emailed link once, at aal1", async () => {
    const email = freshEmail();
    await verifiedUser(email);

    const { emails } = await requestMagicLinkWithBetterAuth({
      ctx: authRequestContext(request()),
      email,
    });
    const link = only(emails, "magic-link");
    expect(link.email).toBe(email);

    const signedIn = await establishSessionFromTokenHash({
      db: perStatement,
      tokenHash: link.token,
      type: "magiclink",
      req: request(),
    });
    if (signedIn.status !== "signed_in" || !("setCookies" in signedIn.session)) {
      throw new Error("expected a Better Auth sign-in");
    }
    expect(signedIn.identity.email).toBe(email);
    const user = await requireBetterAuthUser(request(cookieHeader(signedIn.session.setCookies)));
    expect(user).toMatchObject({ email, sessionAssuranceLevel: "aal1" });

    // Stored hashed, and it works once.
    const { rows } = await owner.query(
      "select count(*)::int as n from auth_verifications where identifier = $1",
      [link.token],
    );
    expect(rows[0].n).toBe(0);
    await expect(
      establishSessionFromTokenHash({
        db: perStatement,
        tokenHash: link.token,
        type: "magiclink",
        req: request(),
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("sends no link to an address without an account, and answers the same", async () => {
    const { emails } = await requestMagicLinkWithBetterAuth({
      ctx: authRequestContext(request()),
      email: freshEmail(),
    });
    expect(emails).toEqual([]);
  });

  it("refuses a sign-in link for a disabled principal", async () => {
    const email = freshEmail();
    await verifiedUser(email);
    const { emails } = await requestMagicLinkWithBetterAuth({
      ctx: authRequestContext(request()),
      email,
    });
    await owner.query(
      "update auth_principals set global_status = 'disabled' where email_normalized = $1",
      [email],
    );

    await expect(
      establishSessionFromTokenHash({
        db: perStatement,
        tokenHash: only(emails, "magic-link").token,
        type: "magiclink",
        req: request(),
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("changes the email only after the current address approves and the new one is verified", async () => {
    const email = freshEmail();
    const newEmail = freshEmail();
    const { cookie } = await verifiedUser(email);

    const started = await changeEmailWithBetterAuth({
      ctx: authRequestContext(request(cookie)),
      newEmail,
    });
    const approval = only(started.emails, "confirm-email-change");
    expect(approval).toMatchObject({ email, newEmail });
    expect(started.email).toBe(email);

    // Approving from the current address sends the new one its link, and changes nothing yet.
    const approved = await establishSessionFromTokenHash({
      db: perStatement,
      tokenHash: approval.token,
      type: "email_change",
      req: request(cookie),
    });
    if (approved.status !== "email_change_pending") throw new Error("expected a pending change");
    const verification = only(approved.emails, "verify-new-email");
    expect(verification.email).toBe(newEmail);
    let { rows } = await owner.query(
      "select email, email_normalized from auth_principals where email_normalized = $1",
      [email],
    );
    expect(rows).toHaveLength(1);

    const changed = await establishSessionFromTokenHash({
      db: perStatement,
      tokenHash: verification.token,
      type: "email_change",
      req: request(cookie),
    });
    expect(changed.status).toBe("signed_in");
    ({ rows } = await owner.query(
      "select email, email_normalized, email_verified from auth_principals where email_normalized = $1",
      [newEmail],
    ));
    expect(rows[0]).toEqual({ email: newEmail, email_normalized: newEmail, email_verified: true });
  });

  it("sends nothing for a change to an address that already has an account", async () => {
    const taken = freshEmail();
    await verifiedUser(taken);
    const { cookie } = await verifiedUser(freshEmail());

    const started = await changeEmailWithBetterAuth({
      ctx: authRequestContext(request(cookie)),
      newEmail: taken,
    });
    expect(started.emails).toEqual([]);
  });
});
