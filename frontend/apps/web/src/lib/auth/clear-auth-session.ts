"use server";

import { cookies } from "next/headers";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
  ATLAS_SESSION_PERSISTENT_COOKIE,
} from "../auth-cookies";

/** Clears the httpOnly Atlas session cookies set during login. */
export async function clearAtlasAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ATLAS_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(ATLAS_REFRESH_TOKEN_COOKIE);
  cookieStore.delete(ATLAS_SESSION_PERSISTENT_COOKIE);
}
