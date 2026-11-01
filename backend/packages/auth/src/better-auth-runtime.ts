import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { authPrisma } from "@atlas/db/auth-client";

import { authProviderUnavailable, authRequired } from "./auth-errors";
import { createAtlasAuth, type AtlasAuth, type AuthEmail } from "./better-auth";
import {
  ATLAS_SECURE_SESSION_COOKIE,
  ATLAS_SESSION_COOKIE,
  readRequestCookieHeader,
} from "./cookie-names";

/**
 * Which login system this deployment uses (launch plan, phase 3). Supabase
 * until every flow has moved and been checked on staging (task 5.1); then
 * Better Auth, and the setting goes with Supabase in task 3.8.
 */
export type AuthProvider = "supabase" | "better-auth";

export function authProvider(env: NodeJS.ProcessEnv = process.env): AuthProvider {
  return env["AUTH_PROVIDER"] === "better-auth" ? "better-auth" : "supabase";
}

export const BETTER_AUTH_SECRET_MIN_LENGTH = 32;

const mailbox = new AsyncLocalStorage<AuthEmail[]>();

/**
 * Runs Better Auth calls and returns the emails they asked for, so the route
 * can send them with the academy's sender. Outside this, an email request
 * throws: nothing is ever silently not sent.
 */
export async function captureAuthEmails<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; emails: AuthEmail[] }> {
  const emails: AuthEmail[] = [];
  const result = await mailbox.run(emails, fn);
  return { result, emails };
}

declare global {
  var __atlasAuth: AtlasAuth | undefined;
}

export function getAtlasAuth(env: NodeJS.ProcessEnv = process.env): AtlasAuth {
  if (globalThis.__atlasAuth) return globalThis.__atlasAuth;

  const secret = env["BETTER_AUTH_SECRET"] ?? "";
  if (secret.length < BETTER_AUTH_SECRET_MIN_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${BETTER_AUTH_SECRET_MIN_LENGTH} characters`,
    );
  }
  const prisma = authPrisma();

  globalThis.__atlasAuth = createAtlasAuth({
    prisma,
    secret,
    // Every host is accepted here because the API answers only for active
    // academy domains and the platform host, before any auth call, and builds
    // Better Auth's request headers from the host it resolved.
    allowedHosts: ["*"],
    protocol: env["NODE_ENV"] === "production" ? "https" : "http",
    onAuthEmail: (email) => {
      const box = mailbox.getStore();
      if (!box) throw new Error("Better Auth asked for an email outside captureAuthEmails");
      box.push(email);
    },
    google:
      env["GOOGLE_CLIENT_ID"] && env["GOOGLE_CLIENT_SECRET"]
        ? { clientId: env["GOOGLE_CLIENT_ID"], clientSecret: env["GOOGLE_CLIENT_SECRET"] }
        : undefined,
    hasActivePlatformGrant: async (principalId) =>
      (await prisma.platformOperator.count({
        where: { auth_principal_id: principalId, revoked_at: null },
      })) > 0,
  });
  return globalThis.__atlasAuth;
}

/** Tests build their own instance against their own database. */
export function setAtlasAuthForTests(auth: AtlasAuth | undefined): void {
  globalThis.__atlasAuth = auth;
  verifiedSessions.clear();
}

/**
 * The headers Better Auth sees: the host the API resolved, the cookies, and
 * nothing a client could use to choose another host.
 */
export function betterAuthHeaders(args: {
  host: string;
  cookie?: string | null;
  userAgent?: string | null;
  clientIp?: string | null;
}): Headers {
  const headers = new Headers({ host: args.host });
  if (args.cookie) headers.set("cookie", args.cookie);
  if (args.userAgent) headers.set("user-agent", args.userAgent);
  if (args.clientIp) headers.set("x-forwarded-for", args.clientIp);
  return headers;
}

/** The session cookie's value, under its plain or `__Secure-` name. */
export function readBetterAuthSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === ATLAS_SESSION_COOKIE || rawKey === ATLAS_SECURE_SESSION_COOKIE) {
      return rest.join("=") || null;
    }
  }
  return null;
}

export type BetterAuthSessionUser = {
  principalId: string;
  email: string;
  emailConfirmed: boolean;
  mfaEnabled: boolean;
  sessionAssuranceLevel: "aal1" | "aal2";
};

/**
 * Better Auth's answer for a session, reused for up to a minute, as the
 * Supabase check is (audit §3.1). A signed-out session keeps working on this
 * process for up to that long unless it was signed out here; disabling an
 * account is immediate, because global_status is read on every request.
 */
const VERIFIED_SESSION_TTL_MS = 60_000;
const MAX_VERIFIED_SESSIONS = 10_000;
const verifiedSessions = new Map<string, { user: BetterAuthSessionUser; expiresAt: number }>();

function sessionCacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** After sign-out or step-up on this process, the next request reads the database. */
export function forgetBetterAuthSession(cookieHeader: string | null): void {
  const token = readBetterAuthSessionToken(cookieHeader);
  if (token) verifiedSessions.delete(sessionCacheKey(token));
}

function remember(key: string, user: BetterAuthSessionUser, sessionExpiresAt: number): void {
  const now = Date.now();
  if (verifiedSessions.size >= MAX_VERIFIED_SESSIONS) {
    for (const [cachedKey, entry] of verifiedSessions) {
      if (entry.expiresAt <= now) verifiedSessions.delete(cachedKey);
    }
    for (const cachedKey of verifiedSessions.keys()) {
      if (verifiedSessions.size < MAX_VERIFIED_SESSIONS) break;
      verifiedSessions.delete(cachedKey);
    }
  }
  verifiedSessions.set(key, {
    user,
    expiresAt: Math.min(now + VERIFIED_SESSION_TTL_MS, sessionExpiresAt),
  });
}

export async function requireBetterAuthUser(req: Request): Promise<BetterAuthSessionUser> {
  const cookie = readRequestCookieHeader(req);
  const token = readBetterAuthSessionToken(cookie);
  if (!token) throw authRequired();

  const key = sessionCacheKey(token);
  const cached = verifiedSessions.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  verifiedSessions.delete(key);

  let found: Awaited<ReturnType<AtlasAuth["api"]["getSession"]>>;
  try {
    found = await getAtlasAuth().api.getSession({
      headers: betterAuthHeaders({ host: "localhost", cookie }),
      // The cookie can't be rewritten from here, so the session isn't slid
      // either: it lasts SESSION_EXPIRES_IN_SECONDS from sign-in.
      query: { disableCookieCache: true, disableRefresh: true },
    });
  } catch {
    // A database or configuration failure is not evidence of a bad session.
    throw authProviderUnavailable();
  }
  if (!found) throw authRequired();

  const user: BetterAuthSessionUser = {
    principalId: found.user.id,
    email: found.user.email,
    emailConfirmed: found.user.emailVerified,
    mfaEnabled: found.user.twoFactorEnabled === true,
    sessionAssuranceLevel: found.session.assuranceLevel === "aal2" ? "aal2" : "aal1",
  };
  remember(key, user, new Date(found.session.expiresAt).getTime());
  return user;
}
