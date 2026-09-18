"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { PlatformNavItem } from "../../features/platform/platform-navigation";
import type { PlatformCapabilityProjection } from "../../features/platform/platform-capability-projection";
import {
  PlatformReasonProvider,
  usePlatformReason,
} from "../../features/platform/components/PlatformReasonProvider";
import { PlatformReasonDialog } from "../../features/platform/components/PlatformReasonDialog";
import { OperationalShellLayout } from "./shared/OperationalShellLayout";
import { createNavIsActive } from "./shared/shell-utils";

type PlatformConsoleShellClientProps = {
  requestId: string;
  displayEmail: string;
  mfaEnabled: boolean;
  navigationItems: PlatformNavItem[];
  capabilities: PlatformCapabilityProjection;
  children: ReactNode;
};

const navIsActive = createNavIsActive("/platform");

function PlatformReasonBanner() {
  const { reason, isValid, setReason, clearReason } = usePlatformReason();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftReason, setDraftReason] = useState("");

  return (
    <>
      <div
        role="status"
        className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-foreground"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p>
            {isValid
              ? "Operational reason is active for this platform session context."
              : "Provide an operational reason before loading protected platform data."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-10 rounded border border-warning/40 px-2 py-1 hover:bg-warning/10"
              onClick={() => {
                setDraftReason(reason ?? "");
                setDialogOpen(true);
              }}
            >
              {isValid ? "Update reason" : "Set reason"}
            </button>
            {isValid ? (
              <button
                type="button"
                className="min-h-10 rounded border border-warning/40 px-2 py-1 hover:bg-warning/10"
                onClick={clearReason}
              >
                Clear reason
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <PlatformReasonDialog
        open={dialogOpen}
        title="Platform operational reason"
        description="Every platform read and action requires a reason of at least 10 characters. Reasons are not stored in the browser."
        value={draftReason}
        onChange={setDraftReason}
        onConfirm={() => {
          setReason(draftReason);
          setDialogOpen(false);
        }}
        onCancel={() => {
          setDialogOpen(false);
        }}
      />
    </>
  );
}

function PlatformConsoleShellInner({
  requestId,
  displayEmail,
  mfaEnabled,
  navigationItems,
  children,
}: Omit<PlatformConsoleShellClientProps, "capabilities">) {
  const pathname = usePathname();

  return (
    <OperationalShellLayout
      shellClassName="platform-console-shell"
      drawerId="platform-mobile-nav"
      sidebarAriaLabel="Platform sidebar"
      mobileDrawerAriaLabel="Platform mobile navigation drawer"
      bottomNavAriaLabel="Mobile platform navigation"
      headerLogo={
        <Link href="/platform" className="font-semibold text-foreground">
          Atlas Platform Console
        </Link>
      }
      headerActions={
        <>
          <span className="hidden text-sm text-muted-foreground md:inline">
            {mfaEnabled ? "MFA verified" : "Session assurance pending"}
          </span>
          <span className="hidden text-sm text-muted-foreground md:inline">{displayEmail}</span>
        </>
      }
      banner={<PlatformReasonBanner />}
      navigationItems={navigationItems}
      pathname={pathname}
      isActive={navIsActive}
      // A theme token, not a hex: the active item pairs this background with
      // text-primary-foreground, and a fixed near-black made that pair
      // dark-on-dark -- unreadable -- in dark mode.
      accentColor="var(--primary)"
      requestId={requestId}
      bottomNavLimit={3}
    >
      {children}
    </OperationalShellLayout>
  );
}

export function PlatformConsoleShellClient(props: PlatformConsoleShellClientProps) {
  return (
    <PlatformReasonProvider>
      <PlatformConsoleShellInner {...props} />
    </PlatformReasonProvider>
  );
}
