"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Fingerprint,
  History,
  Laptop,
  MapPin,
  RefreshCw,
  Terminal,
  Wifi,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { inlineExpandClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  deleteActiveDevices,
  fetchActiveDevicesSessionDetail,
  type ActiveDevicesSessionDetail,
} from "./admin-active-devices-roster-api";
import { RevokeDeviceModal } from "./RevokeDeviceModal";

type AdminActiveDevicesSessionDetailPageProps = {
  membershipId: string;
  deviceId: string;
  /** When true, render as a slide-over drawer (used from learner detail). */
  asDrawer?: boolean;
  onCloseDrawer?: () => void;
};

function formatUtc(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatRelative(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatTimeOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(11, 19);
}

function statusChip(status: ActiveDevicesSessionDetail["device"]["status"]) {
  if (status === "flagged") {
    return {
      label: "Flagged",
      className:
        "bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))] text-[var(--admin-danger)] border border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)]",
    };
  }
  if (status === "current" || status === "active") {
    return {
      label: status === "current" ? "Active" : "Active",
      className:
        "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)] border border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)]",
    };
  }
  return {
    label: "Idle",
    className: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  };
}

function heatClass(level: ActiveDevicesSessionDetail["heatstrip"][number]["level"]): string {
  if (level === "current")
    return "bg-[var(--admin-primary)] border-b-2 border-[var(--admin-danger)]";
  if (level === "high") return "bg-[color-mix(in_srgb,var(--admin-primary)_90%,transparent)]";
  if (level === "mid") return "bg-[color-mix(in_srgb,var(--admin-primary)_55%,transparent)]";
  if (level === "low") return "bg-[color-mix(in_srgb,var(--admin-primary)_25%,transparent)]";
  return "bg-[var(--admin-surface-high)]";
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-[var(--admin-surface-variant)] ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

function SessionLoadingSkeleton({ asDrawer }: { asDrawer?: boolean }) {
  const body = (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading device session">
      <SkeletonBlock className="h-8 w-72" />
      <SkeletonBlock className="h-40 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-48 w-full" />
        <SkeletonBlock className="h-48 w-full" />
      </div>
      <SkeletonBlock className="h-56 w-full" />
    </div>
  );
  if (!asDrawer) return body;
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--admin-border)] px-6 py-4">
        <SkeletonBlock className="h-10 w-64" />
      </div>
      <div className="flex-1 overflow-y-auto p-6">{body}</div>
    </div>
  );
}

export function AdminActiveDevicesSessionDetailPage({
  membershipId,
  deviceId,
  asDrawer = false,
  onCloseDrawer,
}: AdminActiveDevicesSessionDetailPageProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<ActiveDevicesSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [copied, setCopied] = useState<"id" | "hash" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchActiveDevicesSessionDetail(membershipId, deviceId);
      setDetail(response.data);
    } catch (err) {
      setDetail(null);
      setError(
        err instanceof ClientApiError ? err.message : "Unable to load device session detail.",
      );
    } finally {
      setLoading(false);
    }
  }, [deviceId, membershipId]);

  useEffect(() => {
    void load();
  }, [load]);

  const learnerLabel = useMemo(() => detail?.learnerName ?? detail?.email ?? "Learner", [detail]);

  async function copyText(value: string, kind: "id" | "hash") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => {
        setCopied(null);
      }, 1500);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  }

  function exportJson() {
    if (!detail) return;
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `device-session-${detail.device.shortId.replace(/\./g, "")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleRevoke() {
    if (!detail) return;
    setBusy(true);
    try {
      await deleteActiveDevices([detail.device.id]);
      setRevokeOpen(false);
      if (asDrawer) {
        onCloseDrawer?.();
        return;
      }
      router.push(`/admin/reports/active-devices/${membershipId}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to revoke device.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    if (asDrawer) {
      return (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--admin-scrim)]">
          <aside
            className={`flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl ${inlineExpandClassName}`}
          >
            <SessionLoadingSkeleton asDrawer />
          </aside>
        </div>
      );
    }
    return <SessionLoadingSkeleton />;
  }

  if (error && !detail) {
    const errorBody = (
      <div className="flex flex-col items-start gap-4 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
        <div className="flex items-center gap-2 text-[var(--admin-danger)]">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Unable to load session</h1>
        </div>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClassName} onClick={() => void load()}>
            Retry
          </button>
          <Link
            href={`/admin/reports/active-devices/${membershipId}`}
            className={ghostButtonClassName}
          >
            Back to learner
          </Link>
        </div>
      </div>
    );
    if (!asDrawer) return errorBody;
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-[var(--admin-scrim)]">
        <aside
          className={`flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl ${inlineExpandClassName}`}
        >
          {errorBody}
        </aside>
      </div>
    );
  }

  if (!detail) return null;

  const chip = statusChip(detail.device.status);
  const fingerprintValue = detail.device.deviceFingerprint ?? detail.device.id;
  const shortSessionId = detail.device.id.replace(/-/g, "").slice(0, 8);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`${ghostButtonClassName} h-10 gap-2`}
        disabled
        title="Trusted device marking is not configured yet"
      >
        Mark as trusted
      </button>
      <button type="button" className={`${ghostButtonClassName} h-10 gap-2`} onClick={exportJson}>
        <Download className="h-4 w-4" aria-hidden="true" />
        Export JSON
      </button>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-danger)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
        disabled={busy || !detail.capabilities.canRevoke}
        onClick={() => {
          setRevokeOpen(true);
        }}
      >
        Revoke device
      </button>
    </div>
  );

  const forensicOverview = (
    <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-3">
        <Terminal
          className="h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Session overview</h2>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            User identity
          </span>
          <div className="text-sm text-[var(--admin-on-surface)]">{learnerLabel}</div>
          <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {detail.email ?? "-"}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            Device
          </span>
          <div className="text-sm text-[var(--admin-on-surface)]">{detail.device.deviceLabel}</div>
          <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {detail.client.osLabel ?? detail.client.platform ?? "Unknown platform"}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            Session created
          </span>
          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
            {formatUtc(detail.device.createdAt)}
          </div>
          <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            Age: {detail.device.sessionAgeLabel}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            Last heartbeat
          </span>
          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
            {formatUtc(detail.device.lastSeenAt)}
          </div>
          <div className="font-mono text-[11px] text-[var(--admin-primary)]">
            Status: {detail.device.heartbeatStatus}
          </div>
        </div>
      </div>
    </section>
  );

  const networkClient = (
    <section className="grid grid-cols-1 border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:grid-cols-2">
      <div className="flex flex-col border-b border-[var(--admin-border)] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Network</h3>
          <Wifi className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex h-[120px] flex-col items-center justify-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-4 text-center">
            <MapPin className="h-5 w-5 text-[var(--admin-outline)]" aria-hidden="true" />
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{detail.network.note}</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between border-b border-dashed border-[var(--admin-border)] pb-1">
              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                Public IP
              </span>
              <span className="font-mono text-[13px] text-[var(--admin-primary)]">
                {detail.network.ipAddress ?? "-"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                Geo / ISP
              </span>
              <span className="font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                Not available
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Client signature
          </h3>
          <Cpu className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between border-b border-dashed border-[var(--admin-border)] pb-1">
              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                Operating system
              </span>
              <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                {detail.client.osLabel ?? "-"}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-b border-dashed border-[var(--admin-border)] pb-1">
              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                Browser
              </span>
              <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                {detail.client.browserLabel ?? "-"}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-b border-dashed border-[var(--admin-border)] pb-1">
              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                Platform
              </span>
              <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                {detail.client.platform ?? "-"}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2">
            <code className="whitespace-nowrap font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {detail.client.userAgent ?? "No user agent recorded"}
            </code>
          </div>
        </div>
      </div>
    </section>
  );

  const fingerprintBlock = (
    <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
          <Fingerprint
            className="h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          Device fingerprint
        </h2>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--admin-primary)] hover:underline"
          onClick={() => void copyText(fingerprintValue, "hash")}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          {copied === "hash" ? "Copied" : "Copy hash"}
        </button>
      </div>
      <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 dark:bg-[var(--admin-surface-high)]">
        <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-[var(--admin-on-surface-variant)]">
          <code>{JSON.stringify(detail.fingerprintPayload, null, 2)}</code>
        </pre>
      </div>
      {detail.device.fingerprintShareCount > 0 ? (
        <div className="border-t border-[var(--admin-border)] px-6 py-3 text-sm text-[var(--admin-danger)]">
          Seen on {detail.device.fingerprintShareCount} other learner
          {detail.device.fingerprintShareCount === 1 ? "" : "s"}
        </div>
      ) : (
        <div className="border-t border-[var(--admin-border)] px-6 py-3 text-sm text-[var(--admin-on-surface-variant)]">
          Not seen on other learner accounts
        </div>
      )}
    </section>
  );

  const activityPanel = (
    <section className="flex min-h-[420px] flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
          <History
            className="h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          Activity telemetry
        </h2>
        <span className="rounded bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-primary)]">
          Session presence
        </span>
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--admin-border)] p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            24h presence
          </span>
          <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            Derived from session window
          </span>
        </div>
        <div className="flex h-8 w-full gap-0.5" role="img" aria-label="24 hour session presence">
          {detail.heatstrip.map((hour) => (
            <div
              key={hour.label}
              className={`flex-1 transition-opacity hover:opacity-70 ${heatClass(hour.level)}`}
              title={`${hour.label} - ${hour.detail}`}
            />
          ))}
        </div>
        {/* `requestTelemetrySupported` is typed as the literal `false` until
            per-request telemetry ships, so this notice always renders. */}
        <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          Per-request telemetry is not captured. Bars show session presence, not HTTP volume.
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <tr className="h-11">
              <th className="w-[80px] px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Time
              </th>
              <th className="px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Event
              </th>
              <th className="w-[72px] px-4 text-right text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Result
              </th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px]">
            {detail.recentActivity.map((event) => (
              <tr
                key={event.id}
                className={`h-11 border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)] ${
                  event.result === "flagged"
                    ? "bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]"
                    : ""
                }`}
              >
                <td className="px-4 text-[11px] text-[var(--admin-on-surface-variant)]">
                  {formatTimeOnly(event.at)}
                </td>
                <td
                  className="max-w-[180px] truncate px-4 text-[var(--admin-on-surface)]"
                  title={event.detail ?? event.label}
                >
                  {event.label}
                  {event.detail ? (
                    <span className="ml-1 text-[var(--admin-on-surface-variant)]">
                      {event.detail}
                    </span>
                  ) : null}
                </td>
                <td
                  className={`px-4 text-right ${
                    event.result === "flagged"
                      ? "text-[var(--admin-danger)]"
                      : "text-[var(--admin-primary)]"
                  }`}
                >
                  {event.result === "flagged" ? "FLAG" : event.result === "ok" ? "OK" : "INFO"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const revokeModal = (
    <RevokeDeviceModal
      open={revokeOpen}
      deviceLabel={detail.device.deviceLabel}
      learnerName={learnerLabel}
      shortId={detail.device.shortId}
      lastSeenLabel={formatRelative(detail.device.lastSeenAt)}
      busy={busy}
      onClose={() => {
        if (!busy) setRevokeOpen(false);
      }}
      onConfirm={() => {
        void handleRevoke();
      }}
    />
  );

  if (asDrawer) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--admin-scrim)]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close drawer overlay"
            onClick={onCloseDrawer}
          />
          <aside
            className={`relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl ${inlineExpandClassName}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-drawer-title"
          >
            <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--admin-surface-high)]">
                  <Laptop
                    className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id="session-drawer-title"
                      className="text-base font-semibold text-[var(--admin-on-surface)]"
                    >
                      {detail.device.deviceLabel}
                    </h2>
                    <span
                      className={`inline-flex h-6 items-center rounded px-2 font-mono text-[11px] ${chip.className}`}
                    >
                      {chip.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      {detail.device.shortId}
                    </span>
                    <button
                      type="button"
                      className="text-[var(--admin-outline)] hover:text-[var(--admin-primary)]"
                      aria-label="Copy device ID"
                      onClick={() => void copyText(fingerprintValue, "id")}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    {copied === "id" ? (
                      <span className="font-mono text-[11px] text-[var(--admin-primary)]">
                        Copied
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                aria-label="Close drawer"
                onClick={onCloseDrawer}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <main className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              {error ? (
                <div
                  role="alert"
                  className="border border-[var(--admin-danger)] px-3 py-2 text-sm text-[var(--admin-danger)]"
                >
                  {error}
                </div>
              ) : null}

              <section className="grid grid-cols-2 gap-8 border-b border-[var(--admin-border)] pb-8">
                <div className="space-y-3">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Session details
                  </h3>
                  {[
                    ["Device ID", detail.device.shortId],
                    ["Created at", formatUtc(detail.device.createdAt)],
                    ["Last seen", formatUtc(detail.device.lastSeenAt)],
                    ["Session age", detail.device.sessionAgeLabel],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-[12px] text-[var(--admin-outline)]">{label}</span>
                      <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Client environment
                  </h3>
                  {[
                    ["Platform", detail.client.platform ?? "-"],
                    ["OS", detail.client.osLabel ?? "-"],
                    ["Browser", detail.client.browserLabel ?? "-"],
                    ["IP", detail.network.ipAddress ?? "-"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-[12px] text-[var(--admin-outline)]">{label}</span>
                      <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-b border-[var(--admin-border)] pb-8">
                <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Network context
                </h3>
                <p className="mb-3 text-sm text-[var(--admin-on-surface-variant)]">
                  {detail.network.note}
                </p>
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] py-2">
                  <span className="text-[12px] text-[var(--admin-outline)]">IP address</span>
                  <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                    {detail.network.ipAddress ?? "-"}
                  </span>
                </div>
              </section>

              <section className="border-b border-[var(--admin-border)] pb-8 space-y-4">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Device fingerprint
                </h3>
                <div className="flex items-center justify-between gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                  <span className="break-all font-mono text-[13px] text-[var(--admin-on-surface)]">
                    {fingerprintValue}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-[var(--admin-outline)] hover:text-[var(--admin-primary)]"
                    onClick={() => void copyText(fingerprintValue, "hash")}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  {detail.device.fingerprintShareCount > 0
                    ? `Seen on ${detail.device.fingerprintShareCount} other account(s)`
                    : "Not shared with other accounts"}
                </p>
                <div>
                  <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Raw user agent
                  </h3>
                  <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                    <p className="break-all font-mono text-[11px] text-[var(--admin-on-surface)]">
                      {detail.client.userAgent ?? "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Recent activity
                  </h3>
                  <span className="text-[12px] text-[var(--admin-outline)]">Session lifecycle</span>
                </div>
                <div className="mb-4 flex h-6 gap-px overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-variant)]">
                  {detail.heatstrip.map((hour) => (
                    <div
                      key={hour.label}
                      className={`flex-1 ${heatClass(hour.level)}`}
                      title={`${hour.label} - ${hour.detail}`}
                    />
                  ))}
                </div>
                <div className="flex flex-col">
                  {detail.recentActivity.map((event) => (
                    <div
                      key={event.id}
                      className={`grid min-h-11 grid-cols-[100px_1fr_64px] items-center gap-2 border-b border-[var(--admin-border)] ${
                        event.result === "flagged"
                          ? "relative bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]"
                          : ""
                      }`}
                    >
                      {event.result === "flagged" ? (
                        <span
                          className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-danger)]"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatTimeOnly(event.at)}
                      </div>
                      <div className="truncate text-[13px] text-[var(--admin-on-surface)]">
                        {event.label}
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] ${
                            event.result === "flagged"
                              ? "bg-[var(--admin-danger)] text-[var(--admin-on-primary)]"
                              : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)]"
                          }`}
                        >
                          {event.result === "flagged" ? "FLAG" : "OK"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </main>

            <footer className="border-t border-[var(--admin-border)] px-6 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/reports/active-devices/${membershipId}/${deviceId}`}
                    className={`${primaryButtonClassName} inline-flex h-10 items-center gap-1`}
                  >
                    Open full page
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    className={`${ghostButtonClassName} h-10 gap-2`}
                    onClick={exportJson}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    JSON
                  </button>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))] px-4 text-sm font-semibold text-[var(--admin-danger)] hover:bg-[var(--admin-danger)] hover:text-[var(--admin-on-primary)]"
                  disabled={busy}
                  onClick={() => {
                    setRevokeOpen(true);
                  }}
                >
                  Revoke device
                </button>
              </div>
              <p className="text-right text-[12px] text-[var(--admin-outline)]">
                Revoking signs this device out immediately.
              </p>
            </footer>
          </aside>
        </div>
        {revokeModal}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          <span>{error}</span>
          <button
            type="button"
            className="underline"
            onClick={() => {
              setError(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="mb-2 flex flex-col justify-between gap-4 border-b border-[var(--admin-border)] pb-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-1">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1 text-sm text-[var(--admin-on-surface-variant)]"
          >
            <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
              Reports
            </Link>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <Link
              href="/admin/reports/active-devices"
              className="hover:text-[var(--admin-primary)]"
            >
              Active Devices
            </Link>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <Link
              href={`/admin/reports/active-devices/${membershipId}`}
              className="hover:text-[var(--admin-primary)]"
            >
              {learnerLabel}
            </Link>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="text-[var(--admin-on-surface)]">{detail.device.deviceLabel}</span>
          </nav>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            Session:{" "}
            <span className="font-mono tracking-tight text-[var(--admin-primary)]">
              {shortSessionId}
            </span>
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${chip.className}`}
            >
              {chip.label}
            </span>
            <button
              type="button"
              className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              aria-label="Refresh"
              onClick={() => void load()}
            >
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </h1>
        </div>
        {headerActions}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
        <div className="flex flex-col gap-4 md:col-span-8">
          {forensicOverview}
          {networkClient}
          {fingerprintBlock}
        </div>
        <div className="md:col-span-4">{activityPanel}</div>
      </div>

      {revokeModal}
    </div>
  );
}
