"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  History,
  Laptop,
  Loader2,
  MoreVertical,
  PhoneOff,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  Tablet,
  TrendingUp,
  TriangleAlert,
  Tv,
  X,
} from "lucide-react";
import { Select, dropdownPanelEnterEndClassName } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  dropdownItemClassName,
  inlineExpandClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  deleteActiveDevices,
  fetchActiveDevicesLearnerDetail,
  fetchActiveDevicesOverview,
  fetchActiveDevicesRoster,
  forceSignOutActiveDevices,
  type ActiveDevicesDetailDevice,
  type ActiveDevicesLearner,
  type ActiveDevicesOverview,
  type ActiveDevicesView,
  type ActiveDevicesWindow,
} from "./admin-active-devices-roster-api";
import { ActiveDevicesReportTabs } from "./ActiveDevicesReportTabs";

const PAGE_SIZE = 50;

const WINDOW_OPTIONS: Array<{ value: ActiveDevicesWindow; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

const PLATFORM_OPTIONS = [
  { value: "", label: "All device types" },
  { value: "web", label: "Web" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
] as const;

const LAST_SEEN_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "over_limit", label: "Over limit" },
] as const;

const selectTriggerClassName =
  "h-10 min-w-[9rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

function titleCase(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return (source[0] ?? "").slice(0, 2).toUpperCase();
  return `${source[0]?.[0] ?? ""}${source[1]?.[0] ?? ""}`.toUpperCase();
}

function formatAbsolute(value: string | null): string {
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

function platformIcon(platform: string) {
  const lower = platform.toLowerCase();
  if (lower.includes("phone") || lower.includes("ios") || lower.includes("android")) {
    return Smartphone;
  }
  if (lower.includes("tablet") || lower.includes("ipad")) return Tablet;
  if (lower.includes("tv")) return Tv;
  return Laptop;
}

function matchesLastSeenFilter(lastSeenAt: string | null, filter: string): boolean {
  if (!filter) return true;
  if (!lastSeenAt) return false;
  const date = new Date(lastSeenAt);
  if (Number.isNaN(date.getTime())) return false;
  const diffMs = Date.now() - date.getTime();
  if (filter === "1h") return diffMs <= 60 * 60 * 1000;
  if (filter === "24h") return diffMs <= 24 * 60 * 60 * 1000;
  if (filter === "7d") return diffMs <= 7 * 24 * 60 * 60 * 1000;
  return true;
}

function DeviceSparkline({ points }: { points: ActiveDevicesOverview["trend"] }) {
  if (points.length === 0) {
    return <div className="h-8 w-32 rounded bg-[var(--admin-surface-high)]" aria-hidden="true" />;
  }
  const max = Math.max(1, ...points.map((point) => point.activeDevices));
  const width = 100;
  const height = 30;
  const path = points
    .map((point, index) => {
      const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - (point.activeDevices / max) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="h-8 w-32 opacity-80"
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="img"
      aria-label="Active devices trend"
    >
      <path
        d={path}
        stroke="var(--admin-primary)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function EmptyIllustration() {
  return (
    <svg
      className="h-28 w-28 stroke-[var(--admin-outline)]"
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <rect x="20" y="30" width="20" height="40" className="stroke-[var(--admin-outline)]" />
      <rect x="50" y="20" width="30" height="60" className="stroke-[var(--admin-outline)]" />
      <circle cx="30" cy="40" r="2" fill="var(--admin-outline)" />
      <circle cx="65" cy="30" r="2" fill="var(--admin-outline)" />
      <path d="M40 50 L50 50" strokeDasharray="2 2" />
      <circle cx="55" cy="55" r="15" className="stroke-[var(--admin-primary)]" strokeWidth="2" />
      <path d="M65 65 L75 75" className="stroke-[var(--admin-primary)]" strokeWidth="2" />
      <path
        d="M50 50 L60 60 M60 50 L50 60"
        className="stroke-[var(--admin-primary)]"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function AdminActiveDevicesRosterPage() {
  const router = useRouter();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);

  const [learners, setLearners] = useState<ActiveDevicesLearner[]>([]);
  const [overview, setOverview] = useState<ActiveDevicesOverview | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [windowKey, setWindowKey] = useState<ActiveDevicesWindow>("7d");
  const [view, setView] = useState<ActiveDevicesView>("all");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [lastSeenFilter, setLastSeenFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const [selectedLearnerIds, setSelectedLearnerIds] = useState<Set<string>>(new Set());
  const [menuLearnerId, setMenuLearnerId] = useState<string | null>(null);

  const [selectedLearner, setSelectedLearner] = useState<ActiveDevicesLearner | null>(null);
  const [devices, setDevices] = useState<ActiveDevicesDetailDevice[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

  const filterPayload = useMemo(
    () => ({
      window: windowKey,
      view,
      ...(search.trim() ? { email: search.trim() } : {}),
      ...(platform ? { platform } : {}),
    }),
    [platform, search, view, windowKey],
  );

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const response = await fetchActiveDevicesOverview({
        window: windowKey,
        ...(search.trim() ? { email: search.trim() } : {}),
        ...(platform ? { platform } : {}),
      });
      setOverview(response.data);
    } catch {
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [platform, search, windowKey]);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchActiveDevicesRoster({
        ...filterPayload,
        page,
        limit: PAGE_SIZE,
      });
      setLearners(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
      setRefreshedAt(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load the device roster.",
      );
      setLearners([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filterPayload, page]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!menuLearnerId) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuLearnerId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuLearnerId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuLearnerId]);

  const visibleLearners = useMemo(
    () =>
      learners.filter((learner) => {
        if (statusFilter && learner.status !== statusFilter) return false;
        if (!matchesLastSeenFilter(learner.lastSeenAt, lastSeenFilter)) return false;
        return true;
      }),
    [lastSeenFilter, learners, statusFilter],
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (platform) {
      chips.push({
        key: "platform",
        label: `Device type: ${titleCase(platform)}`,
        clear: () => {
          setPlatform("");
        },
      });
    }
    if (lastSeenFilter) {
      const label =
        LAST_SEEN_OPTIONS.find((option) => option.value === lastSeenFilter)?.label ??
        lastSeenFilter;
      chips.push({
        key: "lastSeen",
        label: `Last seen: ${label}`,
        clear: () => {
          setLastSeenFilter("");
        },
      });
    }
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter === "over_limit" ? "Over limit" : "Active"}`,
        clear: () => {
          setStatusFilter("");
        },
      });
    }
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `Learner: ${search.trim()}`,
        clear: () => {
          setSearch("");
        },
      });
    }
    return chips;
  }, [lastSeenFilter, platform, search, statusFilter]);

  function goToLearnerDetail(membershipId: string) {
    setMenuLearnerId(null);
    router.push(`/admin/reports/active-devices/${membershipId}`);
  }

  async function openLearner(learner: ActiveDevicesLearner) {
    setSelectedLearner(learner);
    setSelectedDeviceIds(new Set());
    setDetailOpen(true);
    setDetailLoading(true);
    setMenuLearnerId(null);
    try {
      const response = await fetchActiveDevicesLearnerDetail(learner.membershipId);
      setDevices(response.data.devices);
    } catch (detailError) {
      setError(
        detailError instanceof ClientApiError
          ? detailError.message
          : detailError instanceof Error
            ? detailError.message
            : "Unable to load learner devices.",
      );
      setDevices([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleLearner(membershipId: string) {
    setSelectedLearnerIds((current) => {
      const next = new Set(current);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  function toggleAllVisible() {
    if (
      visibleLearners.length > 0 &&
      visibleLearners.every((learner) => selectedLearnerIds.has(learner.membershipId))
    ) {
      setSelectedLearnerIds(new Set());
      return;
    }
    setSelectedLearnerIds(new Set(visibleLearners.map((learner) => learner.membershipId)));
  }

  async function handleDeleteSelectedDevices() {
    if (selectedDeviceIds.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await deleteActiveDevices([...selectedDeviceIds]);
      setConfirmDeleteOpen(false);
      setSelectedDeviceIds(new Set());
      if (selectedLearner) await openLearner(selectedLearner);
      await Promise.all([loadRoster(), loadOverview()]);
    } catch (deleteError) {
      setError(
        deleteError instanceof ClientApiError
          ? deleteError.message
          : deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete devices.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleForceSignOut(membershipId?: string) {
    const targetId = membershipId ?? selectedLearner?.membershipId;
    if (!targetId) return;
    setBusy(true);
    setError(null);
    try {
      await forceSignOutActiveDevices(targetId);
      setConfirmSignOutOpen(false);
      setSelectedDeviceIds(new Set());
      setDevices([]);
      setSelectedLearner(null);
      setDetailOpen(false);
      setSelectedLearnerIds((current) => {
        const next = new Set(current);
        next.delete(targetId);
        return next;
      });
      await Promise.all([loadRoster(), loadOverview()]);
    } catch (signOutError) {
      setError(
        signOutError instanceof ClientApiError
          ? signOutError.message
          : signOutError instanceof Error
            ? signOutError.message
            : "Unable to force sign out.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeOldest(learner: ActiveDevicesLearner) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchActiveDevicesLearnerDetail(learner.membershipId);
      const oldest = [...response.data.devices].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )[0];
      if (!oldest) {
        setError("No devices to revoke for this learner.");
        return;
      }
      await deleteActiveDevices([oldest.id]);
      await Promise.all([loadRoster(), loadOverview()]);
    } catch (revokeError) {
      setError(
        revokeError instanceof ClientApiError
          ? revokeError.message
          : revokeError instanceof Error
            ? revokeError.message
            : "Unable to revoke device.",
      );
    } finally {
      setBusy(false);
      setMenuLearnerId(null);
    }
  }

  async function handleBulkForceSignOut() {
    if (selectedLearnerIds.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const membershipId of selectedLearnerIds) {
        await forceSignOutActiveDevices(membershipId);
      }
      setSelectedLearnerIds(new Set());
      await Promise.all([loadRoster(), loadOverview()]);
    } catch (bulkError) {
      setError(
        bulkError instanceof ClientApiError
          ? bulkError.message
          : bulkError instanceof Error
            ? bulkError.message
            : "Unable to revoke selected learners.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleExportCsv() {
    const header = ["Learner", "Email", "Devices", "Platforms", "IPs", "Last seen", "Status"];
    const rows = visibleLearners.map((learner) => [
      learner.learnerName ?? "",
      learner.email ?? "",
      String(learner.deviceCount),
      learner.platforms.join("; "),
      learner.ipAddresses.join("; "),
      learner.lastSeenAt ?? "",
      learner.status,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `active-devices-${windowKey}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch("");
    setPlatform("");
    setLastSeenFilter("");
    setStatusFilter("");
    setPage(1);
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const changeCount = overview?.summary.changeCount ?? 0;
  const showEmpty = !loading && !error && visibleLearners.length === 0;
  const overLimitCount = overview?.summary.overDeviceLimit ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
          <Link href="/admin" className="hover:text-[var(--admin-primary)]">
            Admin
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/enrollments" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium text-[var(--admin-on-surface)]">Active Devices</span>
        </nav>

        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Active Devices
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              Monitor learner sessions, revoke devices, and enforce device limits across the tenant.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 items-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-0.5">
              {WINDOW_OPTIONS.map((option) => {
                const active = windowKey === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={[
                      "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                        : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                    ].join(" ")}
                    onClick={() => {
                      setWindowKey(option.value);
                      setPage(1);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <Link
              href="/admin/reports/active-devices/policies"
              className="inline-flex h-10 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
            >
              <Shield className="h-4 w-4" aria-hidden="true" />
              Device policy
            </Link>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
              onClick={handleExportCsv}
              disabled={visibleLearners.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || selectedLearnerIds.size === 0}
              onClick={() => {
                void handleBulkForceSignOut();
              }}
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              Revoke selected
            </button>
          </div>
        </div>

        <div className="mt-4">
          <ActiveDevicesReportTabs active="overview" />
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-[var(--admin-danger)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-sm font-medium text-[var(--admin-primary)]"
            onClick={() => {
              void loadRoster();
              void loadOverview();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="flex h-[104px] flex-col justify-between border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Active devices
            </span>
            {!overviewLoading && changeCount !== 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-2 py-0.5 text-xs font-medium text-[var(--admin-primary)]">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                {changeCount > 0 ? "+" : ""}
                {changeCount} vs prev
              </span>
            ) : null}
          </div>
          <div className="flex items-end justify-between">
            {overviewLoading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-[var(--admin-surface-high)]" />
            ) : (
              <span className="font-mono text-3xl font-medium leading-none text-[var(--admin-on-surface)]">
                {(overview?.summary.activeDevicesCount ?? 0).toLocaleString()}
              </span>
            )}
            <DeviceSparkline points={overview?.trend ?? []} />
          </div>
        </div>

        <div className="flex h-[104px] flex-col justify-between border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            Learners signed in
          </span>
          {overviewLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-[var(--admin-surface-high)]" />
          ) : (
            <span className="font-mono text-3xl font-medium leading-none text-[var(--admin-on-surface)]">
              {(overview?.summary.learnersSignedIn ?? 0).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex h-[104px] flex-col justify-between border border-[var(--admin-border)] border-l-4 border-l-[var(--admin-warning)] bg-[var(--admin-surface)] p-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            Over device limit
          </span>
          <div className="flex items-end gap-2">
            {overviewLoading ? (
              <div className="h-8 w-12 animate-pulse rounded bg-[var(--admin-surface-high)]" />
            ) : (
              <span className="font-mono text-3xl font-medium leading-none text-[var(--admin-on-surface)]">
                {overLimitCount.toLocaleString()}
              </span>
            )}
            <TriangleAlert
              className="mb-0.5 h-5 w-5 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="flex h-[104px] flex-col justify-between border border-[var(--admin-border)] border-l-4 border-l-[var(--admin-danger)] bg-[var(--admin-surface)] p-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            Flagged sessions
          </span>
          <div className="flex items-end gap-2">
            <span className="font-mono text-3xl font-medium leading-none text-[var(--admin-on-surface)]">
              {(overview?.summary.flaggedSessions ?? 0).toLocaleString()}
            </span>
            <AlertTriangle
              className="mb-0.5 h-5 w-5 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="relative flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] pb-11">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative h-10 w-64">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--admin-outline)]"
                aria-hidden="true"
              />
              <input
                className="h-full w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                placeholder="Search learner..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>

            <Select
              value={platform}
              onValueChange={(value) => {
                setPlatform(value);
                setPage(1);
              }}
              options={[...PLATFORM_OPTIONS]}
              ariaLabel="Device type"
              className={selectTriggerClassName}
            />
            <Select
              value={lastSeenFilter}
              onValueChange={setLastSeenFilter}
              options={[...LAST_SEEN_OPTIONS]}
              ariaLabel="Last seen"
              className={selectTriggerClassName}
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                if (value === "over_limit") setView("attention");
                if (value === "active" || value === "") setView("all");
                setPage(1);
              }}
              options={[...STATUS_OPTIONS]}
              ariaLabel="Status"
              className={selectTriggerClassName}
            />

            <div className="mx-1 hidden h-6 w-px bg-[var(--admin-border)] sm:block" />

            {activeChips.length > 0 ? (
              <button
                type="button"
                className="ml-auto text-sm font-medium text-[var(--admin-primary)] hover:underline"
                onClick={clearFilters}
              >
                Clear all
              </button>
            ) : null}
          </div>

          {activeChips.length > 0 ? (
            <div className={`flex flex-wrap items-center gap-2 ${inlineExpandClassName}`}>
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                Active filters:
              </span>
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={[
                    "inline-flex h-6 items-center gap-1 rounded border px-2 text-xs font-medium",
                    chip.key === "status" && statusFilter === "over_limit"
                      ? "border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={chip.clear}
                >
                  {chip.label}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
          {(
            [
              { key: "all", label: "All Active" },
              { key: "attention", label: `Requires Attention (${overLimitCount})` },
              { key: "suspicious", label: "Suspicious Activity" },
            ] as const
          ).map((tab) => {
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={[
                  "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                onClick={() => {
                  setView(tab.key);
                  setStatusFilter(tab.key === "attention" ? "over_limit" : "");
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                <th className="sticky left-0 z-10 w-12 bg-[var(--admin-surface)] px-4 py-2">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--admin-outline)] accent-[var(--admin-primary)]"
                    checked={
                      visibleLearners.length > 0 &&
                      visibleLearners.every((learner) =>
                        selectedLearnerIds.has(learner.membershipId),
                      )
                    }
                    onChange={toggleAllVisible}
                    aria-label="Select all visible learners"
                  />
                </th>
                <th className="min-w-[200px] px-4 py-2">Learner</th>
                <th className="w-32 px-4 py-2">Devices</th>
                <th className="min-w-[150px] px-4 py-2">Device types</th>
                <th className="min-w-[150px] px-4 py-2">Locations</th>
                <th className="min-w-[180px] px-4 py-2">Last seen</th>
                <th className="w-32 px-4 py-2">Status</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-border)_55%,transparent)] text-sm text-[var(--admin-on-surface)]">
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="h-11">
                      <td colSpan={8} className="px-4 py-2">
                        <div className="h-6 animate-pulse rounded bg-[var(--admin-surface-high)]" />
                      </td>
                    </tr>
                  ))
                : null}

              {showEmpty ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16">
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      <EmptyIllustration />
                      <h3 className="mt-6 text-lg font-semibold text-[var(--admin-on-surface)]">
                        {view === "suspicious"
                          ? "No suspicious activity flagged"
                          : "No active devices in this window"}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                        {view === "suspicious"
                          ? "Session flagging is not configured yet. Use Requires Attention for learners over the device limit."
                          : "Nothing matched these filters. Widen the time window or clear filters to see device inventory."}
                      </p>
                      {activeChips.length > 0 || view !== "all" ? (
                        <button
                          type="button"
                          className={`${primaryButtonClassName} mt-6`}
                          onClick={() => {
                            clearFilters();
                            setView("all");
                          }}
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !showEmpty
                ? visibleLearners.map((learner) => {
                    const selected = selectedLearnerIds.has(learner.membershipId);
                    const overLimit = learner.status === "over_limit";
                    const menuOpen = menuLearnerId === learner.membershipId;
                    return (
                      <tr
                        key={learner.membershipId}
                        className={[
                          "group h-11 transition-colors hover:bg-[var(--admin-surface-low)]",
                          overLimit ? "bg-[var(--admin-surface-low)]" : "",
                        ].join(" ")}
                      >
                        <td
                          className={[
                            "sticky left-0 z-10 px-4 py-2",
                            overLimit
                              ? "border-l-4 border-l-[var(--admin-warning)] bg-[var(--admin-surface-low)]"
                              : "bg-[var(--admin-surface)] group-hover:bg-[var(--admin-surface-low)]",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-[var(--admin-outline)] accent-[var(--admin-primary)]"
                            checked={selected}
                            onChange={() => {
                              toggleLearner(learner.membershipId);
                            }}
                            aria-label={`Select ${learner.learnerName ?? learner.email ?? "learner"}`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            className="flex items-center gap-3 text-left"
                            onClick={() => {
                              goToLearnerDetail(learner.membershipId);
                            }}
                          >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[10px] font-bold text-[var(--admin-primary)]">
                              {learnerInitials(learner.learnerName, learner.email)}
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-medium text-[var(--admin-on-surface)]">
                                {learner.learnerName ?? "-"}
                              </span>
                              <span className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                {learner.email ?? "-"}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 font-mono">
                            <span
                              className={
                                overLimit ? "font-semibold text-[var(--admin-warning)]" : ""
                              }
                            >
                              {learner.deviceCount}
                            </span>
                            {learner.platforms.slice(0, 3).map((platformName) => {
                              const Icon = platformIcon(platformName);
                              return (
                                <Icon
                                  key={`${learner.membershipId}-${platformName}`}
                                  className="h-4 w-4 text-[var(--admin-outline)]"
                                  aria-hidden="true"
                                />
                              );
                            })}
                          </div>
                        </td>
                        <td className="max-w-[150px] truncate px-4 py-2 text-[var(--admin-on-surface-variant)]">
                          {learner.platforms.length > 0
                            ? learner.platforms.map(titleCase).join(", ")
                            : "-"}
                        </td>
                        <td className="max-w-[150px] truncate px-4 py-2 text-[var(--admin-on-surface-variant)]">
                          {learner.ipAddresses.length > 0
                            ? learner.ipAddresses.slice(0, 2).join("; ")
                            : "-"}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span>{formatRelative(learner.lastSeenAt)}</span>
                            <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              {formatAbsolute(learner.lastSeenAt)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {overLimit ? (
                            <span className="inline-flex h-6 items-center gap-1 rounded border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2 text-xs font-medium text-[var(--admin-warning)]">
                              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                              Over limit
                            </span>
                          ) : (
                            <span className="inline-flex h-6 items-center rounded bg-[var(--admin-surface-high)] px-2 text-xs font-medium text-[var(--admin-on-surface)]">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="relative px-2 py-2 text-right">
                          <button
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            aria-controls={menuOpen ? menuId : undefined}
                            className="rounded p-0.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                            onClick={() => {
                              setMenuLearnerId((current) =>
                                current === learner.membershipId ? null : learner.membershipId,
                              );
                            }}
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {menuOpen ? (
                            <div
                              ref={menuRef}
                              id={menuId}
                              role="menu"
                              className={[
                                "absolute right-8 top-8 z-50 w-52 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg",
                                dropdownPanelEnterEndClassName,
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className={dropdownItemClassName}
                                onClick={() => {
                                  goToLearnerDetail(learner.membershipId);
                                }}
                              >
                                <Eye
                                  className="h-4 w-4 text-[var(--admin-outline)]"
                                  aria-hidden="true"
                                />
                                View session details
                              </button>
                              <Link
                                href={`/admin/members/${learner.membershipId}`}
                                role="menuitem"
                                className={dropdownItemClassName}
                                onClick={() => {
                                  setMenuLearnerId(null);
                                }}
                              >
                                <History
                                  className="h-4 w-4 text-[var(--admin-outline)]"
                                  aria-hidden="true"
                                />
                                Open member profile
                              </Link>
                              <div className="my-1 h-px w-full bg-[var(--admin-border)]" />
                              <button
                                type="button"
                                role="menuitem"
                                className={`${dropdownItemClassName} text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]`}
                                disabled={busy}
                                onClick={() => {
                                  void handleRevokeOldest(learner);
                                }}
                              >
                                <PhoneOff className="h-4 w-4" aria-hidden="true" />
                                Revoke oldest device
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={`${dropdownItemClassName} text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]`}
                                disabled={busy}
                                onClick={() => {
                                  setSelectedLearner(learner);
                                  setConfirmSignOutOpen(true);
                                  setMenuLearnerId(null);
                                }}
                              >
                                <Ban className="h-4 w-4" aria-hidden="true" />
                                Force sign out all
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex h-11 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
          <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {refreshedAt
              ? `Data refreshed ${formatRelative(refreshedAt.toISOString()).toLowerCase()}`
              : "Waiting for first refresh"}
          </span>
          <div className="flex items-center gap-4 text-sm text-[var(--admin-on-surface)]">
            <span className="font-mono text-[var(--admin-on-surface-variant)]">
              {loading
                ? "Loading..."
                : `${rangeStart}-${rangeEnd} of ${totalCount.toLocaleString()}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                disabled={busy || page <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                disabled={busy || page >= totalPages || totalPages === 0}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {selectedLearnerIds.size > 0 ? (
          <div className="absolute bottom-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-lg bg-[var(--admin-on-surface)] px-4 py-2 text-sm font-medium text-[var(--admin-surface)] shadow-lg">
            <span>{selectedLearnerIds.size} learner(s) selected</span>
            <div className="h-4 w-px bg-[var(--admin-outline)]" />
            <button
              type="button"
              className="text-[var(--admin-primary-container)] hover:underline"
              disabled={busy}
              onClick={() => {
                void handleBulkForceSignOut();
              }}
            >
              Force sign out
            </button>
            <button
              type="button"
              className="text-[var(--admin-primary-container)] hover:underline"
              onClick={handleExportCsv}
            >
              Export
            </button>
            <button
              type="button"
              className="text-[var(--admin-on-surface-variant)] hover:underline"
              onClick={() => {
                setSelectedLearnerIds(new Set());
              }}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      {detailOpen && selectedLearner ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--admin-scrim)] motion-safe:animate-[admin-fade-in_0.15s_ease-out]">
          <aside
            className={`flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl ${inlineExpandClassName}`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  {selectedLearner.learnerName ?? selectedLearner.email ?? "Learner"}
                </h2>
                <p className="mt-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  {selectedLearner.email ?? "-"}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  setDetailOpen(false);
                  setSelectedLearner(null);
                }}
                aria-label="Close details"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-[var(--admin-border)] px-5 py-3">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy || selectedDeviceIds.size === 0}
                onClick={() => {
                  setConfirmDeleteOpen(true);
                }}
              >
                Delete selected
              </button>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => {
                  setConfirmSignOutOpen(true);
                }}
              >
                Force sign out
              </button>
              <Link
                href={`/admin/members/${selectedLearner.membershipId}`}
                className={ghostButtonClassName}
              >
                Open profile
              </Link>
              <Link
                href={`/admin/reports/active-devices/${selectedLearner.membershipId}`}
                className={ghostButtonClassName}
              >
                Full detail
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-[var(--admin-on-surface-variant)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading devices...
                </div>
              ) : devices.length === 0 ? (
                <p className="px-5 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  No devices remain for this learner.
                </p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={devices.length > 0 && selectedDeviceIds.size === devices.length}
                          onChange={() => {
                            if (selectedDeviceIds.size === devices.length) {
                              setSelectedDeviceIds(new Set());
                              return;
                            }
                            setSelectedDeviceIds(new Set(devices.map((device) => device.id)));
                          }}
                          aria-label="Select all devices"
                        />
                      </th>
                      <th className="px-4 py-3">Device</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Last seen</th>
                      <th className="px-4 py-3">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device) => {
                      const checked = selectedDeviceIds.has(device.id);
                      return (
                        <tr key={device.id} className="border-b border-[var(--admin-border)]">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedDeviceIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(device.id)) next.delete(device.id);
                                  else next.add(device.id);
                                  return next;
                                });
                              }}
                              aria-label={`Select device ${device.id}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm">{device.deviceLabel}</td>
                          <td className="px-4 py-3">
                            {device.osLabel ?? titleCase(device.platform)}
                          </td>
                          <td className="px-4 py-3">{formatRelative(device.lastSeenAt)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{device.ipAddress ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {confirmDeleteOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            className={`w-full max-w-md space-y-4 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl ${inlineExpandClassName}`}
          >
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Delete devices</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Delete {selectedDeviceIds.size} selected device session(s)? Learners may need to sign
              in again on those devices.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => {
                  setConfirmDeleteOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  void handleDeleteSelectedDevices();
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmSignOutOpen && selectedLearner ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            className={`w-full max-w-md space-y-4 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl ${inlineExpandClassName}`}
          >
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Force sign out</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Sign out {selectedLearner.learnerName ?? selectedLearner.email ?? "this learner"} from
              all devices?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => {
                  setConfirmSignOutOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy}
                onClick={() => {
                  void handleForceSignOut();
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Force sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
