"use client";

import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  HardDrive,
  Mail,
  MoreVertical,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";
import {
  type DestinationItem,
  type DestinationKind,
  type DestinationsRosterSummary,
  type HealthDayStatus,
} from "./admin-export-destinations-api";
import { useViewerLocale, withViewer, type ViewerLocale } from "./viewer-time";

export const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-[13px] font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-50";

export const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

export const textareaClassName =
  "min-h-[88px] w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

export const EMPTY_SUMMARY: DestinationsRosterSummary = {
  totalCount: 0,
  emailCount: 0,
  webhookCount: 0,
  storageCount: 0,
  deliveriesThisMonth: 0,
  deliveriesSucceededThisMonth: 0,
  failingCount: 0,
  failingCaption: null,
  externalRecipientCount: 0,
  lastDeliveryAt: null,
  tenantEmailDomains: [],
};

export function formatCountFor(value: number, viewer: ViewerLocale): string {
  return value.toLocaleString(viewer.locale);
}

export function formatRelativeFor(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = viewer.now - date.getTime();
  if (diffMs < 0) {
    const ahead = Math.abs(diffMs);
    if (ahead < 60_000) return "in under a minute";
    const mins = Math.floor(ahead / 60_000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `in ${hours}h`;
    return `in ${Math.floor(hours / 24)}d`;
  }
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function isExternalEmail(email: string, tenantDomains: string[]): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  return !tenantDomains.some((d) => d.toLowerCase() === domain);
}

export function generateSigningSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function KindIcon({ kind }: { kind: DestinationKind }) {
  if (kind === "email") return <Mail className="h-3 w-3" aria-hidden="true" />;
  if (kind === "webhook") return <Webhook className="h-3 w-3" aria-hidden="true" />;
  return <HardDrive className="h-3 w-3" aria-hidden="true" />;
}

export function kindLabel(kind: DestinationKind): string {
  if (kind === "email") return "Email";
  if (kind === "webhook") return "Webhook";
  return "Storage";
}

export function healthBarClass(status: HealthDayStatus): string {
  if (status === "success") return "bg-[var(--admin-success)]";
  if (status === "fail") return "bg-[var(--admin-danger)]";
  return "bg-[var(--admin-surface-variant)]";
}

export function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--admin-surface-low)] ${className ?? "h-4 w-24"}`}
    />
  );
}

export function DestinationsLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading destinations">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
          <SkeletonBar className="mb-3 h-3 w-24" />
          <SkeletonBar className="mb-2 h-8 w-16" />
          <SkeletonBar className="h-3 w-40" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <SkeletonBar className="mb-3 h-3 w-24" />
            <SkeletonBar className="mb-2 h-8 w-16" />
            <SkeletonBar className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <SkeletonBar className="h-full w-1 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonBar className="h-4 w-48" />
              <SkeletonBar className="h-3 w-64" />
              <SkeletonBar className="h-3 w-32" />
            </div>
            <SkeletonBar className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export type DrawerMode = "create" | "edit";

export function DestinationBlock({
  item,
  menuOpen,
  onToggleMenu,
  onEdit,
  onTest,
  onToggleActive,
  onDelete,
  onCopyWebhook,
}: {
  item: DestinationItem;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onTest: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onCopyWebhook: () => void;
}) {
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const formatRelative = withViewer(formatRelativeFor, viewer);
  const [secretVisible, setSecretVisible] = useState(false);

  const railClass = item.isFailing
    ? "bg-[var(--admin-danger)]"
    : !item.isActive
      ? "bg-[var(--admin-surface-variant)]"
      : "bg-[color-mix(in_srgb,var(--admin-primary)_60%,transparent)]";

  const statusTone = item.isFailing
    ? "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]"
    : !item.isActive
      ? "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
      : "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";

  const statusLabel = item.isFailing ? "Failing" : !item.isActive ? "Disabled" : "Enabled";

  return (
    <article
      className={`relative flex overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] ${
        !item.isActive ? "opacity-75" : ""
      }`}
    >
      <div className={`w-1 shrink-0 ${railClass}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">{item.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-xs">
              <KindIcon kind={item.kind} />
              {kindLabel(item.kind)}
            </span>
          </div>

          {item.kind === "email" ? (
            <div className="flex flex-wrap gap-1.5">
              {item.emails.map((target) => (
                <span
                  key={target.address}
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                    target.isExternal
                      ? "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)]"
                  }`}
                >
                  {target.address}
                </span>
              ))}
            </div>
          ) : null}

          {item.kind === "webhook" ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                <span className="font-mono text-[var(--admin-on-surface)]">
                  {item.webhookHost}
                  {item.webhookPathTruncated ? item.webhookPathTruncated : ""}
                </span>
                {item.webhookUrl ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--admin-surface-low)]"
                    onClick={onCopyWebhook}
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Copy URL
                  </button>
                ) : null}
              </div>
              {item.hasSigningSecret && item.signingSecretMasked ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    {secretVisible ? item.signingSecretMasked : "••••••••••••"}
                  </span>
                  <button
                    type="button"
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    aria-label={
                      secretVisible ? "Hide signing secret" : "Show masked signing secret"
                    }
                    onClick={() => {
                      setSecretVisible((v) => !v);
                    }}
                  >
                    {secretVisible ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {item.kind === "storage" ? (
            <p className="font-mono text-xs text-[var(--admin-on-surface)]">
              {item.storageProvider}/{item.storageBucket}
              {item.storagePrefix ? `/${item.storagePrefix}` : ""}
            </p>
          ) : null}

          {item.isFailing && item.lastError ? (
            <p className="text-xs text-[var(--admin-danger)]">{item.lastError}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 sm:min-w-[180px]">
          <span
            className={`inline-flex rounded border px-1.5 py-px font-mono text-[11px] font-semibold uppercase tracking-wide ${statusTone}`}
          >
            {statusLabel}
          </span>
          <div className="flex items-end gap-0.5" role="img" aria-label="30-day delivery health">
            {item.health30d.map((day, index) => (
              <span
                key={`${item.id}-health-${index}`}
                className={`h-4 w-1 rounded-sm ${healthBarClass(day)}`}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Last delivered {formatRelative(item.lastDeliveryAt)}
          </p>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            {formatCount(item.scheduleCount)} schedule{item.scheduleCount === 1 ? "" : "s"}
          </p>
          <div className="relative">
            <button
              type="button"
              className={ghostButtonClassName}
              aria-label={`Actions for ${item.name}`}
              onClick={onToggleMenu}
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
                role="menu"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                  role="menuitem"
                  onClick={onEdit}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                  role="menuitem"
                  onClick={onTest}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Send a test
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                  role="menuitem"
                  onClick={onToggleActive}
                >
                  {item.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-surface-low)]"
                  role="menuitem"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
