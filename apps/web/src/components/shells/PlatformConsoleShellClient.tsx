"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { PlatformNavItem } from "../../features/platform/platform-navigation";
import type { PlatformCapabilityProjection } from "../../features/platform/platform-capability-projection";
import {
  PlatformReasonProvider,
  usePlatformReason,
} from "../../features/platform/components/PlatformReasonProvider";
import { PlatformReasonDialog } from "../../features/platform/components/PlatformReasonDialog";

type PlatformConsoleShellClientProps = {
  requestId: string;
  displayEmail: string;
  mfaEnabled: boolean;
  navigationItems: PlatformNavItem[];
  capabilities: PlatformCapabilityProjection;
  children: ReactNode;
};

function navIsActive(pathname: string, href: string): boolean {
  if (href === "/platform") {
    return pathname === "/platform";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PlatformReasonBanner() {
  const { reason, isValid, setReason, clearReason } = usePlatformReason();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftReason, setDraftReason] = useState("");

  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p>
            {isValid
              ? "Operational reason is active for this platform session context."
              : "Provide an operational reason before loading protected platform data."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-amber-300 px-2 py-1"
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
                className="rounded border border-amber-300 px-2 py-1"
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileItems = useMemo(
    () => navigationItems.filter((item) => item.mobilePrimary),
    [navigationItems],
  );

  return (
    <div className="platform-console-shell min-h-screen bg-neutral-100 pb-16 md:pb-0">
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/platform" className="font-semibold text-neutral-900">
            Atlas Platform Console
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {navigationItems.length > 0 ? (
              <button
                type="button"
                className="rounded border px-2 py-1 md:hidden"
                aria-expanded={mobileOpen}
                aria-controls="platform-mobile-nav"
                onClick={() => {
                  setMobileOpen((value) => !value);
                }}
              >
                Menu
              </button>
            ) : null}
            <span className="hidden opacity-70 md:inline">
              {mfaEnabled ? "MFA verified" : "Session assurance pending"}
            </span>
            <span className="hidden opacity-80 md:inline">{displayEmail}</span>
          </div>
        </div>
      </header>

      <PlatformReasonBanner />

      <div className="mx-auto flex max-w-7xl gap-0 md:gap-6 md:px-4 md:py-6">
        {navigationItems.length > 0 ? (
          <aside className="hidden w-56 shrink-0 md:block" aria-label="Platform sidebar">
            <nav className="sticky top-4 space-y-1 rounded-lg border bg-white p-3 text-sm">
              {navigationItems.map((item) => {
                const active = navIsActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded px-3 py-2 ${
                      active
                        ? "bg-neutral-900 font-medium text-white"
                        : "opacity-80 hover:bg-neutral-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        ) : null}

        <div className="min-w-0 flex-1 px-4 py-6 md:px-0 md:py-0">{children}</div>
      </div>

      {mobileOpen && navigationItems.length > 0 ? (
        <nav
          id="platform-mobile-nav"
          aria-label="Platform mobile navigation drawer"
          className="fixed inset-x-0 top-[57px] z-20 max-h-[70vh] overflow-y-auto border-b bg-white p-4 shadow-lg md:hidden"
        >
          <ul className="space-y-1 text-sm">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded px-3 py-2"
                  onClick={() => {
                    setMobileOpen(false);
                  }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {navigationItems.length > 0 ? (
        <nav
          aria-label="Mobile platform navigation"
          className="fixed inset-x-0 bottom-0 z-10 border-t bg-white md:hidden"
        >
          <ul className="grid grid-cols-3 gap-1 px-2 py-2 text-xs">
            {(mobileItems.length > 0 ? mobileItems : navigationItems.slice(0, 3)).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex flex-col items-center rounded px-1 py-2">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <span className="sr-only">Request ID: {requestId}</span>
    </div>
  );
}

export function PlatformConsoleShellClient(props: PlatformConsoleShellClientProps) {
  return (
    <PlatformReasonProvider>
      <PlatformConsoleShellInner {...props} />
    </PlatformReasonProvider>
  );
}
