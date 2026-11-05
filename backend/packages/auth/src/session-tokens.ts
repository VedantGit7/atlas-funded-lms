import { cookies } from "next/headers";
import {
  ATLAS_SECURE_SESSION_COOKIE,
  ATLAS_SESSION_COOKIE,
  readCookieFromRequest,
} from "./cookie-names";

/**
 * The Better Auth session cookie from a request, on its own, so the web app
 * can read it without importing the auth services (and with them Better Auth
 * and the database client, which made the web's server actions async and
 * added Turbopack's async runtime to every learner page).
 */
export async function extractSessionToken(req: Request): Promise<string | null> {
  const fromRequest =
    readCookieFromRequest(req, ATLAS_SESSION_COOKIE) ??
    readCookieFromRequest(req, ATLAS_SECURE_SESSION_COOKIE);
  if (fromRequest) return fromRequest;

  const cookieStore = await cookies();
  return (
    cookieStore.get(ATLAS_SESSION_COOKIE)?.value ??
    cookieStore.get(ATLAS_SECURE_SESSION_COOKIE)?.value ??
    null
  );
}
