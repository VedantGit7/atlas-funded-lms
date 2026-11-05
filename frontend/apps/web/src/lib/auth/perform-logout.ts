"use client";

import { clearClientDataCache } from "../query/client-data-cache";
import { clearAtlasAuthSession } from "./clear-auth-session";

type PerformLogoutOptions = {
  /** Where to send the user after the session is cleared. Defaults to `/login`. */
  redirectTo?: string;
};

/**
 * Ends the Atlas session on this device: the API deletes the session and the
 * httpOnly cookie is cleared, then the client caches are.
 */
export async function performAtlasLogout(options: PerformLogoutOptions = {}): Promise<string> {
  const redirectTo = options.redirectTo ?? "/login";

  await clearAtlasAuthSession();
  clearClientDataCache("logout");

  return redirectTo;
}
