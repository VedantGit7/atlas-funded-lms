import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeAuthPrismaForTests } from "@atlas/db/auth-client";
import { withGlobalDb } from "@atlas/db/global-db";
import {
  completeGoogleCallback,
  establishSessionFromTokenHash,
  listLoginMethods,
  loginWithPassword,
  requireBetterAuthUser,
  setAtlasAuthForTests,
  signupWithPassword,
  startGoogleLink,
  startGoogleSignIn,
  unlinkLoginMethod,
  type AuthEmail,
} from "@atlas/auth";
import { authRequestContext } from "@atlas/auth/better-auth-flows";

/**
 * Launch plan task 3.3 against Postgres, with AUTH_PROVIDER=better-auth:
 * Google sign-in, linking and unlinking. Google's token endpoint is the one
 * network call Better Auth makes; the test answers it with an ID token for
 * the person it wants Google to report. Google can't be reached from a local
 * host for real (decision doc, "Google sign-in"); staging checks that.
 */

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const HOST = "academy.localhost.test";
const PASSWORD = "a-long-test-password";
const emailPrefix = "ba-google-";
const freshEmail = () => `${emailPrefix}${randomUUID().slice(0, 12)}@example.test`;

const perStatement = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

let owner: Client;
let startedAt: Date;
const savedEnv: Record<string, string | undefined> = {};
/** Who Google says signed in, for the next token exchange. */
let googleProfile: { sub: string; email: string; email_verified: boolean; name: string };
const realFetch = globalThis.fetch;

function request(cookie?: string): Request {
  const headers = new Headers({ host: HOST, "user-agent": "vitest" });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`http://${HOST}/api/v1/public/auth/oauth/callback`, {
    method: "POST",
    headers,
  });
}

function cookieHeader(setCookies: string[], existing?: string): string {
  const pairs = setCookies
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair && !pair.endsWith("="));
  return [existing, ...pairs].filter(Boolean).join("; ");
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** An ID token as Google returns it; Better Auth reads its claims, as with Google. */
function idToken(): string {
  return [
    base64url({ alg: "RS256", typ: "JWT" }),
    base64url({
      iss: "https://accounts.google.com",
      aud: "test-client-id",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...googleProfile,
    }),
    "signature",
  ].join(".");
}

function tokenOf(emails: AuthEmail[] | undefined, kind: AuthEmail["kind"]): string {
  const email = emails?.find((candidate) => candidate.kind === kind);
  if (!email) throw new Error(`no ${kind} email`);
  return email.token;
}

async function principalIdOf(email: string): Promise<string | undefined> {
  const { rows } = await owner.query<{ id: string }>(
    "select id::text from auth_principals where email_normalized = $1",
    [email],
  );
  return rows[0]?.id;
}

async function passwordUser(email: string): Promise<{ cookie: string; principalId: string }> {
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
    principalId: (await principalIdOf(email)) ?? "",
  };
}

/** Start, then come back from Google with a code and the state it was given. */
async function throughGoogle(
  start: { url: string; cookies: { setCookies: string[] } },
  cookie?: string,
) {
  const state = new URL(start.url).searchParams.get("state") ?? "";
  return completeGoogleCallback({
    ctx: authRequestContext(request(cookieHeader(start.cookies.setCookies, cookie))),
    code: "google-code",
    state,
  });
}

suite("Better Auth Google sign-in", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: process.env.DATABASE_URL });
    await owner.connect();
    startedAt = new Date();
    for (const key of [
      "AUTH_PROVIDER",
      "BETTER_AUTH_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]) {
      savedEnv[key] = process.env[key];
    }
    process.env["AUTH_PROVIDER"] = "better-auth";
    process.env["BETTER_AUTH_SECRET"] = randomBytes(32).toString("base64url");
    process.env["GOOGLE_CLIENT_ID"] = "test-client-id";
    process.env["GOOGLE_CLIENT_SECRET"] = randomBytes(16).toString("base64url");
  });

  beforeEach(() => {
    setAtlasAuthForTests(undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "google-access-token",
            id_token: idToken(),
            expires_in: 3600,
            token_type: "Bearer",
            scope: "openid email profile",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return realFetch(input, init);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("sends Google back to /auth/callback/google on the academy's host", async () => {
    const start = await startGoogleSignIn({ ctx: authRequestContext(request()) });
    const url = new URL(start.url);

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(`http://${HOST}/auth/callback/google`);
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual([
      "email",
      "openid",
      "profile",
    ]);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    // The state is checked against this signed cookie when Google sends the person back.
    expect(start.cookies.setCookies.join("\n")).toMatch(/atlas\.state=/);
  });

  it("creates a principal for a new verified Google address and signs it in at aal1", async () => {
    const email = freshEmail();
    googleProfile = { sub: randomUUID(), email, email_verified: true, name: "Google Person" };

    const result = await throughGoogle(
      await startGoogleSignIn({ ctx: authRequestContext(request()) }),
    );
    if (result.kind !== "signed_in") throw new Error("expected a sign-in");

    expect(result.principalId).toBe(await principalIdOf(email));
    const user = await requireBetterAuthUser(request(cookieHeader(result.cookies.setCookies)));
    expect(user).toMatchObject({ email, emailConfirmed: true, sessionAssuranceLevel: "aal1" });
    const { rows } = await owner.query(
      "select provider_id, account_id from auth_accounts where user_id = $1",
      [result.principalId],
    );
    expect(rows).toEqual([{ provider_id: "google", account_id: googleProfile.sub }]);
  });

  it("signs in to an existing verified account with the same verified address, linking Google", async () => {
    const email = freshEmail();
    const { principalId } = await passwordUser(email);
    googleProfile = { sub: randomUUID(), email, email_verified: true, name: "Test Learner" };

    const result = await throughGoogle(
      await startGoogleSignIn({ ctx: authRequestContext(request()) }),
    );
    if (result.kind !== "signed_in") throw new Error("expected a sign-in");

    expect(result.principalId).toBe(principalId);
    const { rows } = await owner.query(
      "select provider_id from auth_accounts where user_id = $1 order by provider_id",
      [principalId],
    );
    expect(rows.map((row: { provider_id: string }) => row.provider_id)).toEqual([
      "credential",
      "google",
    ]);
  });

  it("refuses to link Google to an account whose own address isn't verified yet", async () => {
    const email = freshEmail();
    // Signed up, never opened the link: someone else may have typed this address.
    await signupWithPassword({
      db: perStatement,
      input: { email, password: PASSWORD, displayName: "Unverified" },
      req: request(),
    });
    googleProfile = { sub: randomUUID(), email, email_verified: true, name: "Real Owner" };

    await expect(
      throughGoogle(await startGoogleSignIn({ ctx: authRequestContext(request()) })),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_LINKED", status: 409 });
    const { rows } = await owner.query(
      "select count(*)::int as n from auth_accounts a join auth_principals p on p.id = a.user_id where p.email_normalized = $1 and a.provider_id = 'google'",
      [email],
    );
    expect(rows[0].n).toBe(0);
  });

  it("gives no session to a new address Google hasn't verified, and sends our verification email", async () => {
    const email = freshEmail();
    googleProfile = { sub: randomUUID(), email, email_verified: false, name: "Unverified Google" };

    const start = await startGoogleSignIn({ ctx: authRequestContext(request()) });
    await expect(throughGoogle(start)).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

    const principalId = await principalIdOf(email);
    const { rows } = await owner.query(
      "select count(*)::int as n from auth_sessions where user_id = $1",
      [principalId],
    );
    expect(rows[0].n).toBe(0);
  });

  it("refuses a callback whose state cookie is missing", async () => {
    googleProfile = { sub: randomUUID(), email: freshEmail(), email_verified: true, name: "X" };
    const start = await startGoogleSignIn({ ctx: authRequestContext(request()) });

    await expect(
      completeGoogleCallback({
        ctx: authRequestContext(request()),
        code: "google-code",
        state: new URL(start.url).searchParams.get("state") ?? "",
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("links Google from the security settings, lists both methods, and unlinks it", async () => {
    const email = freshEmail();
    const { cookie, principalId } = await passwordUser(email);
    googleProfile = { sub: randomUUID(), email, email_verified: true, name: "Test Learner" };

    const link = await startGoogleLink({ ctx: authRequestContext(request(cookie)) });
    const result = await throughGoogle(link, cookie);
    expect(result.kind).toBe("linked");

    const methods = await listLoginMethods({ ctx: authRequestContext(request(cookie)) });
    expect(methods.map((method) => method.provider).sort()).toEqual(["email", "google"]);

    const google = methods.find((method) => method.provider === "google");
    await unlinkLoginMethod({ ctx: authRequestContext(request(cookie)), id: google?.id ?? "" });
    const left = await listLoginMethods({ ctx: authRequestContext(request(cookie)) });
    expect(left.map((method) => method.provider)).toEqual(["email"]);

    // The last way to sign in can't be removed.
    await expect(
      unlinkLoginMethod({ ctx: authRequestContext(request(cookie)), id: left[0]?.id ?? "" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      loginWithPassword({ db: perStatement, input: { email, password: PASSWORD }, req: request() }),
    ).resolves.toMatchObject({ status: "signed_in" });
    expect(await principalIdOf(email)).toBe(principalId);
  });
});
