import { csvRow } from "../../../lib/export/csv";
import type { PublishStatus } from "./learner-products-api";

/**
 * Presentation vocabulary for the learner-product catalogue.
 *
 * Kept out of the components so the table, the bulk bar, the enrol dialog and
 * the four empty/error states cannot drift apart, and so every surface here
 * resolves through `--admin-*` tokens and therefore works in both themes.
 */

/**
 * The four product DTOs flattened to one row shape.
 *
 * `items` is what separates a bundle from a mock test in this table: a mock
 * test wraps a single assessment and has no contents list, so its row never
 * expands. Keeping that as an empty array rather than a per-tab branch is what
 * lets one table render all four catalogues.
 */
export type ProductRow = {
  id: string;
  slug: string;
  title: string;
  status: PublishStatus;
  updatedAt: string;
  /** Short summary rendered in the Contents column ("7 items", "monthly · 5 items"). */
  detail: string;
  items: Array<{ id: string; kind: string; position: number; title: string | null }>;
};

export const catalogueNoteClassName =
  "flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_7%,var(--admin-surface))] p-4";

export const catalogueTabBarClassName =
  "flex gap-1 overflow-x-auto border-b border-[var(--admin-border)]";

export const catalogueTabClassName =
  "flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40";

export const catalogueTabActiveClassName =
  "border-[var(--admin-primary)] font-semibold text-[var(--admin-primary)]";

export const catalogueTabCountClassName =
  "rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--admin-on-surface-variant)]";

export const catalogueToolbarClassName =
  "flex flex-col gap-3 md:flex-row md:items-center md:justify-between";

export const catalogueSearchInputClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2.5 pl-9 pr-9 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25";

export const catalogueTableShellClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)]";

export const catalogueTableHeadCellClassName =
  "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const catalogueRowClassName =
  "group border-t border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_60%,transparent)]";

export const catalogueRowSelectedClassName =
  "bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]";

export const catalogueSlugChipClassName =
  "font-data inline-block rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]";

export const catalogueIconButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50";

export const catalogueItemChipClassName =
  "inline-flex items-center gap-2 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-medium text-[var(--admin-on-surface)]";

export const catalogueCheckboxClassName =
  "h-4 w-4 cursor-pointer rounded border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-primary)] accent-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40";

export const catalogueBulkBarClassName =
  "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-4 py-3 motion-safe:animate-[admin-banner-in_0.2s_cubic-bezier(0.16,1,0.3,1)]";

export const catalogueBulkButtonClassName =
  "inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50";

export const catalogueEmptyPanelClassName =
  "admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center";

export const cataloguePagerButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:cursor-not-allowed disabled:opacity-40";

type StatusTone = "success" | "neutral" | "muted";

const STATUS_TONE: Record<StatusTone, string> = {
  success:
    "border-[color-mix(in_srgb,var(--admin-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]",
  neutral:
    "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  muted:
    "border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-on-surface)_6%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]",
};

function statusTone(status: PublishStatus): StatusTone {
  const normalised = status.toUpperCase();
  if (normalised === "PUBLISHED") return "success";
  if (normalised === "ARCHIVED") return "muted";
  return "neutral";
}

export function statusChipClassName(status: PublishStatus): string {
  return [
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
    STATUS_TONE[statusTone(status)],
  ].join(" ");
}

/** `PUBLISHED` reads as shouting in a table cell; the API value stays untouched. */
export function statusLabel(status: PublishStatus): string {
  const lower = status.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * ISO date, day precision, locale-independent.
 *
 * The catalogue is ordered by this column and operators compare rows down the
 * page, so a stable `YYYY-MM-DD` scans better than a localised string whose
 * width changes per row.
 */
export function formatUpdatedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 10);
}

/** Human label for a bundle / plan item kind (`mock_test` → `Mock test`). */
export function itemKindLabel(kind: string): string {
  const spaced = kind.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Build a CSV from already-raw values.
 *
 * `csvRow` rather than local quoting: product titles and slugs are
 * tenant-authored, and an admin opens this export in a spreadsheet. Correct
 * quoting alone is not enough — a title beginning `=`, `+`, `-` or `@`
 * evaluates as a formula once the sheet strips the quotes, so the shared
 * escaper's leading-apostrophe guard is the part that matters here.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => csvRow(row)).join("\r\n");
}
