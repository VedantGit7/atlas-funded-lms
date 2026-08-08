"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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

export function PaymentGatewayConfigShell({
  gatewayId,
  children,
}: {
  gatewayId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const base = `/admin/learner-billing/payment-gateway/${gatewayId}`;
  const items = [
    { id: "configure", label: "Configurations", href: `${base}/configure` },
    { id: "publish", label: "Publish Payment Gateway", href: `${base}/publish` },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-12">
      <Link
        href="/admin/learner-billing/payment-gateway"
        prefetch={false}
        className={generalSettingsBackLinkClassName}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Payment Gateways
      </Link>

      <div className={generalSettingsLayoutClassName}>
        <aside className={generalSettingsSidebarClassName}>
          <div className={generalSettingsSidebarHeaderClassName}>
            <p className={generalSettingsSidebarTitleClassName}>Payment Gateways</p>
          </div>
          <nav className={generalSettingsNavClassName} aria-label="Payment gateway settings">
            {items.map((item) => {
              const active = pathname === item.href;
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
