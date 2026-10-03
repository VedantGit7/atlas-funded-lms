"use client";

import { clearClientDataCache } from "../query/client-data-cache";
import { clearAtlasAuthSession } from "./clear-auth-session";

type PerformLogoutOptions = {
  /** Where to send the user after the session is cleared. Defaults to `/login`. */
  redirectTo?: string;
};

/**
 * Ends the Atlas session on this device. Clears the httpOnly auth cookies the
 * server uses for `/api/v1/me`, then best-effort clears the Supabase browser
 * session and client caches.
 */
export async function performAtlasLogout(options: PerformLogoutOptions = {}): Promise<string> {
  const redirectTo = options.redirectTo ?? "/login";

  await clearAtlasAuthSession();

  try {
    // The learner shell needs the auth SDK only after a sign-out request.
    const { createSupabaseBrowserClient } = await import("../supabase/browser");
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  } catch {
    // Auth cookies are already cleared; Supabase sign-out is best-effort.
  }

  clearClientDataCache("logout");

  return redirectTo;
}
