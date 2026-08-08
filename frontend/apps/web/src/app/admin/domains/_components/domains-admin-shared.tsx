import type { z } from "zod";
import type {
  DomainStatusSchema,
  DomainTypeSchema,
} from "@atlas/domain-branding/schemas/domains";

type DomainStatus = z.infer<typeof DomainStatusSchema>;
type DomainType = z.infer<typeof DomainTypeSchema>;

export const monoHostnameClassName =
  "font-mono text-[13px] leading-[18px] text-[var(--admin-primary)] rounded bg-[var(--admin-primary)]/5 px-1.5 py-0.5";

export const tableHeaderClassName =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const dnsPanelClassName =
  "rounded-lg border border-[var(--admin-primary)]/20 bg-[color-mix(in_srgb,var(--admin-primary-container)_25%,var(--admin-surface))] p-6 motion-safe:animate-[admin-slide-up_0.35s_cubic-bezier(0.16,1,0.3,1)]";

export function formatDomainType(type: DomainType): string {
  if (type === "ATLAS_SUBDOMAIN") return "Atlas subdomain";
  return "Custom domain";
}

export function formatDomainStatus(status: DomainStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PENDING":
      return "Pending verification";
    case "VERIFYING":
      return "Verifying DNS";
    case "FAILED":
      return "Verification failed";
    case "DISABLED":
      return "Disabled";
    default:
      return status;
  }
}

export function domainTypeBadgeClassName(type: DomainType): string {
  if (type === "ATLAS_SUBDOMAIN") {
    return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  }
  return "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]";
}

export function domainStatusBadgeClassName(status: DomainStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-[var(--admin-success)]/15 text-[var(--admin-success)]";
    case "PENDING":
    case "VERIFYING":
      return "bg-[var(--admin-warning)]/15 text-[var(--admin-warning)]";
    case "FAILED":
      return "bg-[var(--admin-danger)]/15 text-[var(--admin-danger)]";
    default:
      return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  }
}

export function domainStatusDotClassName(status: DomainStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-[var(--admin-success)]";
    case "PENDING":
    case "VERIFYING":
      return "bg-[var(--admin-warning)] motion-safe:animate-pulse";
    case "FAILED":
      return "bg-[var(--admin-danger)]";
    default:
      return "bg-[var(--admin-on-surface-variant)]";
  }
}

export function needsDnsVerification(status: DomainStatus): boolean {
  return status === "PENDING" || status === "VERIFYING";
}
