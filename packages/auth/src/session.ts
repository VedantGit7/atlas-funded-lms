import { cookies } from "next/headers";
import { ATLAS_ACCESS_TOKEN_COOKIE, getBearerToken } from "./cookies";
import { createSupabaseAdminServerClient } from "./supabase-server";
import { authRequired } from "./auth-errors";

function readCookieFromRequest(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");

  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");

    if (rawKey === name) {
      return rest.join("=") || null;
    }
  }

  return null;
}

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

export async function requireSupabaseUser(req: Request) {
  const token = await extractAccessToken(req);

  if (!token) {
    throw authRequired();
  }

  const supabase = createSupabaseAdminServerClient();
  const result = (await supabase.auth.getUser(token)) as {
    data: { user: { id: string; email: string; factors?: unknown } | null };
    error: { message: string } | null;
  };

  if (result.error || !result.data.user?.id || !result.data.user.email) {
    throw authRequired();
  }

  const user = result.data.user;

  return {
    supabaseUserId: user.id,
    email: user.email,
    mfaEnabled: Array.isArray(user.factors) && user.factors.length > 0,
  };
}
