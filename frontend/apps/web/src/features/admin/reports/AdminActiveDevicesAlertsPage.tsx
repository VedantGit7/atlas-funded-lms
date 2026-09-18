"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Laptop,
  Loader2,
  MoreVertical,
  PhoneOff,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { dropdownPanelEnterEndClassName } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  dropdownItemClassName,
  inlineExpandClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import { deleteActiveDevices } from "./admin-active-devices-roster-api";
import {
  addDeviceAlertNote,
  dismissDeviceAlerts,
  fetchDeviceAlertDetail,
  fetchDeviceAlerts,
  resolveDeviceAlerts,
  type DeviceAlertDetail,
  type DeviceAlertListItem,
  type DeviceAlertStatus,
  type DeviceAlertType,
  type DeviceAlertsSummary,
} from "./admin-active-devices-alerts-api";
import { ActiveDevicesReportTabs } from "./ActiveDevicesReportTabs";

const PAGE_SIZE = 50;

type TriageFilter =
  | { kind: "status"; status: DeviceAlertStatus }
  | { kind: "type"; type: DeviceAlertType; status: "open" };

function formatRelative(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

function severityMeta(severity: DeviceAlertListItem["severity"]) {
  if (severity === "critical") {
    return {
      label: "Critical",
      rail: "bg-[var(--admin-danger)]",
      chip: "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
    };
  }
  if (severity === "warn") {
    return {
      label: "Warn",
      rail: "bg-[var(--admin-warning)]",
      chip: "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]",
    };
  }
  return {
    label: "Info",
    rail: "bg-[var(--admin-outline)]",
    chip: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  };
}

function typeLabel(type: DeviceAlertType): string {
  if (type === "concurrent_sessions") return "Concurrent sessions";
  if (type === "device_limit_exceeded") return "Device limit exceeded";
  return "Shared fingerprint";
}

export function AdminActiveDevicesAlertsPage() {
  const menuBaseId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [triage, setTriage] = useState<TriageFilter>({ kind: "status", status: "open" });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DeviceAlertListItem[]>([]);
  const [summary, setSummary] = useState<DeviceAlertsSummary | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuAlertId, setMenuAlertId] = useState<string | null>(null);
  const [drawerAlertId, setDrawerAlertId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeviceAlertDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const filters = useMemo(() => {
    if (triage.kind === "type") {
      return { status: "open" as const, type: triage.type, page, limit: PAGE_SIZE };
    }
    return { status: triage.status, page, limit: PAGE_SIZE };
  }, [page, triage]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDeviceAlerts(filters);
      setItems(response.data.items);
      setSummary(response.data.summary);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotalCount(response.data.pageInfo.totalCount);
      setSelectedIds(new Set());
    } catch (err) {
      setItems([]);
      setError(err instanceof ClientApiError ? err.message : "Unable to load device alerts.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!drawerAlertId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void fetchDeviceAlertDetail(drawerAlertId)
      .then((response) => {
        if (!cancelled) setDetail(response.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ClientApiError ? err.message : "Unable to load alert detail.");
          setDrawerAlertId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drawerAlertId]);

  useEffect(() => {
    if (!menuAlertId) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAlertId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuAlertId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuAlertId]);

  function setTriageFilter(next: TriageFilter) {
    setTriage(next);
    setPage(1);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleResolve(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await resolveDeviceAlerts(ids);
      setDrawerAlertId(null);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to resolve alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await dismissDeviceAlerts(ids);
      setDrawerAlertId(null);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to dismiss alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeSessions() {
    if (!detail?.sessions.length) return;
    setBusy(true);
    try {
      await deleteActiveDevices(detail.sessions.map((session) => session.id));
      await handleResolve([detail.id]);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to revoke devices.");
      setBusy(false);
    }
  }

  async function handlePostNote() {
    if (!detail || !noteDraft.trim()) return;
    setBusy(true);
    try {
      const response = await addDeviceAlertNote(detail.id, noteDraft.trim());
      setDetail({
        ...detail,
        notes: [...detail.notes, response.data],
      });
      setNoteDraft("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to add note.");
    } finally {
      setBusy(false);
    }
  }

  const openFilterActive = triage.kind === "status" && triage.status === "open";
  const resolvedActive = triage.kind === "status" && triage.status === "resolved";
  const dismissedActive = triage.kind === "status" && triage.status === "dismissed";
  const isEmpty = !loading && items.length === 0;

  return (
    <div className="flex flex-col gap-0">
      <div className="mb-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] pb-0">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="mb-1 text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
              Device alerts
            </h1>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Sessions that tripped a device rule. Triage, resolve, or dismiss.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/reports/active-devices/policies"
              className={`${ghostButtonClassName} h-10 gap-2`}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Alert rules
            </Link>
            <button
              type="button"
              className={`${primaryButtonClassName} h-10 gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={busy || selectedIds.size === 0}
              onClick={() => void handleResolve([...selectedIds])}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Resolve selected
            </button>
            <button
              type="button"
              className="rounded p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              aria-label="Refresh"
              onClick={() => void load()}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        <ActiveDevicesReportTabs active="alerts" />
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
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

      <div className="mt-0 flex min-h-[70vh] flex-col overflow-hidden border border-t-0 border-[var(--admin-border)] bg-[var(--admin-surface)] lg:flex-row">
        <aside className="w-full shrink-0 border-b border-[var(--admin-border)] lg:w-[220px] lg:border-b-0 lg:border-r">
          <div className="p-4 py-6">
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Triage filters
            </h3>
            <ul className="space-y-1">
              {(
                [
                  {
                    key: "open",
                    label: "All open",
                    count: summary?.openTotal ?? 0,
                    active: openFilterActive,
                    onClick: () => {
                      setTriageFilter({ kind: "status", status: "open" });
                    },
                  },
                  {
                    key: "concurrent_sessions",
                    label: "Concurrent sessions",
                    count: summary?.byType.concurrent_sessions ?? 0,
                    active: triage.kind === "type" && triage.type === "concurrent_sessions",
                    onClick: () => {
                      setTriageFilter({
                        kind: "type",
                        type: "concurrent_sessions",
                        status: "open",
                      });
                    },
                  },
                  {
                    key: "device_limit_exceeded",
                    label: "Device limit exceeded",
                    count: summary?.byType.device_limit_exceeded ?? 0,
                    active: triage.kind === "type" && triage.type === "device_limit_exceeded",
                    onClick: () => {
                      setTriageFilter({
                        kind: "type",
                        type: "device_limit_exceeded",
                        status: "open",
                      });
                    },
                  },
                  {
                    key: "shared_fingerprint",
                    label: "Shared fingerprint",
                    count: summary?.byType.shared_fingerprint ?? 0,
                    active: triage.kind === "type" && triage.type === "shared_fingerprint",
                    onClick: () => {
                      setTriageFilter({
                        kind: "type",
                        type: "shared_fingerprint",
                        status: "open",
                      });
                    },
                  },
                ] as const
              ).map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`flex w-full items-center justify-between rounded-r px-3 py-2 text-left text-sm transition-colors ${
                      item.active
                        ? "border-l-4 border-[var(--admin-primary)] bg-[var(--admin-surface-high)] font-semibold text-[var(--admin-on-surface)]"
                        : "border-l-4 border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)]"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="rounded bg-[var(--admin-surface-variant)] px-1.5 py-0.5 font-mono text-[11px]">
                      {item.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {summary?.unsupportedRules.length ? (
              <>
                <div className="my-4 h-px w-full bg-[var(--admin-border)]" />
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-outline)]">
                  Not configured
                </p>
                <ul className="space-y-1">
                  {summary.unsupportedRules.map((rule) => (
                    <li key={rule.key}>
                      <div
                        className="rounded-r border-l-4 border-transparent px-3 py-2 text-sm text-[var(--admin-outline)]"
                        title={rule.reason}
                      >
                        <div className="flex items-center justify-between">
                          <span>{rule.label}</span>
                          <span className="font-mono text-[11px]">-</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="my-4 h-px w-full bg-[var(--admin-border)]" />
            <ul className="space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setTriageFilter({ kind: "status", status: "resolved" });
                  }}
                  className={`flex w-full items-center justify-between rounded-r px-3 py-2 text-left text-sm transition-colors ${
                    resolvedActive
                      ? "border-l-4 border-[var(--admin-primary)] bg-[var(--admin-surface-high)] font-semibold text-[var(--admin-on-surface)]"
                      : "border-l-4 border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)]"
                  }`}
                >
                  <span>Resolved</span>
                  <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {summary?.resolvedCount ?? 0}
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setTriageFilter({ kind: "status", status: "dismissed" });
                  }}
                  className={`flex w-full items-center justify-between rounded-r px-3 py-2 text-left text-sm transition-colors ${
                    dismissedActive
                      ? "border-l-4 border-[var(--admin-primary)] bg-[var(--admin-surface-high)] font-semibold text-[var(--admin-on-surface)]"
                      : "border-l-4 border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)]"
                  }`}
                >
                  <span>Dismissed</span>
                  <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {summary?.dismissedCount ?? 0}
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto bg-[var(--admin-surface-low)] p-6">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[72px] border border-[var(--admin-border)] bg-[var(--admin-surface)]"
                >
                  <div
                    className="h-full w-full bg-[var(--admin-surface-variant)]"
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <ShieldCheck className="h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                No alerts in this category
              </h3>
              <p className="mb-8 max-w-md text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                {resolvedActive || dismissedActive
                  ? "No triaged alerts here yet. Open alerts will appear when device rules fire."
                  : "No open alerts for this filter. The queue is clear for this subset."}
              </p>
              {!openFilterActive ? (
                <button
                  type="button"
                  className={`${primaryButtonClassName} inline-flex h-10 items-center gap-2`}
                  onClick={() => {
                    setTriageFilter({ kind: "status", status: "open" });
                  }}
                >
                  Go to open alerts
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex max-w-[1200px] flex-col gap-3">
              {items.map((alert) => {
                const meta = severityMeta(alert.severity);
                const selected = selectedIds.has(alert.id);
                const menuOpen = menuAlertId === alert.id;
                const menuId = `${menuBaseId}-${alert.id}`;
                return (
                  <div
                    key={alert.id}
                    className="group relative flex min-h-[72px] items-center overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] py-3 pr-4 transition-colors hover:border-[var(--admin-outline)]"
                  >
                    <div
                      className={`absolute bottom-0 left-0 top-0 w-1 ${meta.rail}`}
                      aria-hidden="true"
                    />
                    <div className="flex h-full items-center px-4 pr-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--admin-outline)] accent-[var(--admin-primary)]"
                        checked={selected}
                        onChange={() => {
                          toggleSelected(alert.id);
                        }}
                        aria-label={`Select alert ${alert.title}`}
                      />
                    </div>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col justify-center pr-4 text-left"
                      onClick={() => {
                        setDrawerAlertId(alert.id);
                      }}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
                        <h4 className="truncate text-[15px] font-semibold text-[var(--admin-on-surface)]">
                          {alert.title}
                        </h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--admin-on-surface-variant)]">
                        <span className="font-medium text-[var(--admin-on-surface)]">
                          {alert.learnerName ?? alert.email ?? "Learner"}
                        </span>
                        {alert.email ? (
                          <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                            {alert.email}
                          </span>
                        ) : null}
                        <span className="text-xs text-[var(--admin-outline)]">
                          {typeLabel(alert.alertType)}
                        </span>
                      </div>
                    </button>
                    <div className="hidden min-w-[200px] shrink-0 flex-col gap-1 pr-6 lg:flex">
                      {alert.evidenceSummary.slice(0, 3).map((chip) => (
                        <span
                          key={chip}
                          className="w-fit whitespace-nowrap border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface)]"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="flex w-24 flex-col items-end text-right">
                        <span
                          className={`text-xs font-semibold ${
                            alert.severity === "critical"
                              ? "text-[var(--admin-danger)]"
                              : "text-[var(--admin-on-surface-variant)]"
                          }`}
                        >
                          {formatRelative(alert.detectedAt)}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                          {formatUtc(alert.detectedAt).slice(11)}
                        </span>
                      </div>
                      <div className="relative w-8">
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          aria-controls={menuOpen ? menuId : undefined}
                          className="p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                          onClick={() => {
                            setMenuAlertId((current) => (current === alert.id ? null : alert.id));
                          }}
                        >
                          <MoreVertical className="h-5 w-5" aria-hidden="true" />
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
                                setMenuAlertId(null);
                                setDrawerAlertId(alert.id);
                              }}
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              Open detail
                            </button>
                            <Link
                              href={`/admin/reports/active-devices/${alert.membershipId}`}
                              role="menuitem"
                              className={dropdownItemClassName}
                              onClick={() => {
                                setMenuAlertId(null);
                              }}
                            >
                              <Laptop className="h-4 w-4" aria-hidden="true" />
                              Learner devices
                            </Link>
                            {alert.status === "open" ? (
                              <>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={dropdownItemClassName}
                                  disabled={busy}
                                  onClick={() => {
                                    setMenuAlertId(null);
                                    void handleResolve([alert.id]);
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  Mark resolved
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={`${dropdownItemClassName} text-[var(--admin-danger)]`}
                                  disabled={busy}
                                  onClick={() => {
                                    setMenuAlertId(null);
                                    void handleDismiss([alert.id]);
                                  }}
                                >
                                  <Ban className="h-4 w-4" aria-hidden="true" />
                                  Dismiss
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}

              {totalPages > 1 ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-[var(--admin-on-surface-variant)]">
                    {totalCount} alert{totalCount === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={page <= 1}
                      onClick={() => {
                        setPage((current) => Math.max(1, current - 1));
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="font-mono text-sm">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={page >= totalPages}
                      onClick={() => {
                        setPage((current) => current + 1);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {drawerAlertId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--admin-scrim)]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close alert drawer overlay"
            onClick={() => {
              setDrawerAlertId(null);
            }}
          />
          <aside
            className={`relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl ${inlineExpandClassName}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-drawer-title"
          >
            {detailLoading || !detail ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading alert...
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
                  <div className="flex gap-4">
                    <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]">
                      {detail.severity === "critical" ? (
                        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
                      ) : (
                        <TriangleAlert className="h-7 w-7" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <h2
                        id="alert-drawer-title"
                        className="text-base font-semibold text-[var(--admin-on-surface)]"
                      >
                        {detail.title}
                      </h2>
                      <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                        Alert ID: {detail.id.slice(0, 8).toUpperCase()}
                      </p>
                      <div
                        className={`mt-2 inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] ${severityMeta(detail.severity).chip}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                        {severityMeta(detail.severity).label.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                    aria-label="Close"
                    onClick={() => {
                      setDrawerAlertId(null);
                    }}
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex-1 space-y-8 overflow-y-auto bg-[var(--admin-surface-low)] p-6">
                  <section>
                    <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Rule definition
                    </h3>
                    <div className="grid grid-cols-2 gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                      <div>
                        <div className="mb-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          Rule fired
                        </div>
                        <div className="text-sm font-semibold text-[var(--admin-on-surface)]">
                          {detail.ruleLabel}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          Threshold
                        </div>
                        <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                          {detail.thresholdLabel}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Learner
                    </h3>
                    <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                      <div className="font-semibold text-[var(--admin-on-surface)]">
                        {detail.learnerName ?? detail.email ?? "Learner"}
                      </div>
                      <div className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                        {detail.email ?? "-"}
                      </div>
                      <Link
                        href={`/admin/reports/active-devices/${detail.membershipId}`}
                        className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--admin-primary)] hover:underline"
                      >
                        Open learner devices
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Related sessions
                    </h3>
                    {detail.sessions.length === 0 ? (
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        Sessions for this alert are no longer present.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {detail.sessions.map((session, index) => (
                          <div
                            key={session.id}
                            className={`flex flex-col rounded border ${
                              index === detail.sessions.length - 1 && detail.sessions.length > 1
                                ? "border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))]"
                                : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
                            }`}
                          >
                            <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                              <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                                Session {index + 1}
                              </span>
                              <span className="rounded bg-[var(--admin-surface-variant)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                {formatRelative(session.lastSeenAt)}
                              </span>
                            </div>
                            <div className="space-y-2 p-4 font-mono text-[13px] text-[var(--admin-on-surface)]">
                              <div>{session.deviceLabel}</div>
                              <div className="text-[var(--admin-on-surface-variant)]">
                                {session.ipAddress ?? "No IP"}
                              </div>
                              <div className="text-[var(--admin-on-surface-variant)]">
                                {formatUtc(session.lastSeenAt)}
                              </div>
                              <Link
                                href={`/admin/reports/active-devices/${detail.membershipId}/${session.id}`}
                                className="inline-flex text-[var(--admin-primary)] hover:underline"
                              >
                                Open session
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* `geoAvailable` is typed as the literal `false` until IP
                        geolocation ships, so this notice always renders. */}
                    <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
                      Geographic trajectory is unavailable without IP geolocation.
                    </p>
                  </section>

                  <section>
                    <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Evidence
                    </h3>
                    <pre className="overflow-x-auto rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                      {JSON.stringify(detail.evidence, null, 2)}
                    </pre>
                  </section>

                  <section className="pb-4">
                    <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Investigation notes
                    </h3>
                    <div className="mb-4 space-y-3">
                      {detail.notes.length === 0 ? (
                        <p className="text-sm text-[var(--admin-on-surface-variant)]">
                          No notes yet.
                        </p>
                      ) : (
                        detail.notes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-r border-l-2 border-[var(--admin-primary)] bg-[var(--admin-surface)] p-3"
                          >
                            <div className="mb-1 flex justify-between gap-2">
                              <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                                {note.authorLabel ?? "Admin"}
                              </span>
                              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                {formatUtc(note.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--admin-on-surface-variant)]">
                              {note.body}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="relative">
                      <textarea
                        className="h-24 w-full resize-none rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-outline)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                        placeholder="Add internal note..."
                        value={noteDraft}
                        onChange={(event) => {
                          setNoteDraft(event.target.value);
                        }}
                      />
                      <button
                        type="button"
                        className="absolute bottom-3 right-3 text-sm font-semibold text-[var(--admin-primary)] hover:underline disabled:opacity-50"
                        disabled={busy || !noteDraft.trim()}
                        onClick={() => void handlePostNote()}
                      >
                        Post
                      </button>
                    </div>
                  </section>
                </div>

                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                  <button
                    type="button"
                    className={`${ghostButtonClassName} mr-auto`}
                    disabled={busy || !detail.capabilities.canDismiss}
                    onClick={() => void handleDismiss([detail.id])}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={busy || !detail.capabilities.canResolve}
                    onClick={() => void handleResolve([detail.id])}
                  >
                    Mark resolved
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-danger)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] hover:opacity-90 disabled:opacity-50"
                    disabled={busy || !detail.capabilities.canRevokeSessions}
                    onClick={() => void handleRevokeSessions()}
                  >
                    <PhoneOff className="h-4 w-4" aria-hidden="true" />
                    Revoke related devices
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
