/**
 * Presentation helpers for the learner diagnostic surface (catalog, runner,
 * results). Colour/tone is derived from the numeric score via the shared
 * readiness tone system so light/dark mode and tenant band names stay
 * data-driven. Copy here is generic and educational — it never asserts a
 * guaranteed outcome or financial advice.
 */
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Compass,
  Info,
  LineChart,
  ShieldCheck,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  formatBandLabel,
  readinessTone,
  toGaugePercent,
  type ReadinessTone,
} from "../readiness/readiness-view";
import type { DiagnosticCatalogItem, DiagnosticCatalogStatus } from "@atlas/contracts-modules/diagnostics/diagnostic.types";

export { formatBandLabel, readinessTone, toGaugePercent };
export type { ReadinessTone };

/** Icons cycled across catalog cards, keyed by position for stable rendering. */
const CATALOG_ICONS: LucideIcon[] = [TrendingUp, LineChart, ShieldCheck, Target, BarChart3, Compass];

export function catalogIcon(index: number): LucideIcon {
  return CATALOG_ICONS[index % CATALOG_ICONS.length] ?? Compass;
}

export function formatDuration(minutes: number): string {
  return `~${String(minutes)} min`;
}

export function formatQuestionCount(count: number): string {
  return `${String(count)} ${count === 1 ? "question" : "questions"}`;
}

export type CatalogStatusMeta = {
  label: string;
  icon: LucideIcon;
  /** Chip className: tinted surface + contrast label + hairline ring. */
  chipClassName: string;
};

const NEUTRAL_CHIP =
  "bg-muted text-muted-foreground ring-1 ring-inset ring-[color-mix(in_srgb,var(--muted-foreground)_24%,transparent)]";

/**
 * Status chip for a catalog card. Completed cards surface the tenant band label
 * (tone-coloured); other states use neutral/informational chrome.
 */
export function catalogStatusMeta(item: DiagnosticCatalogItem): CatalogStatusMeta {
  switch (item.status) {
    case "completed": {
      const tone = readinessTone(item.overallScore ?? 0);
      return {
        label: item.overallBandLabel ? formatBandLabel(item.overallBandLabel) : "Completed",
        icon: CheckCircle2,
        chipClassName: tone.chipClassName,
      };
    }
    case "in_progress":
      return {
        label: "In progress",
        icon: CircleDot,
        chipClassName:
          "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[color-mix(in_srgb,var(--primary)_78%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--primary)_28%,transparent)]",
      };
    case "not_started":
      return { label: "Not started", icon: CircleDashed, chipClassName: NEUTRAL_CHIP };
  }
}

/** Primary action verb for a catalog card, based on the learner's status. */
export function catalogActionLabel(status: DiagnosticCatalogStatus): string {
  switch (status) {
    case "completed":
      return "View results";
    case "in_progress":
      return "Resume assessment";
    case "not_started":
      return "Begin assessment";
  }
}

export type DimensionToneMeta = {
  icon: LucideIcon;
  description: string;
};

/**
 * Tier-based icon + educational description for a dimension breakdown card.
 * Descriptions are generic and safe — they guide focus without promising an
 * outcome.
 */
export function dimensionToneMeta(tone: ReadinessTone): DimensionToneMeta {
  switch (tone) {
    case "strong":
      return {
        icon: CheckCircle2,
        description: "Strong command here, with consistent and accurate responses.",
      };
    case "steady":
      return {
        icon: Info,
        description: "A solid base — targeted practice will sharpen this area further.",
      };
    case "watch":
      return {
        icon: AlertCircle,
        description: "Your clearest opportunity to grow. Focus your next sessions here.",
      };
  }
}

/** Tone-based hero headline for the results page (kept encouraging but honest). */
export function resultHeadline(tone: ReadinessTone): string {
  switch (tone) {
    case "strong":
      return "Strong work";
    case "steady":
      return "Solid progress";
    case "watch":
      return "A clear place to grow";
  }
}
