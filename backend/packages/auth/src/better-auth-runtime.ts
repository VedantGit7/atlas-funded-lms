import { AsyncLocalStorage } from "node:async_hooks";
import cluster from "node:cluster";
import { createHash } from "node:crypto";
import process from "node:process";
import { authPrisma } from "@atlas/db/auth-client";

import { authProviderUnavailable, authRequired } from "./auth-errors";
import { createAtlasAuth, type AtlasAuth, type AuthEmail } from "./better-auth";
import {
  ATLAS_SECURE_SESSION_COOKIE,
  ATLAS_SESSION_COOKIE,
  readRequestCookieHeader,
} from "./cookie-names";

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

/**
 * The name Better Auth reads the session from: `__Secure-atlas_session` on
 * https deployments, `atlas_session` locally (useSecureCookies). Only that
 * one counts. A plain `atlas_session` beside a secure one could have been
 * planted from a sibling site or over plain http (security review 5.3,
 * finding 3).
 */
export function betterAuthSessionCookieName(env: NodeJS.ProcessEnv = process.env): string {
  return env["NODE_ENV"] === "production" ? ATLAS_SECURE_SESSION_COOKIE : ATLAS_SESSION_COOKIE;
}

/** The session cookie's value, under the name Better Auth reads. */
export function readBetterAuthSessionToken(
  cookieHeader: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!cookieHeader) return null;
  const name = betterAuthSessionCookieName(env);
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=") || null;
  }
  return null;
}

/** The session token inside a signed cookie value (`token.signature`, URL-encoded). */
function sessionTokenOf(cookieValue: string): string {
  let decoded = cookieValue;
  try {
    decoded = decodeURIComponent(cookieValue);
  } catch {
    // Not URL-encoded; compare it as it is.
  }
  return decoded.split(".")[0] ?? "";
}

export type BetterAuthSessionUser = {
  principalId: string;
  email: string;
  emailConfirmed: boolean;
  mfaEnabled: boolean;
  sessionAssuranceLevel: "aal1" | "aal2";
};

/**
 * Better Auth's answer for a session, reused for up to a minute (audit
 * §3.1). Ending a session forgets it in every process of this server at once
 * (below); disabling an account is immediate, because global_status is read
 * on every request.
 */
const VERIFIED_SESSION_TTL_MS = 60_000;
const MAX_VERIFIED_SESSIONS = 10_000;
type VerifiedSession = { user: BetterAuthSessionUser; expiresAt: number };
declare global {
  var __atlasVerifiedSessions: Map<string, VerifiedSession> | undefined;
  var __atlasForgetListener: boolean | undefined;
}
// One cache per process, like the Better Auth instance above, however many
// times the bundler loads this module.
const verifiedSessions = (globalThis.__atlasVerifiedSessions ??= new Map<
  string,
  VerifiedSession
>());

function sessionCacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The API runs as several processes (deploy/managed-node/server-cluster.mjs),
 * each with its own cache. A process that ends sessions tells the others
 * through the cluster supervisor, which passes the message on; otherwise a
 * signed-out session went on working for up to a minute in the processes that
 * had it cached (staging, 17 November 2026). The message names hashes of
 * session tokens and principal ids only, never a token.
 */
export const FORGET_SESSIONS_MESSAGE = "atlas.sessions.forget";

export type ForgetSessionsMessage = {
  type: typeof FORGET_SESSIONS_MESSAGE;
  keys: string[];
  principalIds: string[];
};

export function isForgetSessionsMessage(value: unknown): value is ForgetSessionsMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  const strings = (list: unknown) =>
    Array.isArray(list) && list.length <= 1_000 && list.every((item) => typeof item === "string");
  return (
    message["type"] === FORGET_SESSIONS_MESSAGE &&
    strings(message["keys"]) &&
    strings(message["principalIds"])
  );
}

function forgetLocally(message: Pick<ForgetSessionsMessage, "keys" | "principalIds">): void {
  for (const key of message.keys) verifiedSessions.delete(key);
  if (message.principalIds.length === 0) return;
  const principals = new Set(message.principalIds);
  for (const [key, entry] of verifiedSessions) {
    if (principals.has(entry.user.principalId)) verifiedSessions.delete(key);
  }
}

function forgetEverywhere(message: Pick<ForgetSessionsMessage, "keys" | "principalIds">): void {
  forgetLocally(message);
  // Only a cluster worker has the supervisor to tell. A test runner's own
  // child processes have an IPC channel too, which this must not write to.
  if (cluster.isWorker && typeof process.send === "function" && process.connected) {
    process.send({ type: FORGET_SESSIONS_MESSAGE, ...message } satisfies ForgetSessionsMessage);
  }
}

if (cluster.isWorker && !globalThis.__atlasForgetListener) {
  globalThis.__atlasForgetListener = true;
  process.on("message", (message: unknown) => {
    if (isForgetSessionsMessage(message)) forgetLocally(message);
  });
}

/** After sign-out or step-up, the next request in any process reads the database. */
export function forgetBetterAuthSession(cookieHeader: string | null): void {
  const token = readBetterAuthSessionToken(cookieHeader);
  if (token) forgetEverywhere({ keys: [sessionCacheKey(token)], principalIds: [] });
}

/**
 * After a change that ends or alters every session of a principal (a new or
 * reset password, "sign out other devices", an authenticator added or
 * removed), its sessions are read from the database again in every process.
 */
export function forgetPrincipalSessions(principalId: string): void {
  forgetEverywhere({ keys: [], principalIds: [principalId] });
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
  // The answer is remembered under this cookie's value, so it must be about
  // this cookie's session and no other.
  if (found.session.token !== sessionTokenOf(token)) throw authRequired();

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
