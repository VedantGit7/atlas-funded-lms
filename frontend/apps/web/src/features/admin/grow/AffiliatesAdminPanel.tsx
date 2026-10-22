"use client";

import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { ADMIN_SALES_HREF, DASHBOARD_HREF, TABS } from "./affiliates-shared";

import {
  AffiliatePartnerEditor,
  AffiliatePartnerList,
  AffiliatePayoutsTab,
  AffiliateProductsTab,
  AffiliateRequestsTab,
  AffiliateSettingsTab,
} from "./affiliates-admin-sections";
import { useAffiliatesAdmin } from "./use-affiliates-admin";

export function AffiliatesAdminPanel() {
  const view = useAffiliatesAdmin();
  const { draft, goToPartnersInvite, loading, pendingRequests, setTab, tab } = view;

  if (loading && !draft && tab === "settings") {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
        <div className="h-48 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={DASHBOARD_HREF} className={generalSettingsBackLinkClassName}>
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="text-[var(--admin-on-surface-variant)]">/</span>
          <Link href={ADMIN_SALES_HREF} className={generalSettingsBackLinkClassName}>
            Sales
          </Link>
          <span className="text-[var(--admin-on-surface-variant)]">/</span>
          <span className="font-medium text-[var(--admin-on-surface)]">Affiliates</span>
        </div>
        <button
          type="button"
          onClick={goToPartnersInvite}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98]"
        >
          <UserPlus className="h-4 w-4" />
          Invite partner
        </button>
      </div>

      <header>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Affiliates
        </h1>
        <p className="mt-2 max-w-3xl text-[16px] text-[var(--admin-on-surface-variant)]">
          Let partners promote your courses, earn commissions on sales, and receive payouts.
          Configure program access, product rates, and partner approvals.
        </p>
      </header>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-[var(--admin-border)]">
        {TABS.map((entry) => {
          const active = tab === entry.id;
          const showBadge = entry.id === "requests" && pendingRequests > 0;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(entry.id);
              }}
              className={[
                "relative -mb-px flex items-center gap-2 px-4 pb-3 pt-1 text-sm font-semibold transition-colors",
                active
                  ? "text-[var(--admin-primary)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              {entry.label}
              {showBadge ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--admin-warning)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--admin-on-warning)]">
                  {pendingRequests}
                </span>
              ) : null}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--admin-primary)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <AffiliateSettingsTab view={view} />

      <AffiliateProductsTab view={view} />

      {tab === "partners" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <AffiliatePartnerList view={view} />

          <AffiliatePartnerEditor view={view} />
        </div>
      ) : null}

      <AffiliateRequestsTab view={view} />

      <AffiliatePayoutsTab view={view} />
    </div>
  );
}
