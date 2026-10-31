import { createHmac, randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authPrisma, closeAuthPrismaForTests } from "@atlas/db/auth-client";
import { ATLAS_SESSION_COOKIE, createAtlasAuth, type AtlasAuth } from "@atlas/auth/better-auth";

/**
 * Launch plan task 3.1 against Postgres: Better Auth, as configured in
 * `createAtlasAuth`, reads and writes our tables through the atlas_auth pool.
 * Signing up, signing in and two-factor all go through the field mapping in
 * docs/engineering/better-auth-design.md, so a mismatch fails here.
 */

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PASSWORD = "a-long-test-password";
const emailPrefix = "ba-schema-";
const freshEmail = () => `${emailPrefix}${randomUUID().slice(0, 12)}@Example.test`;

let owner: Client;
let auth: AtlasAuth;
let startedAt: Date;

function headersFor(host: string, cookie?: string): Headers {
  const headers = new Headers({ host, origin: `http://${host}` });
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

/** The cookie pairs a response sets, ready to send back. */
function cookiesFrom(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair): pair is string => Boolean(pair && !pair.endsWith("=")))
    .join("; ");
}

/** RFC 6238 TOTP for the secret in an otpauth:// URI, as an authenticator app computes it. */
function totpFromUri(uri: string): string {
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
  const value = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

/** Runs one statement as a group role, in its own transaction. */
async function queryAs(role: string, sql: string, values: unknown[] = []) {
  await owner.query("begin");
  try {
    await owner.query(`set local role ${role}`);
    return await owner.query(sql, values);
  } finally {
    await owner.query("rollback");
  }
}

async function signUpVerified(email: string) {
  const { user } = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: "Test Learner" },
    headers: headersFor("academy.localhost.test"),
  });
  // Email verification is task 3.2; here the address is confirmed directly.
  await owner.query("update auth_principals set email_verified = true where id = $1", [user.id]);
  return user;
}

async function signIn(email: string) {
  return auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: headersFor("academy.localhost.test"),
    returnHeaders: true,
  });
}

suite("Better Auth on the Atlas schema", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: process.env.DATABASE_URL });
    await owner.connect();
    startedAt = new Date();
    auth = createAtlasAuth({
      prisma: authPrisma(process.env.DATABASE_URL),
      secret: "integration-test-secret-at-least-32-characters",
      allowedHosts: ["academy.localhost.test"],
      protocol: "http",
    });
  });

  afterAll(async () => {
    await owner.query("delete from auth_principals where email_normalized like $1", [
      `${emailPrefix}%`,
    ]);
    await owner.query("delete from auth_verifications where created_at >= $1", [startedAt]);
    await owner.end();
    await closeAuthPrismaForTests();
  });

  it("signs up into auth_principals with a UUIDv7 id and the normalised email", async () => {
    const email = freshEmail();
    const { user } = await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name: "Test Learner" },
      headers: headersFor("academy.localhost.test"),
    });

    expect(user.id).toMatch(UUID_V7);
    const { rows } = await owner.query(
      `select email, email_normalized, name, email_verified, global_status, mfa_enabled,
              supabase_user_id
         from auth_principals where id = $1`,
      [user.id],
    );
    expect(rows[0]).toEqual({
      email: email.toLowerCase(),
      email_normalized: email.toLowerCase(),
      name: "Test Learner",
      email_verified: false,
      global_status: "active",
      mfa_enabled: false,
      supabase_user_id: null,
    });

    const accounts = await owner.query(
      "select provider_id, account_id, password from auth_accounts where user_id = $1",
      [user.id],
    );
    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]).toMatchObject({ provider_id: "credential", account_id: user.id });
    expect(accounts.rows[0].password).not.toContain(PASSWORD);
  });

  it("refuses to sign in before the email is verified", async () => {
    const email = freshEmail();
    await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name: "" },
      headers: headersFor("academy.localhost.test"),
    });

    await expect(signIn(email)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("signs in with an aal1 session in auth_sessions and the atlas_session cookie", async () => {
    const user = await signUpVerified(freshEmail());
    const { headers, response } = await signIn(user.email);

    expect(cookiesFrom(headers)).toMatch(new RegExp(`^${ATLAS_SESSION_COOKIE}=`));
    const { rows } = await owner.query(
      `select user_id, token, assurance_level, mfa_verified_at, expires_at
         from auth_sessions where user_id = $1`,
      [user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: user.id,
      token: response.token,
      assurance_level: "aal1",
      mfa_verified_at: null,
    });
    const days = (rows[0].expires_at.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);

    const session = await auth.api.getSession({
      headers: headersFor("academy.localhost.test", cookiesFrom(headers)),
    });
    expect(session?.user.id).toBe(user.id);
    expect(session?.session.assuranceLevel).toBe("aal1");
  });

  it("gives no session to a disabled principal", async () => {
    const user = await signUpVerified(freshEmail());
    await owner.query("update auth_principals set global_status = 'disabled' where id = $1", [
      user.id,
    ]);

    await expect(signIn(user.email)).rejects.toThrow();
    const { rows } = await owner.query(
      "select count(*)::int as n from auth_sessions where user_id = $1",
      [user.id],
    );
    expect(rows[0].n).toBe(0);
  });

  it("marks only a session that passed the authenticator as aal2", async () => {
    const user = await signUpVerified(freshEmail());
    const first = await signIn(user.email);
    const cookie = cookiesFrom(first.headers);

    const enabled = await auth.api.enableTwoFactor({
      body: { password: PASSWORD },
      headers: headersFor("academy.localhost.test", cookie),
    });
    const secrets = await owner.query(
      "select secret, backup_codes, verified from auth_two_factors where user_id = $1",
      [user.id],
    );
    expect(secrets.rows[0].verified).toBe(false);
    // Encrypted at rest: the secret in the authenticator URI is not stored as is.
    expect(enabled.totpURI).not.toContain(secrets.rows[0].secret);

    // Enrollment: the new factor's first code replaces the session with an aal2 one.
    const enrolled = await auth.api.verifyTOTP({
      body: { code: totpFromUri(enabled.totpURI) },
      headers: headersFor("academy.localhost.test", cookie),
      returnHeaders: true,
    });
    expect(enrolled.response.token).toBeTruthy();
    const principal = await owner.query("select mfa_enabled from auth_principals where id = $1", [
      user.id,
    ]);
    expect(principal.rows[0].mfa_enabled).toBe(true);

    // A password sign-in now stops at the challenge, with no session yet.
    const challenged = await signIn(user.email);
    expect(challenged.response).toMatchObject({ twoFactorRedirect: true });
    const beforeCode = await owner.query(
      "select count(*)::int as n from auth_sessions where user_id = $1 and created_at > now() - interval '5 seconds' and assurance_level = 'aal1'",
      [user.id],
    );
    expect(beforeCode.rows[0].n).toBe(0);

    const verified = await auth.api.verifyTOTP({
      body: { code: totpFromUri(enabled.totpURI) },
      headers: headersFor("academy.localhost.test", cookiesFrom(challenged.headers)),
      returnHeaders: true,
    });
    const { rows } = await owner.query(
      "select assurance_level, mfa_verified_at from auth_sessions where token = $1",
      [verified.response.token],
    );
    expect(rows[0].assurance_level).toBe("aal2");
    expect(rows[0].mfa_verified_at).toBeInstanceOf(Date);
  });

  it("keeps password hashes, secrets and tokens away from the tenant roles", async () => {
    for (const role of ["atlas_app", "atlas_worker"]) {
      for (const table of [
        "auth_sessions",
        "auth_accounts",
        "auth_verifications",
        "auth_two_factors",
      ]) {
        await expect(
          queryAs(role, `select 1 from ${table} limit 1`),
          `${role} ${table}`,
        ).rejects.toMatchObject({
          code: "42501",
        });
      }
    }
  });

  it("lets the platform role see session metadata but not the token", async () => {
    await expect(
      queryAs(
        "atlas_platform",
        "select id, user_id, assurance_level, expires_at from auth_sessions limit 1",
      ),
    ).resolves.toBeDefined();
    await expect(
      queryAs("atlas_platform", "select token from auth_sessions limit 1"),
    ).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      queryAs("atlas_platform", "select password from auth_accounts limit 1"),
    ).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("refuses to let Better Auth's role disable a principal", async () => {
    const user = await signUpVerified(freshEmail());
    await expect(
      queryAs("atlas_auth", "update auth_principals set global_status = 'disabled' where id = $1", [
        user.id,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
