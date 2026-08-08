import { Shield } from "lucide-react";

export function MemberOwnerBanner() {
  return (
    <div className="flex items-center gap-4 rounded-r-lg border-l-4 border-[var(--admin-primary)] bg-[var(--admin-primary-container)]/35 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-[var(--admin-primary)]">
        <Shield className="h-5 w-5 fill-current" aria-hidden="true" />
      </div>
      <p className="text-sm text-[var(--admin-on-primary-container)]">
        This member holds the owner role. Role and permission actions are protected.
      </p>
    </div>
  );
}
