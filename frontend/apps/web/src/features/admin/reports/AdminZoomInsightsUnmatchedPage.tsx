"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  History,
  Info,
  Link2,
  RefreshCw,
  Search,
  SearchX,
  Sparkles,
  UserX,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  bulkMatchZoomUnmatched,
  connectZoomAccount,
  exportZoomInsightsReport,
  fetchZoomMatchingRules,
  fetchZoomUnmatchedIdentities,
  mutateZoomParticipantMatch,
  updateZoomMatchingRules,
  type ZoomConnectionMeta,
  type ZoomMatchingRules,
  type ZoomUnmatchedIdentity,
  type ZoomUnmatchedSummary,
} from "./admin-zoom-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type ModuleTab = "meetings" | "participants" | "unmatched" | "connection" | "exports";
type GroupFilter = "all" | "high" | "medium" | "guest" | "none";

type MemberSearchResult = {
  id: string;
  label: string;
  email: string | null;
};

const PAGE_SIZE = 50;

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const selectTriggerClassName =
  "h-9 min-w-[10rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[13px] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m`;
  return `${String(total % 60)}s`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function initials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

async function searchMembers(term: string): Promise<MemberSearchResult[]> {
  const response = await clientApi.get<{
    data: {
      items: Array<{
        id: string;
        invitedEmail: string | null;
        accountEmail?: string | null;
        profile: { displayName: string | null } | null;
      }>;
    };
  }>(`/api/v1/members?search=${encodeURIComponent(term.trim())}&limit=8&status=ACTIVE`);

  return response.data.items.map((member) => ({
    id: member.id,
    label: member.profile?.displayName ?? member.invitedEmail ?? member.accountEmail ?? member.id,
    email: member.accountEmail ?? member.invitedEmail,
  }));
}

function ConfidencePill({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const tone =
    confidence === "high"
      ? "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
      : confidence === "medium"
        ? "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
        : "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  const label =
    confidence === "high" ? "High match" : confidence === "medium" ? "Medium match" : "Low match";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${tone}`}
    >
      {confidence === "high" ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

function ModuleTabs({ active }: { active: ModuleTab }) {
  const router = useRouter();
  const tabs: Array<[ModuleTab, string, string]> = [
    ["meetings", "Meetings", "/admin/reports/zoom-insights"],
    ["participants", "Participants", "/admin/reports/zoom-insights/participants"],
    ["unmatched", "Unmatched", "/admin/reports/zoom-insights/unmatched"],
    ["connection", "Connection", "/admin/reports/zoom-insights/connection"],
    ["exports", "Exports", "/admin/reports/zoom-insights/exports"],
  ];
  return (
    <div className="flex gap-6 border-b border-[var(--admin-border)]" role="tablist">
      {tabs.map(([value, label, href]) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={[
              "px-1 pb-2 text-base font-semibold transition-colors",
              selected
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
            onClick={() => {
              router.push(href);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function RuleToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40",
        checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-high)]",
      ].join(" ")}
      onClick={() => {
        onChange(!checked);
      }}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--admin-surface)] shadow transition duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function MatchingRulesDrawer({
  open,
  onClose,
  rules,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  rules: ZoomMatchingRules | null;
  saving: boolean;
  onSave: (next: ZoomMatchingRules) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ZoomMatchingRules | null>(null);
  const [domainInput, setDomainInput] = useState("");

  useEffect(() => {
    if (open && rules) setDraft({ ...rules, guestEmailDomains: [...rules.guestEmailDomains] });
  }, [open, rules]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !draft) return null;

  function addDomain() {
    if (!draft) return;
    const value = domainInput.trim().toLowerCase().replace(/^@/, "");
    if (!value || draft.guestEmailDomains.includes(value)) {
      setDomainInput("");
      return;
    }
    setDraft({ ...draft, guestEmailDomains: [...draft.guestEmailDomains, value] });
    setDomainInput("");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close matching rules overlay"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)] motion-safe:origin-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="matching-rules-title"
      >
        <header className="shrink-0 border-b border-[var(--admin-border)] px-8 py-6">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h2
              id="matching-rules-title"
              className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]"
            >
              Matching rules
            </h2>
            <button
              type="button"
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Configure the logic used to generate identity suggestions.
          </p>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-8 py-6">
          {(
            [
              {
                key: "matchOnExactEmail" as const,
                title: "Match on exact email",
                confidence: "high" as const,
              },
              {
                key: "matchOnNormalizedDisplayName" as const,
                title: "Match on normalised display name",
                confidence: "medium" as const,
              },
              {
                key: "matchOnEmailDomainPlusEnrollment" as const,
                title: "Match on email domain plus session enrolment",
                confidence: "low" as const,
              },
            ] as const
          ).map((rule, index) => (
            <div key={rule.key}>
              {index > 0 ? <hr className="mb-8 border-[var(--admin-border)]" /> : null}
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-base font-semibold text-[var(--admin-on-surface)]">
                    {rule.title}
                  </span>
                  <ConfidencePill confidence={rule.confidence} />
                </div>
                <RuleToggle
                  checked={draft[rule.key]}
                  label={rule.title}
                  onChange={(next) => {
                    setDraft({ ...draft, [rule.key]: next });
                  }}
                />
              </div>
            </div>
          ))}

          <hr className="border-[var(--admin-border)]" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 pr-2">
              <span className="text-base font-semibold text-[var(--admin-on-surface)]">
                Automatically match high-confidence identities on import
              </span>
              <div className="mt-2 flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-3 text-[var(--admin-warning)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="text-xs">Automatic matching cannot be reviewed before it applies.</p>
              </div>
            </div>
            <RuleToggle
              checked={draft.autoMatchHighConfidenceOnImport}
              label="Automatically match high-confidence identities on import"
              onChange={(next) => {
                setDraft({ ...draft, autoMatchHighConfidenceOnImport: next });
              }}
            />
          </div>

          <hr className="border-[var(--admin-border)]" />

          <div>
            <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              Treat these email domains as guests
            </h3>
            <div className="flex min-h-11 flex-wrap items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] p-2 focus-within:border-[var(--admin-primary)]">
              {draft.guestEmailDomains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1.5 rounded bg-[var(--admin-surface-high)] px-2.5 py-1 text-sm text-[var(--admin-on-surface)]"
                >
                  <span className="font-mono text-[13px]">{domain}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${domain}`}
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    onClick={() => {
                      setDraft({
                        ...draft,
                        guestEmailDomains: draft.guestEmailDomains.filter((d) => d !== domain),
                      });
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <input
                className="min-w-[7.5rem] flex-1 border-none bg-transparent p-0 font-mono text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:outline-none focus:ring-0"
                placeholder="Add domain…"
                value={domainInput}
                onChange={(event) => {
                  setDomainInput(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addDomain();
                  }
                }}
                onBlur={addDomain}
              />
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} h-11 min-w-[7.5rem] px-4`}
            disabled={saving}
            onClick={() => void onSave(draft)}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function UnmatchedLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading unmatched identities">
      <div className="flex justify-between gap-4">
        <div>
          <Shimmer className="mb-2 h-8 w-64" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Shimmer className="h-28 border border-[var(--admin-border)] md:col-span-2" />
        <Shimmer className="h-28 border border-[var(--admin-border)]" />
        <Shimmer className="h-28 border border-[var(--admin-border)]" />
        <Shimmer className="h-28 border border-[var(--admin-border)]" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] md:flex-row"
        >
          <div className="space-y-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5 md:w-5/12 md:border-b-0 md:border-r">
            <Shimmer className="h-5 w-48" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-56" />
          </div>
          <div className="flex-1 space-y-3 p-5">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-16 w-full" />
            <Shimmer className="h-9 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function IdentityCard({
  item,
  busy,
  onMatch,
  onMarkGuest,
  onChooseElse,
}: {
  item: ZoomUnmatchedIdentity;
  busy: boolean;
  onMatch: (item: ZoomUnmatchedIdentity, membershipId: string, applyToOther: boolean) => void;
  onMarkGuest: (item: ZoomUnmatchedIdentity) => void;
  onChooseElse: (item: ZoomUnmatchedIdentity) => void;
}) {
  const top = item.suggestions[0] ?? null;
  const [applyToOther, setApplyToOther] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const choosing = item.group === "none" || !top;

  useEffect(() => {
    if (!choosing) return;
    const term = searchTerm.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchMembers(term)
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [choosing, searchTerm]);

  async function copyId() {
    if (!item.externalUserId) return;
    try {
      await navigator.clipboard.writeText(item.externalUserId);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      data-identity-key={item.identityKey}
      className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] md:flex-row"
    >
      <div className="flex flex-col border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5 md:w-5/12 md:border-b-0 md:border-r">
        <div className="mb-4">
          <h4 className="mb-1 font-mono text-base font-semibold text-[var(--admin-on-surface)]">
            {item.displayName ?? "Unknown Zoom identity"}
          </h4>
          <p className="mb-2 font-mono text-sm text-[var(--admin-on-surface-variant)]">
            {item.email ?? "No email provided"}
          </p>
          {item.externalUserId ? (
            <div className="inline-flex items-center gap-1 rounded bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              ID: {item.externalUserId}
              <button
                type="button"
                className="hover:text-[var(--admin-primary)]"
                aria-label={copied ? "Copied" : "Copy Zoom user id"}
                onClick={() => void copyId()}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-auto space-y-2 text-xs text-[var(--admin-on-surface-variant)]">
          <p className="inline-flex items-center gap-1">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Seen in {formatCount(item.meetingsAttended)} meeting
            {item.meetingsAttended === 1 ? "" : "s"} · {formatDuration(item.totalDurationSeconds)}{" "}
            total
          </p>
          <p className="inline-flex items-center gap-1">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            first {formatDateShort(item.firstSeenAt)}, last {formatDateShort(item.lastSeenAt)}
          </p>
          <Link
            href={`/admin/reports/zoom-insights/${item.representativeMeetingId}/participants/${item.representativeParticipantId}`}
            className="inline-flex items-center gap-1 text-[var(--admin-primary)] hover:underline"
          >
            View their meetings <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-5 md:w-7/12">
        {top && item.group !== "none" ? (
          <>
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Top candidate
                </span>
                <ConfidencePill confidence={top.confidence} />
              </div>
              <div className="mb-2 flex items-center gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-sm font-semibold text-[var(--admin-on-surface-variant)]">
                  {initials(top.displayName, top.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                    {top.displayName ?? "Learner"}
                  </p>
                  <p className="truncate font-mono text-sm text-[var(--admin-on-surface-variant)]">
                    {top.email ?? "—"}
                  </p>
                </div>
                <Link
                  href={`/admin/members/${top.membershipId}`}
                  className="shrink-0 text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                >
                  View profile
                </Link>
              </div>
              <p className="mb-4 inline-flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                Reason: {top.reasonLabel}
              </p>
            </div>
            <div className="space-y-4 border-t border-dashed border-[var(--admin-border)] pt-4">
              <label className="flex w-max cursor-pointer items-center gap-2 text-xs text-[var(--admin-on-surface)]">
                <input
                  type="checkbox"
                  checked={applyToOther}
                  onChange={(event) => {
                    setApplyToOther(event.target.checked);
                  }}
                  className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
                Apply to all {formatCount(item.meetingsAttended)} past meetings and future joins
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={`${primaryButtonClassName} h-9 px-5`}
                  disabled={busy}
                  onClick={() => {
                    onMatch(item, top.membershipId, applyToOther);
                  }}
                >
                  Match {top.displayName?.split(" ")[0] ?? "learner"}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={busy}
                  onClick={() => {
                    onChooseElse(item);
                  }}
                >
                  Choose someone else
                </button>
                <button
                  type="button"
                  className={`${secondaryButtonClassName} ml-auto text-[var(--admin-on-surface-variant)]`}
                  disabled={busy}
                  onClick={() => {
                    onMarkGuest(item);
                  }}
                >
                  Mark as guest
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="mb-4 flex items-center gap-2">
                <SearchX className="h-5 w-5 text-[var(--admin-warning)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {item.group === "guest" ? "Likely guest or device" : "No likely learner found"}
                </span>
              </div>
              <p className="mb-4 text-xs text-[var(--admin-on-surface-variant)]">
                Search the LMS directory to manually assign this identity.
              </p>
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                <input
                  className={`${fieldClassName} pl-10`}
                  placeholder="Search by name or email…"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                  }}
                />
              </div>
              {searching ? (
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">Searching…</p>
              ) : null}
              {results.length > 0 ? (
                <ul className="mt-2 max-w-md overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  {results.map((result) => (
                    <li
                      key={result.id}
                      className="border-b border-[var(--admin-border)] last:border-b-0"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--admin-surface-high)]"
                        disabled={busy}
                        onClick={() => {
                          onMatch(item, result.id, true);
                        }}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-xs font-semibold">
                          {initials(result.label, result.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                            {result.label}
                          </p>
                          <p className="truncate font-mono text-xs text-[var(--admin-on-surface-variant)]">
                            {result.email ?? "—"}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="mt-4 border-t border-dashed border-[var(--admin-border)] pt-4">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                disabled={busy}
                onClick={() => {
                  onMarkGuest(item);
                }}
              >
                <UserX className="h-4 w-4" aria-hidden="true" />
                Mark as generic device / guest
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function CompactReviewCard({
  item,
  busy,
  onMatch,
  onMarkGuest,
}: {
  item: ZoomUnmatchedIdentity;
  busy: boolean;
  onMatch: (item: ZoomUnmatchedIdentity, membershipId: string, applyToOther: boolean) => void;
  onMarkGuest: (item: ZoomUnmatchedIdentity) => void;
}) {
  const top = item.suggestions[0];
  if (!top) {
    return (
      <IdentityCard
        item={item}
        busy={busy}
        onMatch={onMatch}
        onMarkGuest={onMarkGuest}
        onChooseElse={() => undefined}
      />
    );
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] transition-[border-color] hover:border-[color-mix(in_srgb,var(--admin-warning)_45%,var(--admin-border))] md:flex-row">
      <div className="flex flex-col justify-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:w-5/12 md:border-b-0 md:border-r">
        <p className="mb-1 font-mono text-[15px] font-semibold text-[var(--admin-on-surface)]">
          {item.displayName ?? "Unknown"}
        </p>
        <p className="mb-2 font-mono text-sm text-[var(--admin-on-surface-variant)]">
          {item.email ?? "No email provided"}
        </p>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          Seen in {formatCount(item.meetingsAttended)} meeting
          {item.meetingsAttended === 1 ? "" : "s"} · {formatDuration(item.totalDurationSeconds)}{" "}
          total
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-center border-l-2 border-transparent p-4 transition-colors hover:border-[var(--admin-warning)] md:w-7/12">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-sm font-semibold text-[var(--admin-on-surface-variant)]">
              {initials(top.displayName, top.email)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                {top.displayName ?? "Learner"}
              </p>
              <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                {top.email ?? "—"}
              </p>
            </div>
          </div>
          <ConfidencePill confidence={top.confidence} />
        </div>
        <p className="mb-3 text-xs text-[var(--admin-on-surface-variant)]">{top.reasonLabel}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-[var(--admin-surface-high)] px-3 py-1 text-xs font-semibold text-[var(--admin-on-surface)] hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_80%,var(--admin-on-surface))]"
            disabled={busy}
            onClick={() => {
              onMatch(item, top.membershipId, true);
            }}
          >
            Match {top.displayName?.split(" ")[0] ?? "learner"}
          </button>
          <button
            type="button"
            className="rounded border border-[var(--admin-outline)] px-3 py-1 text-xs text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            disabled={busy}
            onClick={() => {
              onMarkGuest(item);
            }}
          >
            Mark guest
          </button>
        </div>
      </div>
    </article>
  );
}

function SummaryBand({ summary }: { summary: ZoomUnmatchedSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Unmatched identities
        </p>
        <p className="font-mono text-[32px] leading-none text-[var(--admin-warning)]">
          {formatCount(summary.unmatchedIdentities)}
        </p>
        <p className="mt-auto border-t border-dashed border-[var(--admin-border)] pt-2 text-xs text-[var(--admin-on-surface-variant)]">
          across {formatCount(summary.meetingCount)} meetings ·{" "}
          {formatCount(summary.joinRecordCount)} join records
        </p>
      </div>
      <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          High-confidence
        </p>
        <p className="font-mono text-2xl text-[var(--admin-success)]">
          {formatCount(summary.highConfidence)}
        </p>
        <p className="mt-auto pt-2 text-xs text-[var(--admin-on-surface-variant)]">
          email matches exactly
        </p>
      </div>
      <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <div className="mb-2 flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Needs review
          </p>
          <span className="font-mono text-2xl text-[var(--admin-warning)]">
            {formatCount(summary.needsReview)}
          </span>
        </div>
        <div className="mt-2 flex items-start justify-between border-t border-dashed border-[var(--admin-border)] pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Likely guests
          </p>
          <span className="font-mono text-xl text-[var(--admin-on-surface-variant)]">
            {formatCount(summary.likelyGuests)}
          </span>
        </div>
      </div>
      <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Attendance not counted
        </p>
        <p className="font-mono text-2xl text-[var(--admin-on-surface)]">
          {formatDuration(summary.attendanceNotCountedSeconds)}
        </p>
        <p className="mt-auto pt-2 text-xs text-[var(--admin-on-surface-variant)]">
          added once matched
        </p>
      </div>
    </div>
  );
}

function GroupSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-2 pt-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
          {title}{" "}
          <span className="font-mono text-sm font-normal text-[var(--admin-on-surface-variant)]">
            ({formatCount(count)})
          </span>
        </h3>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function AdminZoomInsightsUnmatchedPage() {
  const searchId = useId();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ZoomUnmatchedIdentity[]>([]);
  const [groups, setGroups] = useState<{
    high: ZoomUnmatchedIdentity[];
    medium: ZoomUnmatchedIdentity[];
    guest: ZoomUnmatchedIdentity[];
    none: ZoomUnmatchedIdentity[];
  }>({ high: [], medium: [], guest: [], none: [] });
  const [summary, setSummary] = useState<ZoomUnmatchedSummary | null>(null);
  const [connection, setConnection] = useState<ZoomConnectionMeta | null>(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [page, setPage] = useState(1);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState<ZoomMatchingRules | null>(null);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [chooseKey, setChooseKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchZoomUnmatchedIdentities({
        q: searchQ.trim() || undefined,
        group,
        page,
        limit: PAGE_SIZE,
      });
      setItems(response.data.items);
      setGroups(response.data.groups);
      setSummary(response.data.summary);
      setConnection(response.data.connection);
    } catch (err) {
      setError(
        err instanceof ClientApiError ? err.message : "Unable to load unmatched identities.",
      );
    } finally {
      setLoading(false);
    }
  }, [group, page, searchQ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = draftSearch.trim();
      setSearchQ((previous) => {
        if (previous === next) return previous;
        setPage(1);
        return next;
      });
    }, 320);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draftSearch]);

  useEffect(() => {
    void fetchZoomMatchingRules()
      .then((response) => {
        setRules(response.data);
      })
      .catch(() => {
        setRules(null);
      });
  }, []);

  const displayGroups = useMemo(() => {
    if (group === "all") return groups;
    return {
      high: group === "high" ? items : [],
      medium: group === "medium" ? items : [],
      guest: group === "guest" ? items : [],
      none: group === "none" ? items : [],
    };
  }, [group, groups, items]);

  const highForBulk = displayGroups.high.filter(
    (item) => item.suggestions[0]?.confidence === "high",
  );

  async function handleMatch(
    item: ZoomUnmatchedIdentity,
    membershipId: string,
    applyToOtherMeetings: boolean,
  ) {
    setBusy(true);
    try {
      await mutateZoomParticipantMatch(
        item.representativeMeetingId,
        item.representativeParticipantId,
        {
          action: "match",
          membershipId,
          applyToOtherMeetings,
        },
      );
      setChooseKey(null);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to match identity.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkGuest(item: ZoomUnmatchedIdentity) {
    setBusy(true);
    try {
      await mutateZoomParticipantMatch(
        item.representativeMeetingId,
        item.representativeParticipantId,
        { action: "mark_guest", applyToOtherMeetings: true },
      );
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to mark as guest.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkMatchAllHigh() {
    if (highForBulk.length === 0) return;
    setBusy(true);
    try {
      await bulkMatchZoomUnmatched({
        mode: "all_high",
        applyToOtherMeetings: true,
      });
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to bulk match.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    try {
      const queued = await exportZoomInsightsReport({
        emailDownloadLink: false,
      });
      const completed = await pollReportRunUntilComplete(queued.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to export.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRules(next: ZoomMatchingRules) {
    setRulesSaving(true);
    try {
      const response = await updateZoomMatchingRules(next);
      setRules(response.data);
      setRulesOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to save matching rules.");
    } finally {
      setRulesSaving(false);
    }
  }

  const allReconciled = !loading && !error && summary != null && summary.unmatchedIdentities === 0;

  return (
    <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-28">
      <nav className="text-sm text-[var(--admin-on-surface-variant)]">
        <Link href="/admin/reports" className="hover:underline">
          Reports
        </Link>
        <span className="mx-2">/</span>
        <Link href="/admin/reports/zoom-insights" className="hover:underline">
          Zoom Insights
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--admin-on-surface)]">Unmatched</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Zoom Insights
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Reconcile Zoom identities so attendance counts in LMS reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || loading}
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sync now
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} h-9 px-4`}
            disabled={busy}
            onClick={() => void handleExport()}
          >
            Run report
          </button>
        </div>
      </div>

      <ModuleTabs active="unmatched" />

      {connection?.status === "disconnected" ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4">
          <p className="font-semibold text-[var(--admin-danger)]">Zoom is disconnected</p>
          <button
            type="button"
            className={`${secondaryButtonClassName} mt-3`}
            onClick={() => void connectZoomAccount({})}
          >
            Reconnect Zoom
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4">
          <p className="font-semibold text-[var(--admin-danger)]">{error}</p>
          <button
            type="button"
            className={`${secondaryButtonClassName} mt-3`}
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <UnmatchedLoadingSkeleton /> : null}

      {!loading && summary != null && summary.unmatchedIdentities === 0 ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="flex w-full max-w-md flex-col items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center shadow-sm">
            <div className="relative mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <Link2
                className="h-12 w-12 text-[var(--admin-on-surface-variant)] opacity-80"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              Every Zoom participant is matched
            </h2>
            <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              {formatCount(summary.reconciledLast30Days)} identities were reconciled in the last 30
              days.
            </p>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setRulesOpen(true);
              }}
            >
              View matching rules
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !allReconciled && summary ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="mb-1 text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
                Unmatched identities
              </h2>
              <p className="max-w-2xl text-xs text-[var(--admin-on-surface-variant)]">
                Zoom participants with no learner behind them. Matching them makes their attendance
                count in LMS reports.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy}
                onClick={() => void handleExport()}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  setRulesOpen(true);
                }}
              >
                Matching rules
              </button>
              <button
                type="button"
                className={`${primaryButtonClassName} h-9 px-4`}
                disabled={busy || summary.highConfidence === 0}
                onClick={() => void handleBulkMatchAllHigh()}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Auto-match suggestions ({formatCount(summary.highConfidence)})
              </button>
            </div>
          </div>

          <SummaryBand summary={summary} />

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={searchId} className="sr-only">
              Search unmatched identities
            </label>
            <div className="relative min-w-[16rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
              <input
                id={searchId}
                className={`${fieldClassName} pl-10`}
                placeholder="Search name, email, or Zoom id…"
                value={draftSearch}
                onChange={(event) => {
                  setDraftSearch(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setPage(1);
                    setSearchQ(draftSearch.trim());
                  }
                }}
              />
            </div>
            <Select
              value={group}
              ariaLabel="Filter by confidence group"
              onValueChange={(value) => {
                setPage(1);
                setGroup(value as GroupFilter);
              }}
              options={[
                { value: "all", label: "All groups" },
                { value: "high", label: "High confidence" },
                { value: "medium", label: "Needs review" },
                { value: "guest", label: "Likely guests" },
                { value: "none", label: "No suggestion" },
              ]}
              className={selectTriggerClassName}
            />
          </div>

          <GroupSection
            title="High confidence"
            count={displayGroups.high.length}
            action={
              displayGroups.high.length > 0 ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                  disabled={busy}
                  onClick={() => void handleBulkMatchAllHigh()}
                >
                  Match all in this group
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null
            }
          >
            {displayGroups.high.map((item) =>
              chooseKey === item.identityKey ? (
                <IdentityCard
                  key={item.identityKey}
                  item={{ ...item, group: "none", suggestions: [] }}
                  busy={busy}
                  onMatch={(item, membershipId, applyToOther) => {
                    void handleMatch(item, membershipId, applyToOther);
                  }}
                  onMarkGuest={(item) => {
                    void handleMarkGuest(item);
                  }}
                  onChooseElse={() => {
                    setChooseKey(null);
                  }}
                />
              ) : (
                <IdentityCard
                  key={item.identityKey}
                  item={item}
                  busy={busy}
                  onMatch={(itemArg, membershipId, applyToOther) => {
                    void handleMatch(itemArg, membershipId, applyToOther);
                  }}
                  onMarkGuest={(itemArg) => {
                    void handleMarkGuest(itemArg);
                  }}
                  onChooseElse={(target) => {
                    setChooseKey(target.identityKey);
                  }}
                />
              ),
            )}
          </GroupSection>

          <GroupSection title="Needs review" count={displayGroups.medium.length}>
            {displayGroups.medium.map((item) => (
              <CompactReviewCard
                key={item.identityKey}
                item={item}
                busy={busy}
                onMatch={(itemArg, membershipId, applyToOther) => {
                  void handleMatch(itemArg, membershipId, applyToOther);
                }}
                onMarkGuest={(itemArg) => {
                  void handleMarkGuest(itemArg);
                }}
              />
            ))}
          </GroupSection>

          <GroupSection title="No suggestion" count={displayGroups.none.length}>
            {displayGroups.none.map((item) => (
              <IdentityCard
                key={item.identityKey}
                item={item}
                busy={busy}
                onMatch={(itemArg, membershipId, applyToOther) => {
                  void handleMatch(itemArg, membershipId, applyToOther);
                }}
                onMarkGuest={(itemArg) => {
                  void handleMarkGuest(itemArg);
                }}
                onChooseElse={() => undefined}
              />
            ))}
          </GroupSection>

          <GroupSection title="Likely guests" count={displayGroups.guest.length}>
            {displayGroups.guest.map((item) => (
              <IdentityCard
                key={item.identityKey}
                item={item}
                busy={busy}
                onMatch={(itemArg, membershipId, applyToOther) => {
                  void handleMatch(itemArg, membershipId, applyToOther);
                }}
                onMarkGuest={(itemArg) => {
                  void handleMarkGuest(itemArg);
                }}
                onChooseElse={() => undefined}
              />
            ))}
          </GroupSection>
        </>
      ) : null}

      {!loading && !allReconciled && highForBulk.length > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 py-4 shadow-[0_-4px_12px_color-mix(in_srgb,var(--admin-on-surface)_6%,transparent)]">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" />
              <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                {formatCount(highForBulk.length)} high-confidence matches ready
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  const first = highForBulk[0];
                  if (!first) return;
                  const el = document.querySelector(
                    `[data-identity-key="${CSS.escape(first.identityKey)}"]`,
                  );
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                Review each
              </button>
              <button
                type="button"
                className={`${primaryButtonClassName} h-9 px-6`}
                disabled={busy}
                onClick={() => void handleBulkMatchAllHigh()}
              >
                Match all {formatCount(highForBulk.length)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MatchingRulesDrawer
        open={rulesOpen}
        onClose={() => {
          setRulesOpen(false);
        }}
        rules={rules}
        saving={rulesSaving}
        onSave={handleSaveRules}
      />
    </div>
  );
}
