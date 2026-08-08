"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import {
  generalSettingsBackLinkClassName,
  generalSettingsContentClassName,
  generalSettingsLayoutClassName,
  generalSettingsMainClassName,
  generalSettingsNavClassName,
  generalSettingsNavItemClassName,
  generalSettingsSidebarClassName,
  generalSettingsSidebarHeaderClassName,
  generalSettingsSidebarTitleClassName,
} from "../general-settings/general-settings-shared";
import { LEARNER_BILLING_NAV_ITEMS } from "./learner-billing-nav";

type LearnerBillingSettingsShellProps = {
  children: ReactNode;
};

export function LearnerBillingSettingsShell({ children }: LearnerBillingSettingsShellProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-12">
      <Link href="/admin/settings" prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Settings
      </Link>

      <div className={generalSettingsLayoutClassName}>
        <aside className={generalSettingsSidebarClassName}>
          <div className={generalSettingsSidebarHeaderClassName}>
            <p className={generalSettingsSidebarTitleClassName}>Learner Billing</p>
          </div>
          <nav className={generalSettingsNavClassName} aria-label="Learner billing settings">
            {LEARNER_BILLING_NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={generalSettingsNavItemClassName(active)}
                >
                  {active ? (
                    <span
                      className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="pl-1">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className={generalSettingsMainClassName}>
          <div className={generalSettingsContentClassName}>{children}</div>
        </div>
      </div>
    </div>
  );
}
