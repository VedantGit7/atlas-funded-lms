import { Calendar } from "lucide-react";
import {
  formatJoinedDate,
  memberInitials,
  statusBadgeClassName,
  statusLabel,
} from "./member-detail-shared";

type MemberIdentityHeaderProps = {
  displayName: string;
  email: string | null;
  status: string;
  joinedAt: string | null;
  avatarUrl: string | null;
};

export function MemberIdentityHeader({
  displayName,
  email,
  status,
  joinedAt,
  avatarUrl,
}: MemberIdentityHeaderProps) {
  const joinedLabel = formatJoinedDate(joinedAt);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-[var(--admin-on-surface-variant)]">
              {memberInitials(displayName, email)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              {displayName}
            </h1>
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                statusBadgeClassName(status),
              ].join(" ")}
            >
              {statusLabel(status)}
            </span>
          </div>
          {email ? (
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{email}</p>
          ) : null}
          {joinedLabel ? (
            <div className="mt-4 flex items-center gap-1.5 text-[var(--admin-on-surface-variant)]">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs font-semibold">{joinedLabel}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
