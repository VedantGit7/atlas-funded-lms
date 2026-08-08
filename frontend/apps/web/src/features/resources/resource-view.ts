import {
  Download,
  ExternalLink,
  FileText,
  Film,
  Link2,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import type { ResourceKind, ResourceSort } from "@atlas/contracts/resources/schemas";

/**
 * Presentation metadata per resource kind. Tones are design tokens (never raw
 * hex) so the library themes correctly in light and dark mode.
 */
export type KindMeta = {
  label: string;
  Icon: LucideIcon;
  /** CSS custom property used as the accent for this kind. */
  tone: string;
  ActionIcon: LucideIcon;
  actionLabel: string;
};

export const KIND_META: Record<ResourceKind, KindMeta> = {
  pdf: {
    label: "PDF",
    Icon: FileText,
    tone: "var(--destructive)",
    ActionIcon: Download,
    actionLabel: "Download",
  },
  document: {
    label: "Document",
    Icon: FileText,
    tone: "var(--primary)",
    ActionIcon: Download,
    actionLabel: "Download",
  },
  video: {
    label: "Video",
    Icon: Film,
    tone: "var(--warning)",
    ActionIcon: PlayCircle,
    actionLabel: "Watch",
  },
  link: {
    label: "Link",
    Icon: Link2,
    tone: "var(--success)",
    ActionIcon: ExternalLink,
    actionLabel: "Open",
  },
};

export const KIND_ORDER: ResourceKind[] = ["pdf", "video", "link", "document"];

export const SORT_OPTIONS: { value: ResourceSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "name", label: "File name" },
  { value: "size", label: "File size" },
];

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Human-readable file size, e.g. 2_517_000 -> "2.4 MB". */
export function formatBytes(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const rounded = value >= 100 || exponent === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded)} ${BYTE_UNITS[exponent] ?? "B"}`;
}

/** Short human date for card meta, e.g. "Oct 12, 2023". */
export function formatResourceDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** The left-hand meta caption under a card: size / source, matched to the kind. */
export function resourceMetaLabel(kind: ResourceKind, sizeBytes: number | null): string {
  const size = formatBytes(sizeBytes);
  if (kind === "link") return "External link";
  if (kind === "video") return size ?? "Video";
  return size ?? "File";
}
