/**
 * Presentation helpers for the learner credential wallet.
 *
 * Nothing here fabricates data: statuses, dates, and identifiers all come from
 * the certificate contract. Status tones map to design tokens (--success,
 * --warning, --destructive) so light and dark mode swap automatically.
 */

import { Award, BookOpen, GraduationCap, Landmark, ScrollText, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { z } from "zod";
import type { certificateDtoSchema } from "@atlas/contracts/certificates/certificate.dto";

export type CertificateDto = z.infer<typeof certificateDtoSchema>;
export type CertificateStatus = CertificateDto["status"];
export type StatusFilter = "all" | CertificateStatus;

export type StatusMeta = {
  label: string;
  /** CSS custom property that carries the tone colour in both themes. */
  cssVar: "--success" | "--warning" | "--destructive";
};

const STATUS_META: Record<CertificateStatus, StatusMeta> = {
  issued: { label: "Issued", cssVar: "--success" },
  expired: { label: "Expired", cssVar: "--warning" },
  revoked: { label: "Revoked", cssVar: "--destructive" },
  suspended: { label: "Suspended", cssVar: "--warning" },
};

export function statusMeta(status: CertificateStatus): StatusMeta {
  return STATUS_META[status];
}

/** Ordered options for the wallet status filter. */
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "issued", label: "Issued" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
  { value: "suspended", label: "Suspended" },
];

const CREDENTIAL_ICONS: LucideIcon[] = [
  Award,
  GraduationCap,
  ShieldCheck,
  BookOpen,
  ScrollText,
  Landmark,
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/** Deterministic decorative icon so a credential always shows the same glyph. */
export function certificateIcon(seed: string): LucideIcon {
  return CREDENTIAL_ICONS[hashSeed(seed) % CREDENTIAL_ICONS.length] ?? Award;
}

/** Human issue date, e.g. "Oct 12, 2023". Empty string when unparseable. */
export function formatIssueDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export type ShareTargets = {
  linkedin: string;
  twitter: string;
  email: string;
};

/** Share-intent URLs for the public verification link. */
export function shareTargets(url: string, title: string): ShareTargets {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`Verify this credential: ${url}`)}`,
  };
}

/** Query string for the certificates list endpoint, honouring the active filter. */
export function buildListQuery(status: StatusFilter, cursor: string | null, limit: number): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (status !== "all") params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}
