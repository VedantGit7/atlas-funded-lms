import type { ExtensionPointDto, ExtensionRegistrationDto } from "./api";

export type ExtensionsView = "registrations" | "catalogue";

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMinutes = Math.round((date.getTime() - Date.now()) / (1000 * 60));
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      diffMinutes,
      "minute",
    );
  }
  const diffHours = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 48) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffHours, "hour");
  }
  return date.toLocaleString();
}

export function formatPointTypeLabel(pointType: string): string {
  const normalized = pointType.toLowerCase();
  if (normalized.includes("webhook")) return "Webhook";
  if (normalized.includes("ui") || normalized.includes("render")) return "UI Component";
  if (normalized.includes("hook")) return "Hook";
  return pointType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function registrationStatusLabel(status: ExtensionRegistrationDto["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "DISABLED":
      return "Disabled";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}

export function registrationStatusBadgeClassName(
  status: ExtensionRegistrationDto["status"],
): string {
  const base = "inline-flex w-fit items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold";
  switch (status) {
    case "ACTIVE":
      return `${base} bg-[color-mix(in_srgb,var(--admin-success)_18%,var(--admin-surface))] text-[var(--admin-success)]`;
    case "DISABLED":
      return `${base} bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]`;
    case "ARCHIVED":
      return `${base} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`;
    default:
      return base;
  }
}

export function pointStatusBadgeClassName(status: ExtensionPointDto["status"]): string {
  const base = "inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-success)]";
  if (status === "ACTIVE") return base;
  return `${base} text-[var(--admin-on-surface-variant)]`;
}

export function filterRegistrations(
  registrations: ExtensionRegistrationDto[],
  query: string,
): ExtensionRegistrationDto[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return registrations;
  return registrations.filter(
    (row) =>
      row.registrationKey.toLowerCase().includes(normalized) ||
      row.extensionPointKey.toLowerCase().includes(normalized) ||
      row.status.toLowerCase().includes(normalized),
  );
}

export function parseConfigJson(
  raw: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "Configuration must be a JSON object." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    return { ok: false, message };
  }
}

export function defaultRegistrationDraft(extensionPoints: ExtensionPointDto[]) {
  const defaultPoint =
    extensionPoints.find((point) => point.key === "item_type_renderer") ?? extensionPoints[0];
  return {
    extensionPointKey: defaultPoint?.key ?? "item_type_renderer",
    registrationKey: "swipe-renderer",
    configJson: '{\n  "rendererKey": "swipe"\n}',
    status: "ACTIVE" as const,
  };
}
