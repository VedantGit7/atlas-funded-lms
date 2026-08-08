import { ServerApiError, serverApi } from "../server-api";

export type AccountShellKind = "admin" | "instructor" | "moderator" | "learner";

/**
 * Which shell chrome should wrap an account-level page (e.g. /profile,
 * /settings) reachable by any role. Priority mirrors role authority: a member
 * holding multiple roles (e.g. admin + instructor) lands in the highest one.
 * Defaults to "learner" on any resolution failure, matching the pre-existing
 * fallback behavior of these pages.
 */
export async function resolveAccountShellKind(): Promise<AccountShellKind> {
  try {
    const me = await serverApi.get<{ data: { membership: { roleKeys: string[] } } }>("/api/v1/me");
    const roleKeys = me.data.membership.roleKeys;

    if (roleKeys.includes("owner") || roleKeys.includes("admin")) return "admin";
    if (roleKeys.includes("instructor")) return "instructor";
    if (roleKeys.includes("moderator")) return "moderator";
    return "learner";
  } catch (error) {
    if (error instanceof ServerApiError) return "learner";
    throw error;
  }
}
