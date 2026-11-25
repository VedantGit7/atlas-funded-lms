import {
  cardClassName,
  cardHeaderClassName,
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  pendingPanelClassName,
  selectClassName,
  statusBannerClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { academyDateTimeFormat } from "../../../lib/format/academy-format";

export {
  cardClassName,
  cardHeaderClassName,
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  pendingPanelClassName,
  selectClassName,
  statusBannerClassName,
};

export const infoBannerClassName =
  "flex items-start gap-3 rounded-lg border border-[var(--admin-primary)]/20 bg-[color-mix(in_srgb,var(--admin-primary-container)_28%,var(--admin-surface))] px-4 py-3";

export const columnLabelClassName =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const actionBadgeClassName =
  "inline-flex max-w-full rounded-md bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] text-[var(--admin-on-surface)]";

export const detailButtonClassName = (active: boolean) =>
  [
    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
    active
      ? "border-[var(--admin-primary)] bg-[var(--admin-primary-container)]/20 text-[var(--admin-primary)]"
      : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)]/40 hover:text-[var(--admin-primary)]",
  ].join(" ");

export const metadataPreClassName =
  "overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 font-mono text-xs leading-relaxed text-[var(--admin-on-surface)]";

export const detailLabelClassName =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const detailValueClassName = "mt-1 text-sm text-[var(--admin-on-surface)]";

/** Events whose code says nothing useful when read as words. */
const AUDIT_ACTION_WORDS: Record<string, string> = {
  "api.mutation": "Change saved",
  "identity.membership.status_changed": "Member status changed",
  "identity.membership.password_reset_sent": "Password reset email sent",
};

/** Code names for things that have a different name on screen (QA review 2 4.3.3). */
function onScreenWords(words: string): string {
  return words
    .replace(/\btenant config\b/g, "academy settings")
    .replace(/\btenant\b/g, "academy")
    .replace(/\bcourse module\b/g, "section")
    .replace(/\bcourse lesson\b/g, "lesson")
    .replace(/\bitem bank\b/g, "question bank")
    .replace(/\bitems?\b/g, (word) => (word === "items" ? "questions" : "question"));
}

/** "certificate.issued" as "Certificate issued": the event in words, not its code. */
export function humanizeAuditAction(action: string): string {
  const known = AUDIT_ACTION_WORDS[action];
  if (known) return known;
  const words = onScreenWords(action.split(/[._]+/).filter(Boolean).join(" ").toLowerCase());
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Change";
}

export function formatAuditTimestamp(iso: string): string {
  const date = new Date(iso);
  return academyDateTimeFormat({
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Who did it, by name: never a raw ID (QA review 2 4.3.2). */
export function formatActorLabel(entry: {
  actorMembershipId: string | null;
  platformPrincipalId: string | null;
  actorName?: string | null | undefined;
}): string {
  if (entry.actorName?.trim()) return entry.actorName.trim();
  if (entry.actorMembershipId) return "A former member";
  if (entry.platformPrincipalId) return "Platform support";
  return "System";
}

/** "course_lesson" as "Course lesson". */
export function humanizeAuditTarget(targetType: string): string {
  const words = onScreenWords(
    targetType
      .split(/[._\s-]+/)
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  );
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Record";
}

export function matchesAuditSearch(
  entry: {
    action: string;
    targetType: string;
    targetId: string | null;
    requestId: string;
    reason: string | null;
  },
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    entry.action,
    humanizeAuditAction(entry.action),
    entry.targetType,
    entry.targetId ?? "",
    entry.requestId,
    entry.reason ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}
