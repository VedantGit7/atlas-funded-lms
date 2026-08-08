"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TenantLogo } from "@atlas/design-system";
import type { ModerationNavItem } from "../../features/moderation/moderation-navigation";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import { OperationalShellLayout } from "./shared/OperationalShellLayout";
import { themeColor } from "./shared/shell-utils";

type ModerationShellClientProps = {
  branding: PublicTenantBranding;
  requestId: string;
  member: {
    membershipId: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  navigationItems: ModerationNavItem[];
  pendingReviewCount: number | null;
  children: ReactNode;
};

function navIsActive(pathname: string, href: string): boolean {
  if (href === "/moderate/cases") {
    return pathname === href || pathname.startsWith("/moderate/cases/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ModerationShellClient({
  branding,
  requestId,
  member,
  navigationItems,
  pendingReviewCount,
  children,
}: ModerationShellClientProps) {
  const pathname = usePathname();
  const accent = themeColor(branding.themeTokens, "accent", "#2c5282");

  function badgeForItem(href: string): number | null {
    if (href === "/admin/review") return pendingReviewCount;
    return null;
  }

  return (
    <OperationalShellLayout
      shellClassName="moderation-shell text-foreground"
      drawerId="moderation-mobile-nav"
      sidebarAriaLabel="Moderation sidebar"
      mobileDrawerAriaLabel="Moderation mobile navigation"
      bottomNavAriaLabel="Mobile moderation navigation"
      headerLogo={
        <Link href="/moderate/cases" className="text-brand-primary">
          <TenantLogo
            publicName={
              branding.publicName ? `${branding.publicName} Moderation` : "Moderation"
            }
            logoLightUrl={branding.logoLightUrl}
            logoDarkUrl={branding.logoDarkUrl}
          />
        </Link>
      }
      headerActions={
        <span className="hidden text-sm text-muted-foreground md:inline">
          {member.displayName?.trim() || "Moderator"}
        </span>
      }
      navigationItems={navigationItems}
      pathname={pathname}
      isActive={navIsActive}
      accentColor={accent}
      badgeForItem={badgeForItem}
      requestId={requestId}
    >
      {children}
    </OperationalShellLayout>
  );
}
