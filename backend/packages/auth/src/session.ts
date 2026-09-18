import { cookies } from "next/headers";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
  getBearerToken,
  readCookieFromRequest,
} from "./cookie-names";
import { applyAuthSessionToCookieStore, readSessionPersistence } from "./cookie-store";
import {
  createSupabaseAdminServerClient,
  createSupabasePublicServerClient,
} from "./supabase-server";
import { authRequired } from "./auth-errors";
import { refreshSessionFromRefreshToken } from "./public-auth.service";

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

async function resolveMfaEnabledForSession(args: {
  accessToken: string;
  refreshToken: string;
}): Promise<boolean> {
  const supabase = createSupabasePublicServerClient();
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: args.accessToken,
    refresh_token: args.refreshToken,
  });

  if (sessionError) {
    return false;
  }

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    return false;
  }

  // `listFactors()` types `data.totp` and `data.phone` as `Factor<K, "verified">[]`
  // — the SDK returns only verified factors there, and keeps unverified ones in
  // `data.all`. The old `.some((f) => f.status === "verified")` was therefore
  // comparing "verified" to "verified" and could never be false for a non-empty
  // list. It was redundant, not wrong: presence in these arrays IS verification.
  //
  // Audit finding H5 assumed the opposite — that the predicate might fail to
  // discriminate verified from pending factors, making MFA enforcement unsafe to
  // build on. It does not; see the Phase 2 note in the remediation plan.
  const verifiedFactors = [...data.totp, ...data.phone];
  return verifiedFactors.length > 0;
}

async function resolveUserFromAccessToken(accessToken: string, refreshToken: string | null) {
  const supabase = createSupabaseAdminServerClient();
  const result = (await supabase.auth.getUser(accessToken)) as {
    data: { user: { id: string; email: string; factors?: unknown } | null };
    error: { message: string } | null;
  };

  if (result.error || !result.data.user?.id || !result.data.user.email) {
    throw authRequired();
  }

  const user = result.data.user;
  const mfaEnabled = refreshToken
    ? await resolveMfaEnabledForSession({ accessToken, refreshToken })
    : false;

  return {
    supabaseUserId: user.id,
    email: user.email,
    mfaEnabled,
  };
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
      return await resolveUserFromAccessToken(accessToken, refreshToken);
    } catch {
      if (!refreshToken) {
        throw authRequired();
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
  const nextRefreshToken = await extractRefreshToken(req);

  if (!nextAccessToken) {
    throw authRequired();
  }

  return resolveUserFromAccessToken(nextAccessToken, nextRefreshToken);
}
