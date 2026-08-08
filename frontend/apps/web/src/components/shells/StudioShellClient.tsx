"use client";

import type { ReactNode } from "react";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import type { StudioNavItem } from "../../features/studio/studio-navigation";
import { StudioShell } from "./studio/StudioShell";

type StudioShellClientProps = {
  branding: PublicTenantBranding;
  requestId: string;
  member: {
    membershipId: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  navigationItems: StudioNavItem[];
  pendingReviewCount: number | null;
  pendingGradingCount: number | null;
  mfaEnabled: boolean;
  children: ReactNode;
};

export function StudioShellClient({
  branding,
  requestId,
  member,
  navigationItems,
  pendingReviewCount,
  pendingGradingCount,
  mfaEnabled,
  children,
}: StudioShellClientProps) {
  return (
    <StudioShell
      branding={branding}
      requestId={requestId}
      member={member}
      navigationItems={navigationItems}
      pendingReviewCount={pendingReviewCount}
      pendingGradingCount={pendingGradingCount}
      mfaEnabled={mfaEnabled}
    >
      {children}
    </StudioShell>
  );
}
