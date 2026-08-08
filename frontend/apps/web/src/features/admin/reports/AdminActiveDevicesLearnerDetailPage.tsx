"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  MoreVertical,
  PhoneOff,
  RefreshCw,
  Shield,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { dropdownPanelEnterEndClassName } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { dropdownItemClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  deleteActiveDevices,
  fetchActiveDevicesLearnerDetail,
  forceSignOutActiveDevices,
  type ActiveDevicesDetailDevice,
  type ActiveDevicesLearnerDetail,
  type ActiveDevicesRiskSignal,
} from "./admin-active-devices-roster-api";
import { AdminActiveDevicesSessionDetailPage } from "./AdminActiveDevicesSessionDetailPage";
import { RevokeDeviceModal } from "./RevokeDeviceModal";

type AdminActiveDevicesLearnerDetailPageProps = {
  membershipId: string;
};

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return source[0]!.slice(0, 2).toUpperCase();
  return `${source[0]![0] ?? ""}${source[1]![0] ?? ""}`.toUpperCase();
}

function formatAbsolute(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function formatUtcStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function statusChipClass(status: ActiveDevicesDetailDevice["status"]): string {
  if (status === "flagged") {
    return "border border-[color-mix(in_srgb,var(--admin-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (status === "current") {
    return "border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] font-semibold text-[var(--admin-primary)]";
  }
  if (status === "active") {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function statusLabel(status: ActiveDevicesDetailDevice["status"]): string {
  if (status === "current") return "Current session";
  if (status === "flagged") return "Flagged";
  if (status === "active") return "Active";
  return "Idle";
}

function riskChip(signal: ActiveDevicesRiskSignal) {
  if (signal.status === "fail") {
    return {
      className:
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))]",
      Icon: XCircle,
      label: "Fail",
    };
  }
  if (signal.status === "warn") {
    return {
      className:
        "inline-flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--admin-danger)_20%,transparent)] bg-transparent px-2 py-0.5 text-[11px] font-medium text-[var(--admin-danger)]",
      Icon: TriangleAlert,
      label: "Warn",
    };
  }
  return {
    className:
      "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-[var(--admin-on-surface-variant)] bg-[var(--admin-surface-high)]",
    Icon: CheckCircle2,
    label: "Pass",
  };
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-[var(--admin-surface-variant)] ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading learner devices">
      <div className="flex items-center justify-between gap-4">
        <SkeletonBlock className="h-4 w-72" />
        <SkeletonBlock className="h-4 w-28" />
      </div>

      <div className="border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <SkeletonBlock className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <SkeletonBlock className="h-7 w-48" />
              <SkeletonBlock className="h-4 w-40" />
              <div className="flex gap-2 pt-1">
                <SkeletonBlock className="h-6 w-16" />
                <SkeletonBlock className="h-6 w-28" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-8 w-36" />
            <SkeletonBlock className="h-8 w-32" />
            <SkeletonBlock className="h-8 w-48" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <div className="w-full border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:w-[68%]">
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-3">
            <SkeletonBlock className="h-5 w-32" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-8 w-20" />
              <SkeletonBlock className="h-8 w-20" />
            </div>
          </div>
          <div className="grid h-11 grid-cols-12 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            <div className="col-span-1" />
            <div className="col-span-3">Device / Browser</div>
            <div className="col-span-2">ID</div>
            <div className="col-span-1">OS</div>
            <div className="col-span-3">IP / Location</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="grid h-11 grid-cols-12 items-center border-b border-[var(--admin-border)] px-6 last:border-0"
            >
              <div className="col-span-1 pr-2">
                <SkeletonBlock className="h-4 w-4" />
              </div>
              <div className="col-span-3 pr-4">
                <SkeletonBlock className="h-4 w-full" />
              </div>
              <div className="col-span-2 pr-4">
                <SkeletonBlock className="h-4 w-3/4" />
              </div>
              <div className="col-span-1 pr-4">
                <SkeletonBlock className="h-4 w-1/2" />
              </div>
              <div className="col-span-3 pr-4">
                <SkeletonBlock className="h-4 w-2/3" />
              </div>
              <div className="col-span-2 flex justify-end">
                <SkeletonBlock className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-[32%]">
          <div className="border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="border-b border-[var(--admin-border)] px-6 py-3">
              <SkeletonBlock className="h-5 w-40" />
            </div>
            <div className="space-y-4 p-6">
              <div className="space-y-1">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-4 w-full" />
              </div>
              <div className="space-y-1">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-4 w-3/4" />
              </div>
              <div className="border-t border-[var(--admin-border)] pt-4">
                <SkeletonBlock className="h-8 w-full" />
              </div>
            </div>
          </div>
          <div className="border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="border-b border-[var(--admin-border)] px-6 py-3">
              <SkeletonBlock className="h-5 w-32" />
            </div>
            <div className="space-y-4 p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-3">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminActiveDevicesLearnerDetailPage({
  membershipId,
}: AdminActiveDevicesLearnerDetailPageProps) {
  const menuBaseId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [detail, setDetail] = useState<ActiveDevicesLearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuDeviceId, setMenuDeviceId] = useState<string | null>(null);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [drawerDeviceId, setDrawerDeviceId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ActiveDevicesDetailDevice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchActiveDevicesLearnerDetail(membershipId);
      setDetail(response.data);
      setSelectedIds(new Set());
    } catch (err) {
      const message =
        err instanceof ClientApiError
          ? err.message
          : "Unable to load learner device detail.";
      setError(message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [membershipId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!menuDeviceId) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuDeviceId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuDeviceId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuDeviceId]);

  function toggleDevice(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!detail) return;
    setSelectedIds(new Set(detail.devices.map((device) => device.id)));
  }

  async function handleForceSignOut() {
    setBusy(true);
    try {
      await forceSignOutActiveDevices(membershipId);
      setConfirmSignOutOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Force sign-out failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeSelected() {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      await deleteActiveDevices([...selectedIds]);
      setConfirmRevokeOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to revoke devices.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeOne(sessionId: string) {
    setBusy(true);
    setMenuDeviceId(null);
    try {
      await deleteActiveDevices([sessionId]);
      setRevokeTarget(null);
      setDrawerDeviceId(null);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to revoke device.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDeviceId(device: ActiveDevicesDetailDevice) {
    const value = device.deviceFingerprint ?? device.id;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(device.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("Unable to copy device ID.");
    }
    setMenuDeviceId(null);
  }

  if (loading) {
    return <DetailLoadingSkeleton />;
  }

  if (error && !detail) {
    return (
      <div className="flex flex-col items-start gap-4 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
        <div className="flex items-center gap-2 text-[var(--admin-danger)]">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Unable to load device detail</h1>
        </div>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClassName} onClick={() => void load()}>
            Retry
          </button>
          <Link href="/admin/reports/active-devices" className={ghostButtonClassName}>
            Back to Active Devices
          </Link>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const displayName = detail.learnerName ?? detail.email ?? "Learner";
  const allSelected =
    detail.devices.length > 0 && detail.devices.every((device) => selectedIds.has(device.id));

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          <span>{error}</span>
          <button type="button" className="underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]"
        >
          <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/active-devices" className="hover:text-[var(--admin-primary)]">
            Active Devices
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-semibold text-[var(--admin-on-surface)]">{displayName}</span>
        </nav>
        <Link
          href="/admin/reports/active-devices"
          className="inline-flex items-center gap-1 font-mono text-[13px] text-[var(--admin-primary)] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All learners
        </Link>
      </div>

      <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-sm font-semibold text-[var(--admin-on-surface)]"
              aria-hidden="true"
            >
              {learnerInitials(detail.learnerName, detail.email)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                {displayName}
              </h1>
              <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                {detail.email ?? "-"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex h-6 items-center rounded bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {detail.roleLabel}
                </span>
                {detail.summary.overLimit ? (
                  <span className="inline-flex h-6 items-center rounded bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 font-mono text-[11px] font-bold text-[var(--admin-danger)]">
                    Over device limit
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link
              href={`/admin/members/${detail.membershipId}`}
              className={`${ghostButtonClassName} h-8 text-sm`}
            >
              Open member profile
            </Link>
            <Link
              href="/admin/reports/active-devices/policies"
              className={`${ghostButtonClassName} h-8 text-sm`}
            >
              Set device limit
            </Link>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded border border-[var(--admin-danger)] px-3 text-sm font-semibold uppercase tracking-[0.06em] text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))]"
              disabled={busy}
              onClick={() => setConfirmSignOutOpen(true)}
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              Force sign out of all devices
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4 md:grid-cols-5">
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              Active devices
            </span>
            <span className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
              <span
                className={
                  detail.summary.overLimit
                    ? "font-bold text-[var(--admin-danger)]"
                    : "font-semibold"
                }
              >
                {detail.summary.activeDevices}
              </span>{" "}
              of {detail.summary.deviceLimit} allowed
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              First seen
            </span>
            <span className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
              {formatAbsolute(detail.summary.firstSeenAt)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              Last activity
            </span>
            <span className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
              {formatRelative(detail.summary.lastActivityAt)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              Distinct IPs
            </span>
            <span className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
              {detail.summary.distinctIpCount}
            </span>
          </div>
          <div className="col-span-2 flex flex-col md:col-span-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              Flags
            </span>
            <span
              className={`mt-1 flex items-start gap-1 font-mono text-[13px] ${
                detail.summary.flagSummary
                  ? "text-[var(--admin-danger)]"
                  : "text-[var(--admin-on-surface)]"
              }`}
            >
              {detail.summary.flagSummary ? (
                <>
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {detail.summary.flagSummary}
                </>
              ) : (
                "None"
              )}
            </span>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex w-full flex-col gap-4 lg:w-[68%]">
          <div className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                {detail.devices.length} device{detail.devices.length === 1 ? "" : "s"}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-sm font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={selectedIds.size === 0 || busy}
                  onClick={() => setConfirmRevokeOpen(true)}
                >
                  Revoke selected
                </button>
                <button
                  type="button"
                  className="text-sm font-semibold uppercase tracking-[0.06em] text-[var(--admin-primary)] hover:underline disabled:opacity-50"
                  disabled={detail.devices.length === 0}
                  onClick={() => {
                    if (allSelected) setSelectedIds(new Set());
                    else selectAll();
                  }}
                >
                  {allSelected ? "Clear selection" : "Select all"}
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                  aria-label="Refresh"
                  disabled={busy}
                  onClick={() => void load()}
                >
                  <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
                </button>
              </div>
            </div>

            {detail.devices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <Shield className="h-8 w-8 text-[var(--admin-outline)]" aria-hidden="true" />
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">No active devices</p>
                <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                  This learner has no registered device sessions right now.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="grid h-11 grid-cols-12 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <div className="col-span-1 pl-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected) setSelectedIds(new Set());
                          else selectAll();
                        }}
                        aria-label="Select all devices"
                      />
                    </div>
                    <div className="col-span-3">Device / Browser</div>
                    <div className="col-span-2">ID</div>
                    <div className="col-span-1">OS</div>
                    <div className="col-span-3">IP / Location</div>
                    <div className="col-span-2 pr-8 text-right">Status</div>
                  </div>

                  {detail.devices.map((device) => {
                    const selected = selectedIds.has(device.id);
                    const menuOpen = menuDeviceId === device.id;
                    const menuId = `${menuBaseId}-${device.id}`;
                    const idle = device.status === "idle";
                    return (
                      <div
                        key={device.id}
                        className={[
                          "relative grid h-11 grid-cols-12 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-0 hover:bg-[var(--admin-surface-low)]",
                          device.status === "flagged"
                            ? "border-l-2 border-l-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]"
                            : device.isCurrent
                              ? "bg-[var(--admin-surface)]"
                              : "",
                          idle ? "opacity-70" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {device.isCurrent && device.status !== "flagged" ? (
                          <span
                            className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary)]"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="col-span-1 flex items-center pl-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                            checked={selected}
                            onChange={() => toggleDevice(device.id)}
                            aria-label={`Select ${device.deviceLabel}`}
                          />
                        </div>
                        <div className="col-span-3 truncate text-sm text-[var(--admin-on-surface)]">
                          <button
                            type="button"
                            className="truncate text-left hover:text-[var(--admin-primary)] hover:underline"
                            onClick={() => setDrawerDeviceId(device.id)}
                          >
                            {device.deviceLabel}
                          </button>
                        </div>
                        <div className="col-span-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                          {device.shortId}
                        </div>
                        <div className="col-span-1 truncate text-sm text-[var(--admin-on-surface-variant)]">
                          {device.osLabel ?? "-"}
                        </div>
                        <div
                          className={`col-span-3 truncate font-mono text-[13px] ${
                            device.status === "flagged"
                              ? "text-[var(--admin-danger)]"
                              : "text-[var(--admin-on-surface-variant)]"
                          }`}
                        >
                          {device.ipAddress ?? "-"}
                        </div>
                        <div className="relative col-span-2 flex items-center justify-end gap-1 pr-2">
                          <span
                            className={`inline-flex h-6 items-center whitespace-nowrap rounded px-2 font-mono text-[11px] ${statusChipClass(device.status)}`}
                          >
                            {statusLabel(device.status)}
                          </span>
                          <button
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            aria-controls={menuOpen ? menuId : undefined}
                            className="flex h-6 w-6 items-center justify-center rounded text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                            onClick={() =>
                              setMenuDeviceId((current) => (current === device.id ? null : device.id))
                            }
                          >
                            <MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />
                          </button>
                          {menuOpen ? (
                            <div
                              ref={menuRef}
                              id={menuId}
                              role="menu"
                              className={[
                                "absolute right-0 top-8 z-50 w-48 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-md",
                                dropdownPanelEnterEndClassName,
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className={dropdownItemClassName}
                                onClick={() => {
                                  setMenuDeviceId(null);
                                  setDrawerDeviceId(device.id);
                                }}
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                                View session detail
                              </button>
                              <Link
                                href={`/admin/reports/active-devices/${membershipId}/${device.id}`}
                                role="menuitem"
                                className={dropdownItemClassName}
                                onClick={() => setMenuDeviceId(null)}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Open full page
                              </Link>
                              <button
                                type="button"
                                role="menuitem"
                                className={dropdownItemClassName}
                                onClick={() => void copyDeviceId(device)}
                              >
                                <Copy className="h-4 w-4" aria-hidden="true" />
                                {copiedId === device.id ? "Copied" : "Copy device ID"}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={`${dropdownItemClassName} text-[var(--admin-danger)]`}
                                disabled={busy}
                                onClick={() => {
                                  setMenuDeviceId(null);
                                  setRevokeTarget(device);
                                }}
                              >
                                <PhoneOff className="h-4 w-4" aria-hidden="true" />
                                Revoke device
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-6 lg:w-[32%]">
          <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Device limit</h3>
            <div className="mb-4 flex items-center justify-between border-b border-[var(--admin-border)] pb-4">
              <div>
                <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                  Policy value
                </div>
                <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                  <span className="text-lg font-bold">{detail.policy.deviceLimit}</span> (Tenant
                  default)
                </div>
              </div>
              <span className="inline-flex h-6 items-center rounded bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {detail.policy.restrictionsEnabled ? "Enforced" : "Monitor only"}
              </span>
            </div>
            <p className="mb-3 text-sm text-[var(--admin-on-surface-variant)]">
              Per-learner overrides are not available yet. Change the tenant policy in Device
              monitor.
            </p>
            <Link
              href="/admin/reports/active-devices/policies"
              className={`${ghostButtonClassName} inline-flex w-full items-center justify-center gap-1`}
            >
              Open device monitor
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <p className="mt-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              {detail.policy.enforcementNote}
            </p>
          </section>

          <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Risk signals</h3>
            <div className="flex flex-col gap-3">
              {detail.riskSignals.map((signal, index) => {
                const chip = riskChip(signal);
                const Icon = chip.Icon;
                return (
                  <div
                    key={signal.key}
                    className={`flex items-center justify-between gap-3 ${
                      index > 0 ? "border-t border-[var(--admin-border)] pt-3" : ""
                    }`}
                    title={signal.detail ?? undefined}
                  >
                    <span className="text-sm text-[var(--admin-on-surface)]">{signal.label}</span>
                    <span className={chip.className}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {chip.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-1 flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Recent activity</h3>
              <Link
                href="/admin/reports/active-devices"
                className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-primary)] hover:underline"
              >
                View roster
              </Link>
            </div>
            {detail.recentActivity.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">No recent activity.</p>
            ) : (
              <div className="relative ml-2 mt-2 flex flex-col gap-4 border-l border-[var(--admin-border)] pl-4">
                {detail.recentActivity.map((event) => (
                  <div key={event.id} className="relative">
                    <div
                      className={[
                        "absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-[var(--admin-surface)]",
                        event.severity === "danger"
                          ? "bg-[var(--admin-danger)]"
                          : event.severity === "warning"
                            ? "bg-[var(--admin-warning)]"
                            : "bg-[var(--admin-outline)]",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                    <div
                      className={`mb-0.5 font-mono text-[11px] ${
                        event.severity === "danger"
                          ? "text-[var(--admin-danger)]"
                          : "text-[var(--admin-on-surface-variant)]"
                      }`}
                    >
                      {formatUtcStamp(event.at)}
                    </div>
                    <div className="text-sm text-[var(--admin-on-surface)]">{event.label}</div>
                    {event.detail ? (
                      <div className="mt-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {event.detail}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {confirmSignOutOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="force-signout-title"
            className="w-full max-w-md border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl"
          >
            <h2 id="force-signout-title" className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Force sign out of all devices?
            </h2>
            <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
              This removes every device session for {displayName}. They will need to sign in again.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => setConfirmSignOutOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy}
                onClick={() => void handleForceSignOut()}
              >
                Force sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRevokeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-selected-title"
            className="w-full max-w-md border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl"
          >
            <h2 id="revoke-selected-title" className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Revoke selected devices?
            </h2>
            <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
              {selectedIds.size} device session{selectedIds.size === 1 ? "" : "s"} will be removed.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => setConfirmRevokeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy}
                onClick={() => void handleRevokeSelected()}
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {drawerDeviceId ? (
        <AdminActiveDevicesSessionDetailPage
          membershipId={membershipId}
          deviceId={drawerDeviceId}
          asDrawer
          onCloseDrawer={() => {
            setDrawerDeviceId(null);
            void load();
          }}
        />
      ) : null}

      {revokeTarget ? (
        <RevokeDeviceModal
          open
          deviceLabel={revokeTarget.deviceLabel}
          learnerName={displayName}
          shortId={revokeTarget.shortId}
          lastSeenLabel={formatRelative(revokeTarget.lastSeenAt)}
          busy={busy}
          onClose={() => {
            if (!busy) setRevokeTarget(null);
          }}
          onConfirm={() => {
            void handleRevokeOne(revokeTarget.id);
          }}
        />
      ) : null}
    </div>
  );
}
