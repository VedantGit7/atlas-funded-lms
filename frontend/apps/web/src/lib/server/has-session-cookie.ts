import "server-only";

import { cookies } from "next/headers";
import { ATLAS_ACCESS_TOKEN_COOKIE, ATLAS_REFRESH_TOKEN_COOKIE } from "../auth-cookies";

/** A request hint for optional private fetches, never an authorization decision. */
export async function hasSessionCookie(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(
    jar.get(ATLAS_ACCESS_TOKEN_COOKIE)?.value || jar.get(ATLAS_REFRESH_TOKEN_COOKIE)?.value,
  );
}
