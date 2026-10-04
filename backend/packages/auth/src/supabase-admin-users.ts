import { isAuthApiError } from "@supabase/supabase-js";
import { authProviderUnavailable } from "./auth-errors";
import { createSupabaseAdminServerClient } from "./supabase-server";

export type SupabaseUserSnapshot =
  | { exists: false }
  | { exists: true; email: string | null; emailConfirmed: boolean };

/**
 * What Supabase Auth currently holds for a user id, read with the service
 * role. Used by the platform account review (audit H6), which must establish
 * that an earlier sign-in is really gone before a principal moves.
 *
 * "Not found" is an answer; any other failure is not, and throws, so an outage
 * can never read as "the old account was deleted".
 */
export async function inspectSupabaseUser(supabaseUserId: string): Promise<SupabaseUserSnapshot> {
  const admin = createSupabaseAdminServerClient();
  const { data, error } = await admin.auth.admin.getUserById(supabaseUserId);

  if (error) {
    if (isAuthApiError(error) && (error.status === 404 || error.code === "user_not_found")) {
      return { exists: false };
    }
    throw authProviderUnavailable();
  }

  return {
    exists: true,
    email: data.user.email ?? null,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
}
