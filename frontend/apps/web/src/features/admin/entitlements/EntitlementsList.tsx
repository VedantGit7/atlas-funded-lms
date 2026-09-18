import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Info,
  Lock,
  Palette,
  Users,
} from "lucide-react";
import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import {
  formatEntitlementExpiry,
  groupResolvedEntitlements,
  mergeEntitlementsWithCatalogue,
  type ResolvedEntitlement,
} from "./entitlement-catalogue";
import {
  activeStatusPillClassName,
  cardClassName,
  entitlementDescriptionClassName,
  entitlementKeyClassName,
  expiryClassName,
  footerNoteClassName,
  groupHeaderClassName,
  groupTitleClassName,
  guidanceClassName,
  inactiveBannerClassName,
  infoBannerClassName,
  rowGridClassName,
  statusDotClassName,
  statusSummaryClassName,
} from "./entitlements-admin-shared";

type EntitlementsListProps = {
  entitlements: EntitlementView[];
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  community: Users,
  learning: BookOpen,
  analytics: BarChart3,
  branding: Palette,
  other: Info,
};

export function EntitlementsList({ entitlements }: EntitlementsListProps) {
  const resolved = mergeEntitlementsWithCatalogue(entitlements);
  const groups = groupResolvedEntitlements(resolved);
  const activeCount = resolved.filter((entry) => entry.enabled).length;
  const inactiveCount = resolved.length - activeCount;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-[22px]">
            Entitlements
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Read-only view of effective tenant capabilities. Changes are managed by your platform
            operator.
          </p>
        </div>
        <div className={statusSummaryClassName}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-on-surface)]">
            <span className={statusDotClassName(true)} aria-hidden="true" />
            {activeCount} active
          </span>
          <span className="text-[var(--admin-outline)]" aria-hidden="true">
            •
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
            <span className={statusDotClassName(false)} aria-hidden="true" />
            {inactiveCount} inactive
          </span>
        </div>
      </header>

      <div className={infoBannerClassName}>
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm leading-relaxed">
          Entitlements are set by your platform operator and reflect your current tenant plan.
        </p>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const Icon = GROUP_ICONS[group.id] ?? Info;
          return (
            <article key={group.id} className={cardClassName}>
              <div className={groupHeaderClassName}>
                <Icon
                  className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <h2 className={groupTitleClassName}>{group.label}</h2>
              </div>
              <div className="divide-y divide-[var(--admin-border)]/60">
                {group.entries.map((entry) => (
                  <EntitlementRow key={entry.canonicalKey} entry={entry} />
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <p className={footerNoteClassName}>
        Looking for additional features? Contact your{" "}
        <span className="font-bold text-[var(--admin-primary)]">Relationship Manager</span> to
        discuss plan upgrades.
      </p>
    </section>
  );
}

function EntitlementRow({ entry }: { entry: ResolvedEntitlement }) {
  const expiry = formatEntitlementExpiry(entry.expiresAt, entry.enabled);

  if (!entry.enabled) {
    return (
      <div className="px-4 py-4">
        <div className={rowGridClassName}>
          <EntitlementIdentity entry={entry} className="md:col-span-4" />
          <div className="md:col-span-2">
            <StatusPill enabled={false} />
          </div>
          <div className="md:col-span-2">
            <span className={expiryClassName(false)}>{expiry.label}</span>
          </div>
        </div>
        <div className={`${inactiveBannerClassName} mt-3`}>
          <Info
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <p>{entry.guidance}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={rowGridClassName}>
      <EntitlementIdentity entry={entry} className="md:col-span-4" />
      <div className="md:col-span-2">
        <StatusPill enabled />
      </div>
      <div className="md:col-span-2">
        <span className={`inline-flex items-center gap-1 ${expiryClassName(expiry.urgent)}`}>
          {expiry.urgent ? <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
          {expiry.label}
        </span>
      </div>
      <div className="md:col-span-4">
        <p className={guidanceClassName}>{entry.guidance}</p>
      </div>
    </div>
  );
}

function EntitlementIdentity({
  entry,
  className = "",
}: {
  entry: ResolvedEntitlement;
  className?: string;
}) {
  return (
    <div className={className}>
      <code className={entitlementKeyClassName(entry.enabled)}>{entry.canonicalKey}</code>
      <p className={entitlementDescriptionClassName}>{entry.description}</p>
      {entry.hasInstanceKey ? (
        <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]/75">
          Instance key: {entry.key}
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span className={activeStatusPillClassName(enabled)}>
      {enabled ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {enabled ? "Active" : "Inactive"}
    </span>
  );
}
