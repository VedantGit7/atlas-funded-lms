import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { removeBetterAuthTestRows } from "../../helpers/better-auth-cleanup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAuthPrismaForTests } from "@atlas/db/auth-client";
import { withGlobalDb } from "@atlas/db/global-db";
import {
  disableTwoFactor,
  enableTwoFactor,
  establishSessionFromTokenHash,
  listTwoFactorFactors,
  loginWithPassword,
  requestMagicLinkWithBetterAuth,
  requireBetterAuthUser,
  setAtlasAuthForTests,
  signupWithPassword,
  verifySecondFactor,
  type AuthEmail,
} from "@atlas/auth";
import { authRequestContext } from "@atlas/auth/better-auth-flows";

/**
 * Launch plan task 3.5 against Postgres, with AUTH_PROVIDER=better-auth:
 * setting up an authenticator, the sign-in challenge, backup codes, step-up
 * and removal, and the session assurance F01 relies on.
 */

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const HOST = "academy.localhost.test";
const PASSWORD = "a-long-test-password";
const emailPrefix = "ba-2fa-";
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
  return new Request(`http://${HOST}/api/v1/me/security/mfa`, { method: "POST", headers });
}

function ctx(cookie?: string) {
  return authRequestContext(request(cookie));
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

/** RFC 6238 TOTP for the secret in an otpauth:// URI, as an authenticator app computes it. */
function totp(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret") ?? "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function signedInUser(email: string): Promise<{ cookie: string }> {
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

/** A user with a verified authenticator; returns its URI, backup codes and an aal2 cookie. */
async function enrolledUser(email: string) {
  const { cookie } = await signedInUser(email);
  const enabled = await enableTwoFactor({ ctx: ctx(cookie), password: PASSWORD });
  const verified = await verifySecondFactor({ ctx: ctx(cookie), code: totp(enabled.uri) });
  return { ...enabled, cookie: cookieHeader(verified.cookies.setCookies) };
}

suite("Better Auth two-factor", () => {
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

  it("asks an account with a password to confirm it before setting up an authenticator", async () => {
    const { cookie } = await signedInUser(freshEmail());

    await expect(enableTwoFactor({ ctx: ctx(cookie) })).rejects.toMatchObject({ status: 400 });
    await expect(
      enableTwoFactor({ ctx: ctx(cookie), password: "not-the-password" }),
    ).rejects.toMatchObject({ status: 400 });

    const enabled = await enableTwoFactor({ ctx: ctx(cookie), password: PASSWORD });
    expect(enabled.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(enabled.backupCodes).toHaveLength(10);
    expect(await listTwoFactorFactors({ ctx: ctx(cookie) })).toEqual([
      {
        id: enabled.factorId,
        factorType: "totp",
        status: "unverified",
        friendlyName: "Authenticator app",
      },
    ]);
  });

  it("finishes setup with the app's code and leaves an aal2 session (audit H4)", async () => {
    const email = freshEmail();
    const { factorId, cookie } = await enrolledUser(email);

    expect(await requireBetterAuthUser(request(cookie))).toMatchObject({
      mfaEnabled: true,
      sessionAssuranceLevel: "aal2",
    });
    expect(await listTwoFactorFactors({ ctx: ctx(cookie) })).toEqual([
      expect.objectContaining({ id: factorId, status: "verified" }),
    ]);
    const { rows } = await owner.query(
      "select mfa_enabled from auth_principals where email_normalized = $1",
      [email],
    );
    expect(rows[0].mfa_enabled).toBe(true);
  });

  it("stops a password sign-in at the challenge, then the code gives aal2", async () => {
    const email = freshEmail();
    const { uri } = await enrolledUser(email);

    const challenged = await loginWithPassword({
      db: perStatement,
      input: { email, password: PASSWORD },
      req: request(),
    });
    expect(challenged.identity.mfaEnabled).toBe(true);
    if (!("setCookies" in challenged.session)) throw new Error("expected Better Auth cookies");
    const pending = cookieHeader(challenged.session.setCookies);
    expect(pending).not.toMatch(/atlas_session=/);

    await expect(verifySecondFactor({ ctx: ctx(pending), code: "000000" })).rejects.toMatchObject({
      status: 400,
    });
    const verified = await verifySecondFactor({ ctx: ctx(pending), code: totp(uri) });
    expect(
      await requireBetterAuthUser(request(cookieHeader(verified.cookies.setCookies))),
    ).toMatchObject({ email, sessionAssuranceLevel: "aal2" });
  });

  it("accepts a backup code once in place of the app", async () => {
    const email = freshEmail();
    const { backupCodes } = await enrolledUser(email);
    const backupCode = backupCodes[0] ?? "";

    const signIn = async () => {
      const challenged = await loginWithPassword({
        db: perStatement,
        input: { email, password: PASSWORD },
        req: request(),
      });
      if (!("setCookies" in challenged.session)) throw new Error("expected Better Auth cookies");
      return cookieHeader(challenged.session.setCookies);
    };

    const verified = await verifySecondFactor({ ctx: ctx(await signIn()), code: backupCode });
    expect(
      await requireBetterAuthUser(request(cookieHeader(verified.cookies.setCookies))),
    ).toMatchObject({ sessionAssuranceLevel: "aal2" });
    await expect(
      verifySecondFactor({ ctx: ctx(await signIn()), code: backupCode }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("steps an aal1 session up to aal2 in place, keeping its cookie", async () => {
    const email = freshEmail();
    const { uri } = await enrolledUser(email);
    // A sign-in link starts an aal1 session even for an account with an authenticator.
    const { emails } = await requestMagicLinkWithBetterAuth({ ctx: ctx(), email });
    const signedIn = await establishSessionFromTokenHash({
      db: perStatement,
      tokenHash: only(emails, "magic-link").token,
      type: "magiclink",
      req: request(),
    });
    if (signedIn.status !== "signed_in" || !("setCookies" in signedIn.session)) {
      throw new Error("expected a Better Auth sign-in");
    }
    const cookie = cookieHeader(signedIn.session.setCookies);
    expect(await requireBetterAuthUser(request(cookie))).toMatchObject({
      sessionAssuranceLevel: "aal1",
    });

    const stepped = await verifySecondFactor({ ctx: ctx(cookie), code: totp(uri) });
    expect(stepped.cookies.setCookies).toEqual([]);
    expect(await requireBetterAuthUser(request(cookie))).toMatchObject({
      sessionAssuranceLevel: "aal2",
    });
    const { rows } = await owner.query(
      `select s.assurance_level, s.mfa_verified_at from auth_sessions s
         join auth_principals p on p.id = s.user_id
        where p.email_normalized = $1 and s.assurance_level = 'aal2'`,
      [email],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].mfa_verified_at).toBeInstanceOf(Date);
  });

  it("removes the authenticator only from an aal2 session", async () => {
    const email = freshEmail();
    const { cookie: aal2 } = await enrolledUser(email);
    const { emails } = await requestMagicLinkWithBetterAuth({ ctx: ctx(), email });
    const signedIn = await establishSessionFromTokenHash({
      db: perStatement,
      tokenHash: only(emails, "magic-link").token,
      type: "magiclink",
      req: request(),
    });
    if (signedIn.status !== "signed_in" || !("setCookies" in signedIn.session)) {
      throw new Error("expected a Better Auth sign-in");
    }

    await expect(
      disableTwoFactor({ ctx: ctx(cookieHeader(signedIn.session.setCookies)) }),
    ).rejects.toMatchObject({ code: "MFA_REQUIRED", status: 403 });

    await disableTwoFactor({ ctx: ctx(aal2) });
    expect(await listTwoFactorFactors({ ctx: ctx(aal2) })).toEqual([]);
    const { rows } = await owner.query(
      "select mfa_enabled from auth_principals where email_normalized = $1",
      [email],
    );
    expect(rows[0].mfa_enabled).toBe(false);
    // Signing in no longer stops at a challenge.
    const signIn = await loginWithPassword({
      db: perStatement,
      input: { email, password: PASSWORD },
      req: request(),
    });
    expect(signIn.identity.mfaEnabled).toBe(false);
  });
});
