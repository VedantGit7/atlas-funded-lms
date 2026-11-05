import "server-only";

import { cookies } from "next/headers";
import { ATLAS_SECURE_SESSION_COOKIE, ATLAS_SESSION_COOKIE } from "../auth-cookies";

/** A request hint for optional private fetches, never an authorization decision. */
export async function hasSessionCookie(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(
    jar.get(ATLAS_SESSION_COOKIE)?.value || jar.get(ATLAS_SECURE_SESSION_COOKIE)?.value,
  );
}
