"use client";

import type { ReactNode } from "react";
import type { AdminNavItem } from "../../features/admin/admin-navigation";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import { AdminShell } from "./admin/AdminShell";

type TenantAdminShellClientProps = {
  branding: PublicTenantBranding;
  requestId: string;
  member: {
    membershipId: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  navigationItems: AdminNavItem[];
  pendingReviewCount: number | null;
  mfaEnabled: boolean;
  children: ReactNode;
};

export function TenantAdminShellClient({
  branding,
  requestId,
  member,
  navigationItems,
  pendingReviewCount,
  mfaEnabled,
  children,
}: TenantAdminShellClientProps) {
  return (
    <AdminShell
      branding={branding}
      requestId={requestId}
      member={member}
      navigationItems={navigationItems}
      pendingReviewCount={pendingReviewCount}
      mfaEnabled={mfaEnabled}
    >
      {children}
    </AdminShell>
  );
}
