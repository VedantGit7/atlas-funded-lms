import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CheckCircle2, Lock } from "lucide-react";
import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import { mergeEntitlementsWithCatalogue } from "../../entitlements/entitlement-catalogue";
import { billingBackLinkClassName } from "../billing-admin-shared";
import { FeaturePreview } from "./FeaturePreview";
import {
  FEATURE_CATALOGUE,
  FEATURE_GROUPS,
  type FeatureEntry,
} from "./feature-catalogue";

type AdminFeaturesPageProps = {
  entitlements: EntitlementView[];
};

type FeatureStatus = "included" | "active" | "unavailable";

export function AdminFeaturesPage({ entitlements }: AdminFeaturesPageProps) {
  const resolved = mergeEntitlementsWithCatalogue(entitlements);
  const enabledByKey = new Map(resolved.map((entry) => [entry.canonicalKey, entry.enabled]));

  const statusFor = (feature: FeatureEntry): FeatureStatus => {
    if (!feature.entitlementKey) return "included";
    return enabledByKey.get(feature.entitlementKey) ? "active" : "unavailable";
  };

  const addonCount = FEATURE_CATALOGUE.filter((f) => f.entitlementKey).length;
  const activeAddons = FEATURE_CATALOGUE.filter(
    (f) => f.entitlementKey && enabledByKey.get(f.entitlementKey),
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-16">
      <Link href="/admin/billing" prefetch={false} className={billingBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Billing
      </Link>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            Features
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Everything your academy can do, in one place. Core features are included on every plan;
            add-ons are activated by your platform operator.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <SummaryStat value={FEATURE_CATALOGUE.length} label="Features" />
          <SummaryStat value={`${String(activeAddons)}/${String(addonCount)}`} label="Add-ons active" />
        </div>
      </header>

      {FEATURE_GROUPS.map((group) => {
        const features = FEATURE_CATALOGUE.filter((f) => f.groupId === group.id);
        if (features.length === 0) return null;
        const GroupIcon = group.icon;

        return (
          <section key={group.id} aria-labelledby={`feature-group-${group.id}`} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]">
                <GroupIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id={`feature-group-${group.id}`}
                  className="text-base font-bold text-[var(--admin-on-surface)]"
                >
                  {group.label}
                </h2>
                <p className="text-sm text-[var(--admin-on-surface-variant)]">{group.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {features.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} status={statusFor(feature)} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        Looking to activate an add-on?{" "}
        <Link
          href="/admin/entitlements"
          prefetch={false}
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          View capability details
        </Link>{" "}
        or contact your relationship manager to upgrade.
      </p>
    </div>
  );
}

function SummaryStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-center shadow-sm">
      <p className="text-xl font-bold leading-none text-[var(--admin-on-surface)]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[var(--admin-on-surface-variant)]">{label}</p>
    </div>
  );
}

function FeatureCard({ feature, status }: { feature: FeatureEntry; status: FeatureStatus }) {
  const { icon: Icon } = feature;
  const accentStyle = { "--accent": `var(${feature.accentToken})` } as CSSProperties;
  const bannerStyle: CSSProperties = {
    backgroundImage:
      "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--admin-surface)) 0%, color-mix(in srgb, var(--accent) 5%, var(--admin-surface)) 100%)",
  };
  const interactive = Boolean(feature.href);
  const cta = status === "unavailable" ? "Upgrade" : "Open";

  const cardClassName =
    "group flex flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm outline-none transition-all duration-200 motion-reduce:transition-none" +
    (interactive
      ? " hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--admin-border))] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] motion-reduce:hover:translate-y-0"
      : "");

  const inner = (
    <>
      <div className="relative h-32 overflow-hidden" style={bannerStyle}>
        <div className="absolute inset-x-6 inset-y-4">
          <FeaturePreview motif={feature.motif} />
        </div>
        <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_16%,var(--admin-surface))] text-[var(--accent)] shadow-sm ring-1 ring-inset ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="absolute right-3 top-3">
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-5 pt-4">
        <h3 className="text-[15px] font-bold text-[var(--admin-on-surface)]">{feature.name}</h3>
        <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {feature.blurb}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between px-5 pb-4 pt-3">
        {interactive ? (
          <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors group-hover:text-[var(--admin-primary)]">
            {cta}
            <ChevronRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        ) : (
          <span className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
            {status === "unavailable" ? "Not in your plan" : "Available"}
          </span>
        )}
      </div>
    </>
  );

  if (feature.href) {
    return (
      <Link
        href={feature.href}
        prefetch={false}
        aria-label={feature.name}
        style={accentStyle}
        className={cardClassName}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div style={accentStyle} className={cardClassName}>
      {inner}
    </div>
  );
}

function StatusBadge({ status }: { status: FeatureStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-success)]">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Active
      </span>
    );
  }

  if (status === "unavailable") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-surface-high)] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Add-on
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-primary)]">
      Included
    </span>
  );
}
