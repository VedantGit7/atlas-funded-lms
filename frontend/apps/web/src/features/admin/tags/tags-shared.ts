import { csvRow } from "../../../lib/export/csv";
import type { Tag, TagVisibility } from "./tags-api";

/**
 * Presentation vocabulary for the tag console.
 *
 * Kept out of the components so the table, the editor, the bulk bar and the
 * five empty/error states cannot drift apart, and so every surface resolves
 * through `--admin-*` tokens and therefore renders in both themes.
 */

export const tagNoteClassName =
  "flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_32%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_9%,var(--admin-surface))] p-4";

export const tagToolbarClassName =
  "flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3 lg:flex-row lg:items-center lg:justify-between";

export const tagSegmentedGroupClassName =
  "inline-flex overflow-hidden rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)]";

export const tagSegmentClassName =
  "px-3 py-2 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50";

export const tagSegmentActiveClassName =
  "bg-[var(--admin-primary)] font-semibold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary)]";

export const tagCountChipClassName =
  "font-data rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1 text-xs tabular-nums text-[var(--admin-on-surface-variant)]";

export const tagBulkBarClassName =
  "admin-glass sticky top-2 z-20 flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out] md:flex-row md:items-center md:justify-between";

export const tagBulkButtonClassName =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50";

export const tagBulkDangerButtonClassName =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-danger)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)] disabled:cursor-not-allowed disabled:opacity-50";

export const tagGroupHeadingClassName =
  "font-data border-y border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--admin-on-surface-variant)]";

export const tagRowClassName =
  "group border-b border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_65%,transparent)]";

export const tagRowSelectedClassName =
  "bg-[color-mix(in_srgb,var(--admin-primary)_9%,transparent)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)]";

export const tagCheckboxClassName =
  "h-4 w-4 shrink-0 cursor-pointer accent-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]";

export const tagSlugClassName =
  "font-data inline-flex items-center gap-1 text-[11px] text-[var(--admin-on-surface-variant)]";

export const tagIconButtonClassName =
  "rounded-md p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50";

export const tagDangerIconButtonClassName =
  "rounded-md p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] hover:text-[var(--admin-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)] disabled:cursor-not-allowed disabled:opacity-50";

export const tagFieldClassName =
  "w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25";

export const tagFieldLabelClassName =
  "mb-1 flex items-baseline justify-between gap-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]";

export const tagInlineErrorClassName =
  "flex items-start gap-2 rounded-lg border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-danger)]";

/** Sentence-case label for a stored visibility value. */
export function visibilityLabel(visibility: TagVisibility): string {
  if (visibility === "private") return "Private";
  if (visibility === "classification") return "Classification";
  return "Public";
}

/**
 * One line explaining what each value means, shown wherever it is selectable.
 *
 * `classification` is the one that needs it: it marks a structural tag used to
 * categorise rather than to describe, and what it categorises is tenant-defined
 * — so the caption says that rather than inventing a taxonomy.
 */
export function visibilityCaption(visibility: TagVisibility): string {
  if (visibility === "private") return "Hidden from learners; visible to staff only.";
  if (visibility === "classification") {
    return "A structural tag used to categorise rather than describe. What it categorises is up to this academy.";
  }
  return "Visible to learners wherever the course or lesson is.";
}

export function visibilityChipClassName(visibility: TagVisibility): string {
  const base =
    "font-data inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (visibility === "private") {
    return `${base} border-[color-mix(in_srgb,var(--admin-on-surface-variant)_40%,transparent)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`;
  }
  if (visibility === "classification") {
    return `${base} border-[color-mix(in_srgb,var(--admin-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]`;
  }
  return `${base} border-[color-mix(in_srgb,var(--admin-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]`;
}

export const TAG_SORTS = [
  { value: "title-asc", label: "Name (A–Z)" },
  { value: "title-desc", label: "Name (Z–A)" },
  { value: "usage-desc", label: "Most used" },
  { value: "usage-asc", label: "Least used" },
] as const;

export type TagSort = (typeof TAG_SORTS)[number]["value"];

/** Total attachments, used for the two usage sorts. */
export function totalUsage(tag: Tag): number {
  return (tag.usage?.courses ?? 0) + (tag.usage?.lessons ?? 0);
}

export function sortTags(tags: Tag[], sort: TagSort): Tag[] {
  const sorted = [...tags];
  if (sort === "title-desc") {
    return sorted.sort((a, b) => b.title.localeCompare(a.title));
  }
  if (sort === "usage-desc") {
    // Ties fall back to the name so the order is stable between refreshes
    // rather than reshuffling every time two tags share a count.
    return sorted.sort((a, b) => totalUsage(b) - totalUsage(a) || a.title.localeCompare(b.title));
  }
  if (sort === "usage-asc") {
    return sorted.sort((a, b) => totalUsage(a) - totalUsage(b) || a.title.localeCompare(b.title));
  }
  return sorted.sort((a, b) => a.title.localeCompare(b.title));
}

/** The letter a tag files under; anything not A–Z groups together as `#`. */
export function groupKeyFor(tag: Tag): string {
  const first = tag.title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

/**
 * The comparison key behind the duplicate flag.
 *
 * Case, punctuation and a trailing plural are exactly the differences that
 * produce a vocabulary carrying both "Beginner" and "beginners" — the mess this
 * screen exists to clear. It is a heuristic, so the flag reads "Possible
 * duplicate" and never merges anything on its own.
 */
export function duplicateKey(title: string): string {
  const normalised = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  // "classes" → "class". Only after a sibilant stem: stripping "es" from
  // "rules" would give "rul", which then fails to match "rule".
  if (normalised.length > 4 && /[sxzh]es$/.test(normalised)) return normalised.slice(0, -2);
  // "beginners" → "beginner". Short words keep their "s", so "Ops" is not "Op",
  // and a stem that already ends in "ss" keeps it — "class" is not "clas".
  if (normalised.length > 3 && normalised.endsWith("s") && !normalised.endsWith("ss")) {
    return normalised.slice(0, -1);
  }
  return normalised;
}

/** Ids of every tag sharing a duplicate key with at least one other tag. */
export function findDuplicateIds(tags: Tag[]): Set<string> {
  const buckets = new Map<string, string[]>();
  for (const tag of tags) {
    const key = duplicateKey(tag.title);
    if (key === "") continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(tag.id);
    else buckets.set(key, [tag.id]);
  }

  const duplicates = new Set<string>();
  for (const ids of buckets.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) duplicates.add(id);
  }
  return duplicates;
}

/** Human summary of a tag's usage, or the honest zero. */
export function usageLabel(usage: TagUsageLike | undefined): string {
  if (!usage) return "—";
  const parts: string[] = [];
  if (usage.courses > 0) {
    parts.push(`${String(usage.courses)} ${usage.courses === 1 ? "course" : "courses"}`);
  }
  if (usage.lessons > 0) {
    parts.push(`${String(usage.lessons)} ${usage.lessons === 1 ? "lesson" : "lessons"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Not attached";
}

type TagUsageLike = { courses: number; lessons: number };

/**
 * CSV export of the visible tags.
 *
 * Goes through the shared escaper: tag titles and descriptions are authored in
 * the app and a leading `=` in one of them would be evaluated by the
 * spreadsheet that opens this file.
 */
export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [csvRow(headers), ...rows.map((row) => csvRow(row))].join("\r\n");
}

export const tagEmptyPanelClassName =
  "admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center";

export const tagTableShellClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)]";

export const tagTableHeadCellClassName =
  "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const tagFooterNoteClassName =
  "border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 text-center text-xs text-[var(--admin-on-surface-variant)]";

/**
 * The row for a just-created tag.
 *
 * A new tag sorts into the middle of an alphabetical list rather than appearing
 * at the top, so without this an operator has no idea where it went. The tint
 * persists until dismissed rather than fading on a timer — the answer to "where
 * did it land" should still be on screen after the operator looks away.
 */
export const tagRowHighlightClassName =
  "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--admin-success)_16%,transparent)]";

/**
 * The live tag already holding a derived slug, if any.
 *
 * A hard block on the create form, because the unique index on
 * `(tenant_id, slug)` will reject it regardless — catching it here turns a
 * failed round-trip into a message on the field.
 */
export function findSlugClash(tags: Tag[], slug: string): Tag | null {
  if (slug === "") return null;
  return tags.find((tag) => tag.slug === slug) ?? null;
}

/**
 * Existing tags that mean the same thing under a different spelling.
 *
 * A warning, never a block: two similarly named tags are sometimes genuinely
 * different, and the operator is the one who knows. The exact slug clash is
 * excluded because it is reported separately and more severely.
 */
export function findNearDuplicates(tags: Tag[], title: string, excludeId?: string): Tag[] {
  const key = duplicateKey(title.trim());
  if (key === "") return [];
  return tags.filter((tag) => tag.id !== excludeId && duplicateKey(tag.title) === key);
}

/** Absolute timestamp, for the metadata block where precision matters. */
export function formatTagTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Relative timestamp, paired with the absolute one rather than replacing it.
 *
 * "2 days ago" is what an operator reads; the exact time is what they need when
 * correlating with anything else, so the metadata block shows both.
 */
export function formatTagRelative(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(diffMs / 3_600_000);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(diffMs / 86_400_000);
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  const months = Math.round(days / 30);
  return formatter.format(months, "month");
}

/**
 * Plain-English label for a tag audit action.
 *
 * Unknown actions fall back to the raw identifier rather than being hidden: an
 * action this screen has not been taught about still happened, and swallowing
 * it would make the history quietly incomplete.
 */
export function tagAuditActionLabel(action: string): string {
  if (action === "tag.create") return "Created";
  if (action === "tag.update") return "Edited";
  if (action === "tag.delete") return "Deleted";
  if (action === "tag.merge") return "Another tag merged into this one";
  return action;
}

export type DuplicateGroup = {
  key: string;
  /** Why these were grouped, derived from the titles rather than asserted. */
  reason: string;
  tags: Tag[];
};

/**
 * Why a set of titles collapsed to the same key.
 *
 * Named from the titles themselves rather than from which branch of
 * `duplicateKey` fired, so the label is a statement about the data an operator
 * can check by eye, not about the implementation.
 */
function duplicateReason(tags: Tag[]): string {
  const lowered = new Set(tags.map((tag) => tag.title.toLowerCase()));
  if (lowered.size === 1) return "Differs only by case";

  const stripped = new Set(tags.map((tag) => tag.title.toLowerCase().replace(/[^a-z0-9]/g, "")));
  if (stripped.size === 1) return "Differs only by spacing or punctuation";

  return "Differs only by pluralisation";
}

/**
 * Every cluster of near-duplicate tags, largest first.
 *
 * Clusters rather than pairs: a vocabulary that has drifted usually carries
 * "Beginner", "beginners" and "Beginner's guide" together, and presenting that
 * as three separate pairs would make the operator merge the same idea twice.
 */
export function findDuplicateGroups(tags: Tag[]): DuplicateGroup[] {
  const buckets = new Map<string, Tag[]>();
  for (const tag of tags) {
    const key = duplicateKey(tag.title);
    if (key === "") continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(tag);
    else buckets.set(key, [tag]);
  }

  return [...buckets.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const sorted = [...group].sort((a, b) => a.title.localeCompare(b.title));
      return { key, reason: duplicateReason(sorted), tags: sorted };
    })
    .sort((a, b) => b.tags.length - a.tags.length || a.key.localeCompare(b.key));
}

/**
 * The tag a merge should default to keeping.
 *
 * The most-attached one: re-pointing the smaller side is the cheaper mistake if
 * the operator confirms without reading. Ties fall back to the name so the
 * default does not move between renders.
 */
export function suggestSurvivor(tags: Tag[]): Tag | null {
  if (tags.length === 0) return null;
  return [...tags].sort(
    (a, b) => totalUsage(b) - totalUsage(a) || a.title.localeCompare(b.title),
  )[0] as Tag;
}
