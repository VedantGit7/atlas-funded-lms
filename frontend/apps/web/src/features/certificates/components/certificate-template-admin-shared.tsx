import type { z } from "zod";
import { Archive, Ban, CheckCircle2, Clock3, FileEdit, History, PauseCircle } from "lucide-react";
import type {
  certificateDtoSchema,
  certificateTemplateDtoSchema,
} from "@atlas/contracts/certificates/certificate.dto";

export type TemplateDto = z.infer<typeof certificateTemplateDtoSchema>;
export type TemplateStatus = TemplateDto["status"];
export type CertificateDto = z.infer<typeof certificateDtoSchema>;
export type CertificateStatus = CertificateDto["status"];

export const fieldClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm font-medium text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60";

export const monoFieldClassName = `${fieldClassName} font-mono text-xs tracking-wide`;

export const labelClassName = "text-[13px] font-medium text-[var(--admin-on-surface-variant)]";

export const helperClassName = "text-xs text-[var(--admin-on-surface-variant)]";

export const cardClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const sectionTitleClassName = "text-lg font-semibold text-[var(--admin-on-surface)]";

export const sectionDescClassName = "mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]";

export const primaryButtonClassName =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--admin-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const outlineButtonClassName =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--admin-border)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50";

export const dangerOutlineButtonClassName =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--admin-danger)]/30 px-4 py-2.5 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[var(--admin-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClassName =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--admin-danger)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButtonClassName =
  "inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50";

export const errorBannerClassName =
  "rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]";

export const infoBannerClassName =
  "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]";

export const iconButtonClassName =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-40";

export const dangerIconButtonClassName =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] hover:text-[var(--admin-danger)] disabled:cursor-not-allowed disabled:opacity-40";

const STATUS_META: Record<
  TemplateStatus,
  { label: string; icon: typeof CheckCircle2; tone: string }
> = {
  DRAFT: { label: "Draft", icon: FileEdit, tone: "var(--admin-on-surface-variant)" },
  REVIEW: { label: "In review", icon: Clock3, tone: "var(--admin-warning)" },
  PUBLISHED: { label: "Published", icon: CheckCircle2, tone: "var(--admin-success)" },
  ARCHIVED: { label: "Archived", icon: Archive, tone: "var(--admin-on-surface-variant)" },
};

export function StatusPill({ status }: { status: TemplateStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color: meta.tone,
        backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`,
      }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}

export function TemplateRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--admin-surface-high)]" />
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--admin-surface-high)]" />
      </div>
      <div className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-[var(--admin-surface-high)]" />
    </div>
  );
}

const CERT_STATUS_META: Record<
  CertificateStatus,
  { label: string; icon: typeof CheckCircle2; tone: string }
> = {
  issued: { label: "Issued", icon: CheckCircle2, tone: "var(--admin-success)" },
  expired: { label: "Expired", icon: History, tone: "var(--admin-on-surface-variant)" },
  revoked: { label: "Revoked", icon: Ban, tone: "var(--admin-danger)" },
  suspended: { label: "Suspended", icon: PauseCircle, tone: "var(--admin-warning)" },
};

export function CertificateStatusPill({ status }: { status: CertificateStatus }) {
  const meta = CERT_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color: meta.tone,
        backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`,
      }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}

/** Deterministic 1-2 letter initials for a recipient label, for the avatar chip. */
export function avatarInitials(label: string): string {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function CertificateRowSkeleton() {
  return (
    <tr className="border-b border-[var(--admin-border)]">
      <td className="px-4 py-4">
        <div className="h-3.5 w-24 animate-pulse rounded bg-[var(--admin-surface-high)]" />
      </td>
      <td className="px-4 py-4">
        <div className="h-3.5 w-36 animate-pulse rounded bg-[var(--admin-surface-high)]" />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 animate-pulse rounded-full bg-[var(--admin-surface-high)]" />
          <div className="h-3.5 w-28 animate-pulse rounded bg-[var(--admin-surface-high)]" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--admin-surface-high)]" />
      </td>
      <td className="px-4 py-4">
        <div className="h-3.5 w-20 animate-pulse rounded bg-[var(--admin-surface-high)]" />
      </td>
      <td className="px-4 py-4">
        <div className="h-3.5 w-16 animate-pulse rounded bg-[var(--admin-surface-high)]" />
      </td>
    </tr>
  );
}
