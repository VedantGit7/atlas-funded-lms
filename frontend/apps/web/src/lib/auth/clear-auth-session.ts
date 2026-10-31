"use server";

import { cookies } from "next/headers";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
  ATLAS_SECURE_SESSION_COOKIE,
  ATLAS_SESSION_COOKIE,
  ATLAS_SESSION_PERSISTENT_COOKIE,
} from "../auth-cookies";
import { serverPublicApi } from "../server/public-auth-fetch";

/**
 * Ends the session in the API, which deletes a Better Auth session at once,
 * then clears the httpOnly Atlas session cookies set during login.
 */
export async function clearAtlasAuthSession(): Promise<void> {
  try {
    await serverPublicApi.logout();
  } catch {
    // The cookies are cleared below either way.
  }
  const cookieStore = await cookies();
  cookieStore.delete(ATLAS_SESSION_COOKIE);
  cookieStore.delete(ATLAS_SECURE_SESSION_COOKIE);
  cookieStore.delete(ATLAS_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(ATLAS_REFRESH_TOKEN_COOKIE);
  cookieStore.delete(ATLAS_SESSION_PERSISTENT_COOKIE);
}
