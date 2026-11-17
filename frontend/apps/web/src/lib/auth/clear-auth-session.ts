"use server";

import { cookies } from "next/headers";
import { ATLAS_SECURE_SESSION_COOKIE, ATLAS_SESSION_COOKIE } from "../auth-cookies";
import { serverPublicApi } from "../server/public-auth-fetch";

/**
 * Ends the session in the API, which deletes it at once and passes on its
 * cookie-clearing headers, then clears the httpOnly session cookies here too,
 * in case the API couldn't be reached.
 *
 * Each is cleared with the attributes it was set with. `cookies().delete(name)`
 * writes no Secure, and a browser ignores that for `__Secure-atlas_session`;
 * it also replaced the API's correct deletion, so the session cookie outlived
 * sign-out (staging, 17 November 2026).
 */
export async function clearAtlasAuthSession(): Promise<void> {
  try {
    await serverPublicApi.logout();
  } catch {
    // The cookies are cleared below either way.
  }
  const cookieStore = await cookies();
  const expired = { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" } as const;
  cookieStore.set(ATLAS_SESSION_COOKIE, "", expired);
  cookieStore.set(ATLAS_SECURE_SESSION_COOKIE, "", { ...expired, secure: true });
}
