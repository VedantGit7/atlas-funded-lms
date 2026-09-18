import { ServerApiError, serverApi } from "../../lib/server-api";

function initialsOf(displayName: string | null, email: string | null): string {
  const trimmed = displayName?.trim();
  if (trimmed) {
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }
  const local = email?.split("@")[0]?.trim();
  return local ? local.slice(0, 2).toUpperCase() : "?";
}

function formatRoleLabel(roleKeys: string[]): string {
  if (roleKeys.includes("owner")) return "Owner";
  if (roleKeys.includes("admin")) return "Admin";
  if (roleKeys.includes("instructor")) return "Instructor";
  if (roleKeys.includes("moderator")) return "Moderator";
  return "Member";
}

export async function AccountSettingsUserCard({
  variant = "footer",
}: {
  variant?: "footer" | "header";
}) {
  try {
    const me = await serverApi.get<{
      data: {
        identity: { email: string | null };
        membership: { roleKeys: string[] };
        profile: { displayName: string | null; avatarUrl: string | null } | null;
      };
    }>("/api/v1/me");

    const displayName = me.data.profile?.displayName ?? me.data.identity.email ?? "Account";
    const roleLabel = formatRoleLabel(me.data.membership.roleKeys);
    const avatarUrl = me.data.profile?.avatarUrl;
    const initials = initialsOf(me.data.profile?.displayName ?? null, me.data.identity.email);

    if (variant === "header") {
      return (
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-11 w-11 rounded-full border-2 border-[var(--acct-primary-container)] object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--acct-primary-container)] bg-[var(--acct-surface-low)] text-sm font-semibold text-[var(--acct-on-surface)]">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--acct-on-surface)]">
              {displayName}
            </p>
            <p className="truncate text-xs font-medium text-[var(--acct-on-surface-variant)]">
              {roleLabel}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 rounded-lg bg-[var(--acct-surface-container)] p-2">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full border border-[var(--acct-border)] object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--acct-border)] bg-[var(--acct-surface-low)] text-xs font-semibold text-[var(--acct-on-surface)]">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-[var(--acct-on-surface)]">
            {displayName}
          </p>
          <p className="truncate text-[11px] font-semibold text-[var(--acct-on-surface-variant)]">
            {roleLabel}
          </p>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ServerApiError) return null;
    throw error;
  }
}
