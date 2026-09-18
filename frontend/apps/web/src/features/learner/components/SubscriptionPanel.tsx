import { BadgeCheck, Building2, CheckCircle2, CircleSlash, Info } from "lucide-react";

type Entitlement = {
  key: string;
  value: unknown;
  enabled: boolean;
  expiresAt: string | null;
};

type SubscriptionPanelProps = {
  entitlements: Entitlement[];
  issuerName: string | null;
};

const FRIENDLY_LABELS: Record<string, string> = {
  "community.enable": "Community & discussion",
  "certification.enable": "Certificates",
  "gamification.enable": "Achievements & rewards",
  "competency.enable": "Competency & readiness",
  "diagnostics.enable": "Diagnostic assessments",
  "resources.enable": "Resource library",
  "data.export.enable": "Data export",
  "analytics.enable": "Learning analytics",
  "leaderboard.enable": "Leaderboards",
};

function friendlyLabel(key: string): string {
  const known = FRIENDLY_LABELS[key];
  if (known) return known;
  return key
    .replace(/\.enable$/u, "")
    .replace(/[._-]+/gu, " ")
    .replace(/\b\w/gu, (char) => char.toUpperCase());
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SubscriptionPanel({ entitlements, issuerName }: SubscriptionPanelProps) {
  const enabled = entitlements.filter((entitlement) => entitlement.enabled);
  const disabled = entitlements.filter((entitlement) => !entitlement.enabled);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-[var(--acct-border)] bg-[var(--acct-surface-lowest)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--acct-border)] bg-[color-mix(in_srgb,var(--acct-primary-container)_8%,transparent)] p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--acct-primary)] text-[var(--acct-on-primary)]">
              <BadgeCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--acct-on-surface-variant)]">
                Your access
              </p>
              <h2 className="text-lg font-semibold text-[var(--acct-on-surface)]">
                {issuerName ? `${issuerName} membership` : "Academy membership"}
              </h2>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--acct-primary)_30%,transparent)] bg-[var(--acct-surface-lowest)] px-3 py-1.5 text-xs font-semibold text-[var(--acct-primary)]">
            {enabled.length} feature{enabled.length === 1 ? "" : "s"} included
          </span>
        </div>

        <div className="p-6">
          {enabled.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {enabled.map((entitlement) => {
                const expiry = formatExpiry(entitlement.expiresAt);
                return (
                  <li
                    key={entitlement.key}
                    className="flex items-start gap-3 rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface-low)] p-3"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-[var(--acct-primary)]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--acct-on-surface)]">
                        {friendlyLabel(entitlement.key)}
                      </p>
                      {expiry ? (
                        <p className="mt-0.5 text-xs text-[var(--acct-on-surface-variant)]">
                          Renews or expires {expiry}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--acct-on-surface-variant)]">
              No premium features are currently enabled for your academy.
            </p>
          )}
        </div>
      </section>

      {disabled.length > 0 ? (
        <section className="rounded-xl border border-[var(--acct-border)] bg-[var(--acct-surface-lowest)] p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--acct-on-surface)]">Not included</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {disabled.map((entitlement) => (
              <li
                key={entitlement.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--acct-border)] px-3 py-1 text-xs text-[var(--acct-on-surface-variant)]"
              >
                <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />
                {friendlyLabel(entitlement.key)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex items-start gap-4 rounded-xl border border-[var(--acct-border)] bg-[var(--acct-surface-low)] p-4">
        <Building2
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--acct-primary)]"
          aria-hidden="true"
        />
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--acct-on-surface)]">
            Managed by your academy
            <Info className="h-4 w-4 text-[var(--acct-on-surface-variant)]" aria-hidden="true" />
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--acct-on-surface-variant)]">
            Your plan and billing are handled by your academy administrators. Contact them to change
            what is included in your membership.
          </p>
        </div>
      </div>
    </div>
  );
}
