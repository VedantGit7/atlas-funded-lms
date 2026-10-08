import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
  getBearerToken,
  readCookieFromRequest,
} from "./cookie-names";
import { applyAuthSessionToCookieStore, readSessionPersistence } from "./cookie-store";
import { createSupabaseSessionVerificationClient } from "./supabase-server";
import { authProviderUnavailable, authRequired } from "./auth-errors";
import { refreshSessionFromRefreshToken } from "./public-auth.service";

export type SessionAssuranceLevel = "aal1" | "aal2" | null;

export async function extractAccessToken(req: Request): Promise<string | null> {
  const bearer = getBearerToken(req);

  if (bearer) {
    return bearer;
  }

  const cookieToken = readCookieFromRequest(req, ATLAS_ACCESS_TOKEN_COOKIE);

  if (cookieToken) {
    return cookieToken;
  }

  const cookieStore = await cookies();
  return cookieStore.get(ATLAS_ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function extractRefreshToken(req: Request): Promise<string | null> {
  const cookieToken = readCookieFromRequest(req, ATLAS_REFRESH_TOKEN_COOKIE);

  if (cookieToken) {
    return cookieToken;
  }

  const cookieStore = await cookies();
  return cookieStore.get(ATLAS_REFRESH_TOKEN_COOKIE)?.value ?? null;
}

type VerifiedUser = {
  supabaseUserId: string;
  email: string;
  emailConfirmed: boolean;
  mfaEnabled: boolean;
};

/**
 * The auth service's answer for a token, reused for up to a minute (audit
 * §3.1). Without it every API request made an HTTPS call to Supabase Auth;
 * with it a user costs about one a minute.
 *
 * What a cached entry trusts and what it does not:
 * - The token's signature and expiry are still verified on every request
 *   (getClaims, locally against the project's signing keys), and assurance is
 *   always read from the token itself. A forged, altered or expired token
 *   never matches an entry, and no entry outlives its token.
 * - The live check is what is reused: that the session has not been signed
 *   out, that the user still exists, and the user's email confirmation and MFA
 *   enrollment. A session signed out elsewhere keeps working here for up to
 *   VERIFIED_SESSION_TTL_MS. Disabling an account in Atlas is immediate: the
 *   principal's global_status is read from the database on every request.
 *
 * Keyed by a SHA-256 of the token, per process.
 */
const VERIFIED_SESSION_TTL_MS = 60_000;
const MAX_VERIFIED_SESSIONS = 10_000;
const verifiedSessions = new Map<string, { user: VerifiedUser; expiresAt: number }>();

function sessionCacheKey(accessToken: string): string {
  return createHash("sha256").update(accessToken).digest("hex");
}

function rememberVerifiedSession(key: string, user: VerifiedUser, tokenExpiresAt: number): void {
  const now = Date.now();
  if (verifiedSessions.size >= MAX_VERIFIED_SESSIONS) {
    for (const [cachedKey, entry] of verifiedSessions) {
      if (entry.expiresAt <= now) verifiedSessions.delete(cachedKey);
    }
    // Still full: drop the oldest insertions.
    for (const cachedKey of verifiedSessions.keys()) {
      if (verifiedSessions.size < MAX_VERIFIED_SESSIONS) break;
      verifiedSessions.delete(cachedKey);
    }
  }
  verifiedSessions.set(key, {
    user,
    expiresAt: Math.min(now + VERIFIED_SESSION_TTL_MS, tokenExpiresAt),
  });
}

/** Tests reuse token strings across cases; production never clears it. */
export function resetVerifiedSessionCacheForTests(): void {
  verifiedSessions.clear();
}

function toAssuranceLevel(aal: unknown): SessionAssuranceLevel {
  return aal === "aal2" ? "aal2" : aal === "aal1" ? "aal1" : null;
}

async function resolveUserFromAccessToken(accessToken: string) {
  const supabase = createSupabaseSessionVerificationClient();
  const key = sessionCacheKey(accessToken);
  const cached = verifiedSessions.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    // Signature and expiry, on every request.
    const { data, error } = await supabase.auth.getClaims(accessToken);
    if (error) throw verificationError(error);
    if (!data || data.claims.sub !== cached.user.supabaseUserId) {
      throw authRequired();
    }
    return { ...cached.user, sessionAssuranceLevel: toAssuranceLevel(data.claims.aal) };
  }
  verifiedSessions.delete(key);

  const result = await supabase.auth.getUser(accessToken);

  if (result.error) throw verificationError(result.error);
  if (!result.data.user.id || !result.data.user.email) {
    throw authRequired();
  }

  const user = result.data.user;
  // Verify the exact token used above. Enrollment and a different cookie/refresh
  // session must never promote this request's assurance. getClaims verifies the
  // signature and expiration; getUser also checks the user with the auth service.
  const { data, error } = await supabase.auth.getClaims(accessToken);
  if (error) throw verificationError(error);
  if (!data || data.claims.sub !== user.id) {
    throw authRequired();
  }

  const verified: VerifiedUser = {
    supabaseUserId: user.id,
    email: result.data.user.email,
    // A principal is only created or claimed for an address its owner has
    // proven (audit H6). Read from the auth service, never from the token.
    emailConfirmed: Boolean(user.email_confirmed_at),
    // Account enrollment information only, never an authorization decision.
    mfaEnabled: user.factors?.some((factor) => factor.status === "verified") ?? false,
  };
  const exp = data.claims.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) {
    rememberVerifiedSession(key, verified, exp * 1000);
  }

  return { ...verified, sessionAssuranceLevel: toAssuranceLevel(data.claims.aal) };
}

function verificationError(error: unknown): AtlasHttpError {
  if (error instanceof AtlasHttpError) return error;
  const status =
    typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  if (
    isAuthRetryableFetchError(error) ||
    (typeof status === "number" && (status >= 500 || status === 429)) ||
    (error instanceof Error && !isAuthError(error))
  )
    return authProviderUnavailable();
  return authRequired();
}

export async function refreshAuthenticatedSession(req: Request): Promise<boolean> {
  const refreshToken = await extractRefreshToken(req);

  if (!refreshToken) {
    return false;
  }

  try {
    const session = await refreshSessionFromRefreshToken({ refreshToken });
    await applyAuthSessionToCookieStore({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresInSeconds: session.expiresIn,
      persistent: await readSessionPersistence(req),
    });
    return true;
  } catch {
    return false;
  }
}

export async function requireSupabaseUser(req: Request) {
  const accessToken = await extractAccessToken(req);
  const refreshToken = await extractRefreshToken(req);

  if (accessToken) {
    try {
      return await resolveUserFromAccessToken(accessToken);
    } catch (error) {
      const failure = verificationError(error);
      // Provider outages are not evidence of invalid credentials. Fail closed
      // without refreshing or replacing the identity presented on this request.
      if (failure.status !== 401) throw failure;
      if (!refreshToken) {
        throw failure;
      }
    }
  } else if (!refreshToken) {
    throw authRequired();
  }

  const refreshed = await refreshAuthenticatedSession(req);
  if (!refreshed) {
    throw authRequired();
  }

  const nextAccessToken = await extractAccessToken(req);

  if (!nextAccessToken) {
    throw authRequired();
  }

  try {
    return await resolveUserFromAccessToken(nextAccessToken);
  } catch (error) {
    throw verificationError(error);
  }
}
