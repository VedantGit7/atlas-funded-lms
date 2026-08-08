"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CreditCard,
  Gift,
  GraduationCap,
  Handshake,
  Lock,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAccountTheme } from "./account-theme-context";

type SettingsTab = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  danger?: boolean;
};

export const SETTINGS_TABS: SettingsTab[] = [
  { href: "/profile", label: "Profile", shortLabel: "Profile", icon: UserRound },
  {
    href: "/profile/learning",
    label: "Learning preferences",
    shortLabel: "Learning",
    icon: GraduationCap,
  },
  { href: "/profile/wallet", label: "Wallet", shortLabel: "Wallet", icon: Wallet },
  {
    href: "/profile/referral",
    label: "Invite & Earn",
    shortLabel: "Invite",
    icon: Gift,
  },
  {
    href: "/profile/affiliate",
    label: "Affiliate",
    shortLabel: "Affiliate",
    icon: Handshake,
  },
  { href: "/profile/notifications", label: "Notifications", shortLabel: "Notifications", icon: Bell },
  {
    href: "/profile/appearance",
    label: "Appearance & accessibility",
    shortLabel: "Appearance",
    icon: Sparkles,
  },
  { href: "/profile/security", label: "Security", shortLabel: "Security", icon: ShieldCheck },
  { href: "/profile/privacy", label: "Privacy & data", shortLabel: "Privacy", icon: Lock },
  {
    href: "/profile/subscription",
    label: "Subscription",
    shortLabel: "Subscription",
    icon: CreditCard,
  },
  {
    href: "/profile/danger-zone",
    label: "Danger zone",
    shortLabel: "Danger zone",
    icon: AlertTriangle,
    danger: true,
  },
];

function AccountSettingsNavLink({ href, label, icon: Icon, danger }: SettingsTab) {
  const pathname = usePathname();
  const { classes } = useAccountTheme();
  const active = pathname === href;

  if (danger) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-lg px-4 py-2 text-[var(--acct-danger)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--acct-danger)_10%,transparent)] motion-safe:active:scale-[0.98] ${
          active
            ? "bg-[color-mix(in_srgb,var(--acct-danger)_10%,transparent)] font-medium before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--acct-danger)]"
            : ""
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" strokeWidth={active ? 2.25 : 2} />
        <span className="text-xs font-medium">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg ${active ? classes.navActive : classes.navInactive} transition-colors duration-150`}
    >
      <Icon
        className={`h-5 w-5 shrink-0 ${active ? "text-[var(--acct-primary)]" : ""}`}
        aria-hidden="true"
        strokeWidth={active ? 2.25 : 2}
      />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

/** Mobile: horizontal scroll pills. Desktop uses AccountSettingsSidebar. */
export function AccountSettingsMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account settings sections"
      className="hide-scrollbar -mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1 md:hidden"
    >
      {SETTINGS_TABS.map((tab) => {
        const active = pathname === tab.href;
        const dangerActive = tab.danger;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              dangerActive
                ? active
                  ? "bg-[color-mix(in_srgb,var(--acct-danger)_12%,transparent)] text-[var(--acct-danger)]"
                  : "text-[var(--acct-danger)] hover:bg-[color-mix(in_srgb,var(--acct-danger)_8%,transparent)]"
                : active
                  ? "bg-[var(--acct-surface-low)] text-[var(--acct-on-surface)]"
                  : "text-[var(--acct-on-surface-variant)] hover:bg-[var(--acct-surface-container)]"
            }`}
          >
            {tab.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}

export function AccountSettingsSidebar({
  header,
  footer,
}: {
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden max-h-[calc(100vh-1px)] w-64 shrink-0 flex-col self-start border-r border-[var(--acct-border)] bg-[var(--acct-surface)] md:flex">
      {header ? <div className="border-b border-[var(--acct-border)] px-4 py-4">{header}</div> : null}

      <nav
        aria-label="Account settings sections"
        className="hide-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3"
      >
        {SETTINGS_TABS.map((tab) => (
          <AccountSettingsNavLink key={tab.href} {...tab} />
        ))}
      </nav>

      {footer ? (
        <div className="mt-auto border-t border-[var(--acct-border)] px-2 py-3">{footer}</div>
      ) : null}
    </aside>
  );
}
