import { cookies } from "next/headers";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
  getBearerToken,
  readCookieFromRequest,
} from "./cookie-names";

/**
 * Reading the Supabase tokens from a request, on their own, so the web app can
 * use them without importing the auth services behind `./session` (and with
 * them Better Auth and the database client, which made the web's server
 * actions async and added Turbopack's async runtime to every learner page).
 */
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
