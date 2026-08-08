/**
 * Presentation helpers shared by the learner readiness surface.
 *
 * Tone is derived from the numeric score (0-100), never from a hardcoded band
 * key, so tenant-configured band names stay data-driven while the colour still
 * signals health. Every colour resolves to a design token so light and dark
 * mode swap automatically.
 */

export const READINESS_SCORE_MAX = 100;

export type ReadinessTone = "strong" | "steady" | "watch";

type ReadinessToneStyle = {
  tone: ReadinessTone;
  /** CSS colour for gauge strokes / accents (design token). */
  gaugeColor: string;
  /** Chip className: tinted surface + contrast-boosted label + hairline ring. */
  chipClassName: string;
  /** Soft tinted surface for icons / accents (design token via color-mix). */
  softSurface: string;
};

const TONE_STYLES: Record<ReadinessTone, ReadinessToneStyle> = {
  strong: {
    tone: "strong",
    gaugeColor: "var(--success)",
    chipClassName:
      "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[color-mix(in_srgb,var(--success)_72%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--success)_32%,transparent)]",
    softSurface: "color-mix(in srgb, var(--success) 12%, transparent)",
  },
  steady: {
    tone: "steady",
    gaugeColor: "var(--warning)",
    chipClassName:
      "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[color-mix(in_srgb,var(--warning)_74%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--warning)_34%,transparent)]",
    softSurface: "color-mix(in srgb, var(--warning) 14%, transparent)",
  },
  watch: {
    tone: "watch",
    gaugeColor: "var(--destructive)",
    chipClassName:
      "bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)] text-[color-mix(in_srgb,var(--destructive)_72%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--destructive)_32%,transparent)]",
    softSurface: "color-mix(in srgb, var(--destructive) 12%, transparent)",
  },
};

/** Maps a 0-100 score to a semantic tone. Mid/low thresholds mirror the design brief. */
export function readinessTone(score: number): ReadinessToneStyle {
  if (score >= 65) return TONE_STYLES.strong;
  if (score >= 45) return TONE_STYLES.steady;
  return TONE_STYLES.watch;
}

/** Clamps any raw score into the 0-100 gauge range. */
export function toGaugePercent(score: number): number {
  return Math.max(0, Math.min(READINESS_SCORE_MAX, score));
}

/**
 * Turns a band key or label into a display string. Band values are
 * tenant-configured, so this only formats casing and never invents copy.
 */
export function formatBandLabel(value: string | null | undefined): string {
  if (!value) return "Unassigned";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  if (spaced.length === 0) return "Unassigned";
  return spaced
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Short, locale-aware label for momentum chart ticks. */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full timestamp for "last updated" style captions. */
export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
