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

async function resolveUserFromAccessToken(accessToken: string) {
  const supabase = createSupabaseSessionVerificationClient();
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
  const aal = data.claims.aal;
  const sessionAssuranceLevel: SessionAssuranceLevel =
    aal === "aal2" ? "aal2" : aal === "aal1" ? "aal1" : null;

  // Account enrollment information only, never an authorization decision.
  const mfaEnabled = user.factors?.some((factor) => factor.status === "verified") ?? false;

  return {
    supabaseUserId: user.id,
    email: result.data.user.email,
    // A principal is only created or claimed for an address its owner has
    // proven (audit H6). Read from the auth service, never from the token.
    emailConfirmed: Boolean(user.email_confirmed_at),
    mfaEnabled,
    sessionAssuranceLevel,
  };
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
