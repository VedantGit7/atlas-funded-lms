"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Link2,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
  Unlink,
  User,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  fetchZoomParticipantDetail,
  mutateZoomParticipantMatch,
  type ZoomMatchState,
  type ZoomParticipantDetail,
  type ZoomParticipantSession,
} from "./admin-zoom-insights-roster-api";

type MemberSearchResult = {
  id: string;
  label: string;
  email: string | null;
};

type TimelineSegment =
  | {
      kind: "session";
      startPct: number;
      widthPct: number;
      session: ZoomParticipantSession;
    }
  | {
      kind: "gap";
      startPct: number;
      widthPct: number;
      gapSeconds: number;
    };

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerOutlineButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded border border-[var(--admin-danger)] bg-transparent px-4 text-sm font-medium text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m ${String(secs).padStart(2, "0")}s`;
  return `${String(secs)}s`;
}

function formatDurationParts(seconds: number | null | undefined): ReactNode {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return (
      <>
        {hours}
        <span className="ml-0.5 text-base text-[var(--admin-on-surface-variant)]">h</span>{" "}
        {String(minutes).padStart(2, "0")}
        <span className="ml-0.5 text-base text-[var(--admin-on-surface-variant)]">m</span>
      </>
    );
  }
  return (
    <>
      {minutes}
      <span className="ml-0.5 text-base text-[var(--admin-on-surface-variant)]">m</span>{" "}
      {String(secs).padStart(2, "0")}
      <span className="ml-0.5 text-base text-[var(--admin-on-surface-variant)]">s</span>
    </>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function participantInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function matchStatePill(state: ZoomMatchState): { tone: string; label: string } {
  if (state === "matched") {
    return {
      tone: "border-[color-mix(in_srgb,var(--admin-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]",
      label: "Matched",
    };
  }
  if (state === "guest") {
    return {
      tone: "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      label: "Guest",
    };
  }
  return {
    tone: "border-[color-mix(in_srgb,var(--admin-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]",
    label: "Unmatched",
  };
}

function deviceIcon(hint: ZoomParticipantSession["deviceHint"]) {
  if (hint === "mobile") return Smartphone;
  if (hint === "tablet") return Tablet;
  if (hint === "desktop") return Monitor;
  return Monitor;
}

function enrollmentLabel(
  status: ZoomParticipantDetail["lmsCrossCheck"]["enrollmentStatus"],
): string {
  if (status === "active") return "Active enrollment";
  if (status === "inactive") return "Inactive";
  if (status === "unlinked") return "Not linked";
  return "Unknown";
}

function matchMethodLabel(method: ZoomParticipantDetail["lmsCrossCheck"]["matchMethod"]): string {
  if (method === "membership") return "Manual membership link";
  if (method === "exact_email") return "Exact email match";
  return "None";
}

function buildPresenceTimeline(detail: ZoomParticipantDetail): {
  segments: TimelineSegment[];
  axisLabels: [string, string, string];
  meetingStartMs: number;
  meetingDurationMs: number;
} | null {
  const sessions = [...detail.sessions]
    .filter(
      (session): session is ZoomParticipantSession & { joinTime: string; leaveTime: string } =>
        Boolean(session.joinTime && session.leaveTime),
    )
    .sort((a, b) => {
      const aTime = new Date(a.joinTime).getTime();
      const bTime = new Date(b.joinTime).getTime();
      return aTime - bTime;
    });

  if (sessions.length === 0) return null;

  const firstSession = defined(sessions[0]);
  const lastSession = defined(sessions[sessions.length - 1]);

  const meetingStartMs = detail.meetingStartedAt
    ? new Date(detail.meetingStartedAt).getTime()
    : new Date(firstSession.joinTime).getTime();

  const meetingEndMs = detail.meetingEndedAt
    ? new Date(detail.meetingEndedAt).getTime()
    : new Date(lastSession.leaveTime).getTime();

  const meetingDurationMs =
    detail.meetingDurationSeconds != null && detail.meetingDurationSeconds > 0
      ? detail.meetingDurationSeconds * 1000
      : Math.max(meetingEndMs - meetingStartMs, 1);

  const segments: TimelineSegment[] = [];
  let previousLeaveMs: number | null = null;

  for (const session of sessions) {
    const joinMs = new Date(session.joinTime).getTime();
    const leaveMs = new Date(session.leaveTime).getTime();

    if (previousLeaveMs != null && joinMs > previousLeaveMs) {
      const gapSeconds = Math.round((joinMs - previousLeaveMs) / 1000);
      const gapStartPct = ((previousLeaveMs - meetingStartMs) / meetingDurationMs) * 100;
      const gapWidthPct = ((joinMs - previousLeaveMs) / meetingDurationMs) * 100;
      if (gapWidthPct > 0) {
        segments.push({
          kind: "gap",
          startPct: gapStartPct,
          widthPct: gapWidthPct,
          gapSeconds,
        });
      }
    }

    const startPct = ((joinMs - meetingStartMs) / meetingDurationMs) * 100;
    const widthPct = ((leaveMs - joinMs) / meetingDurationMs) * 100;
    if (widthPct > 0) {
      segments.push({
        kind: "session",
        startPct,
        widthPct,
        session,
      });
    }

    previousLeaveMs = leaveMs;
  }

  const midMs = meetingStartMs + meetingDurationMs / 2;
  const axisLabels: [string, string, string] = [
    formatTime(detail.meetingStartedAt ?? firstSession.joinTime),
    formatTime(new Date(midMs).toISOString()),
    formatTime(detail.meetingEndedAt ?? lastSession.leaveTime),
  ];

  return { segments, axisLabels, meetingStartMs, meetingDurationMs };
}

async function searchMembers(term: string): Promise<MemberSearchResult[]> {
  const response = await clientApi.get<{
    data: {
      items: Array<{
        id: string;
        invitedEmail: string | null;
        accountEmail?: string | null;
        profile: { displayName: string | null } | null;
      }>;
    };
  }>(`/api/v1/members?search=${encodeURIComponent(term.trim())}&limit=10&status=ACTIVE`);

  return response.data.items.map((member) => ({
    id: member.id,
    label: member.profile?.displayName ?? member.invitedEmail ?? member.accountEmail ?? member.id,
    email: member.accountEmail ?? member.invitedEmail,
  }));
}

function sortCandidates(
  candidates: MemberSearchResult[],
  participantEmail: string | null,
): MemberSearchResult[] {
  if (!participantEmail) return candidates;
  const normalized = participantEmail.trim().toLowerCase();
  return [...candidates].sort((a, b) => {
    const aExact = a.email?.trim().toLowerCase() === normalized ? 1 : 0;
    const bExact = b.email?.trim().toLowerCase() === normalized ? 1 : 0;
    return bExact - aExact;
  });
}

function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading participant details">
      <Shimmer className="h-4 w-80 max-w-full" />
      <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="flex gap-4">
          <Shimmer className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-7 w-48" />
            <Shimmer className="h-4 w-56" />
            <Shimmer className="h-6 w-24" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Shimmer key={index} className="h-24 border border-[var(--admin-border)]" />
        ))}
      </div>
      <Shimmer className="h-28 w-full border border-[var(--admin-border)]" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        <Shimmer className="h-80 border border-[var(--admin-border)]" />
        <div className="space-y-4">
          <Shimmer className="h-40 border border-[var(--admin-border)]" />
          <Shimmer className="h-48 border border-[var(--admin-border)]" />
        </div>
      </div>
    </div>
  );
}

function MatchDrawer({
  open,
  onClose,
  participantEmail,
  otherUnmatchedMeetingCount,
  busy,
  onMatch,
}: {
  open: boolean;
  onClose: () => void;
  participantEmail: string | null;
  otherUnmatchedMeetingCount: number;
  busy: boolean;
  onMatch: (membershipId: string, applyToOtherMeetings: boolean) => void;
}) {
  const titleId = useId();
  const searchId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyToOthers, setApplyToOthers] = useState(otherUnmatchedMeetingCount > 0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedId(null);
    setApplyToOthers(otherUnmatchedMeetingCount > 0);
    setResults([]);
    if (participantEmail?.trim()) {
      setSearching(true);
      void searchMembers(participantEmail)
        .then((items) => {
          setResults(sortCandidates(items, participantEmail));
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setSearching(false);
        });
    }
  }, [open, otherUnmatchedMeetingCount, participantEmail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  async function handleSearch(term: string) {
    setQuery(term);
    if (!term.trim()) {
      if (participantEmail?.trim()) {
        setSearching(true);
        try {
          const items = await searchMembers(participantEmail);
          setResults(sortCandidates(items, participantEmail));
        } catch {
          setResults([]);
        } finally {
          setSearching(false);
        }
      } else {
        setResults([]);
      }
      return;
    }
    setSearching(true);
    try {
      const items = await searchMembers(term);
      setResults(sortCandidates(items, participantEmail));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  if (!open) return null;

  const suggested = results.filter(
    (member) =>
      participantEmail &&
      member.email?.trim().toLowerCase() === participantEmail.trim().toLowerCase(),
  );
  const otherResults = results.filter((member) => !suggested.some((s) => s.id === member.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_30%,transparent)] backdrop-blur-[2px]"
        aria-label="Close match drawer overlay"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_4px_32px_-4px_color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] outline-none"
      >
        <header className="border-b border-[var(--admin-border)] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]"
              >
                Match to learner
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Link this Zoom participant to an LMS member profile.
              </p>
            </div>
            <button
              type="button"
              className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
              aria-label="Close drawer"
              onClick={onClose}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
              aria-hidden="true"
            />
            <input
              id={searchId}
              className={`${fieldClassName} pl-9`}
              placeholder="Search by name or email…"
              value={query}
              onChange={(event) => {
                void handleSearch(event.target.value);
              }}
            />
          </div>

          {searching ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">Searching…</p>
          ) : null}

          {suggested.length > 0 ? (
            <div>
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Suggested (email match)
              </p>
              <ul className="overflow-hidden rounded border border-[var(--admin-border)]">
                {suggested.map((member) => (
                  <li
                    key={member.id}
                    className="border-b border-[var(--admin-border)] last:border-b-0"
                  >
                    <button
                      type="button"
                      className={[
                        "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--admin-surface-high)]",
                        selectedId === member.id
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "",
                      ].join(" ")}
                      onClick={() => {
                        setSelectedId(member.id);
                      }}
                    >
                      <span
                        className={[
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                          selectedId === member.id
                            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                            : "border-[var(--admin-outline)]",
                        ].join(" ")}
                      >
                        {selectedId === member.id ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                          {member.label}
                        </span>
                        {member.email ? (
                          <span className="block font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {member.email}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {otherResults.length > 0 ? (
            <div>
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                {suggested.length > 0 ? "Other results" : "Search results"}
              </p>
              <ul className="max-h-64 overflow-y-auto rounded border border-[var(--admin-border)]">
                {otherResults.map((member) => (
                  <li
                    key={member.id}
                    className="border-b border-[var(--admin-border)] last:border-b-0"
                  >
                    <button
                      type="button"
                      className={[
                        "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--admin-surface-high)]",
                        selectedId === member.id
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "",
                      ].join(" ")}
                      onClick={() => {
                        setSelectedId(member.id);
                      }}
                    >
                      <span
                        className={[
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                          selectedId === member.id
                            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                            : "border-[var(--admin-outline)]",
                        ].join(" ")}
                      >
                        {selectedId === member.id ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                          {member.label}
                        </span>
                        {member.email ? (
                          <span className="block font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {member.email}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!searching && results.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {query.trim() || participantEmail
                ? "No active members match this search."
                : "Type a name or email to find a learner."}
            </p>
          ) : null}

          {otherUnmatchedMeetingCount > 0 ? (
            <label className="flex items-start gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                checked={applyToOthers}
                onChange={(event) => {
                  setApplyToOthers(event.target.checked);
                }}
              />
              <span>
                Also apply to <strong className="font-mono">{otherUnmatchedMeetingCount}</strong>{" "}
                other meeting
                {otherUnmatchedMeetingCount === 1 ? "" : "s"} with the same unmatched identity
              </span>
            </label>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={ghostButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || !selectedId}
            onClick={() => {
              if (selectedId) onMatch(selectedId, applyToOthers);
            }}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {busy ? "Matching…" : "Match"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function PresenceTimeline({ detail }: { detail: ZoomParticipantDetail }) {
  const timeline = useMemo(() => buildPresenceTimeline(detail), [detail]);
  const showGaps = detail.sessionCount > 1;

  if (!timeline || timeline.segments.length === 0) {
    return (
      <div className="flex min-h-[88px] items-center justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-sm text-[var(--admin-on-surface-variant)]">
        No session timing data available for this participant.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="relative h-10 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)]"
        role="img"
        aria-label={`Meeting presence timeline with ${String(detail.sessionCount)} session${detail.sessionCount === 1 ? "" : "s"}`}
      >
        {timeline.segments.map((segment, index) => {
          if (segment.kind === "gap") {
            if (!showGaps) return null;
            return (
              <div
                key={`gap-${String(index)}`}
                className="absolute inset-y-0 border-x border-dashed border-[color-mix(in_srgb,var(--admin-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_8%,transparent)]"
                style={{
                  left: `${String(Math.max(0, segment.startPct))}%`,
                  width: `${String(Math.max(0, segment.widthPct))}%`,
                }}
                title={`Gap: ${formatDuration(segment.gapSeconds)}`}
              />
            );
          }
          const duration = segment.session.durationSeconds;
          return (
            <div
              key={segment.session.id}
              className="absolute inset-y-0 bg-[var(--admin-primary)]/75 transition-opacity hover:bg-[var(--admin-primary)]"
              style={{
                left: `${String(Math.max(0, segment.startPct))}%`,
                width: `${String(Math.max(0.5, segment.widthPct))}%`,
              }}
              title={`Session ${String(segment.session.index)}: ${formatTime(segment.session.joinTime)} – ${formatTime(segment.session.leaveTime)} (${formatDuration(duration)})`}
            />
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        {timeline.axisLabels.map((label, index) => (
          <span key={`${label}-${String(index)}`}>{label}</span>
        ))}
      </div>
      {showGaps ? (
        <div className="flex flex-wrap gap-4 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-[var(--admin-primary)]/75" />
            Present
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm border border-dashed border-[color-mix(in_srgb,var(--admin-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_8%,transparent)]" />
            Gap between sessions
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function AdminZoomInsightsParticipantDetailPage({
  meetingId,
  participantId,
}: {
  meetingId: string;
  participantId: string;
}) {
  const [detail, setDetail] = useState<ZoomParticipantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchZoomParticipantDetail(meetingId, participantId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load participant details.",
      );
    } finally {
      setLoading(false);
    }
  }, [meetingId, participantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMutate(
    action: "match" | "unlink" | "mark_guest",
    options?: { membershipId?: string; applyToOtherMeetings?: boolean },
  ) {
    setBusy(true);
    setActionError(null);
    try {
      await mutateZoomParticipantMatch(meetingId, participantId, {
        action,
        ...(options?.membershipId != null ? { membershipId: options.membershipId } : {}),
        ...(options?.applyToOtherMeetings != null
          ? { applyToOtherMeetings: options.applyToOtherMeetings }
          : {}),
      });
      setMatchOpen(false);
      await load();
    } catch (mutateError) {
      setActionError(
        mutateError instanceof ClientApiError
          ? mutateError.message
          : mutateError instanceof Error
            ? mutateError.message
            : "Unable to update participant match.",
      );
    } finally {
      setBusy(false);
    }
  }

  const meetingHref = `/admin/reports/zoom-insights/${meetingId}`;
  const participantName = detail?.displayName ?? detail?.zoomDisplayName ?? "Participant";
  const showGapEmphasis =
    detail != null && detail.sessionCount > 1 && detail.longestGapSeconds != null;

  if (loading && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <nav
          className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
          aria-label="Breadcrumb"
        >
          <Link href="/admin" className="hover:text-[var(--admin-primary)]">
            Admin
          </Link>
          <span>/</span>
          <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <span>/</span>
          <Link href="/admin/reports/zoom-insights" className="hover:text-[var(--admin-primary)]">
            Zoom Insights
          </Link>
          <span>/</span>
          <span className="font-medium text-[var(--admin-on-surface)]">Participant</span>
        </nav>
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <Link
          href={meetingHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to meeting
        </Link>
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-8 text-center">
          <AlertTriangle className="mb-4 h-8 w-8 text-[var(--admin-danger)]" aria-hidden="true" />
          <h1 className="mb-2 text-lg font-semibold text-[var(--admin-on-surface)]">
            Couldn&apos;t load this participant
          </h1>
          <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          <button type="button" className={primaryButtonClassName} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const pill = matchStatePill(detail.matchState);
  const coverageRatio = detail.coveragePercent != null ? detail.coveragePercent / 100 : null;
  const hasDiscrepancy =
    detail.lmsCrossCheck.discrepancySeconds != null &&
    detail.lmsCrossCheck.discrepancySeconds !== 0;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary)]">
          Admin
        </Link>
        <span>/</span>
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <span>/</span>
        <Link href="/admin/reports/zoom-insights" className="hover:text-[var(--admin-primary)]">
          Zoom Insights
        </Link>
        <span>/</span>
        <Link href={meetingHref} className="hover:text-[var(--admin-primary)]">
          {detail.meetingTopic ?? "Untitled meeting"}
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--admin-on-surface)]">{participantName}</span>
      </nav>

      <Link
        href={meetingHref}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--admin-primary)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to meeting
      </Link>

      {/* Identity header */}
      <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
              {participantInitials(detail.displayName, detail.email)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
                  {participantName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${pill.tone}`}
                >
                  {detail.matchState === "unmatched" ? (
                    <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                  ) : null}
                  {pill.label}
                </span>
              </div>
              <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                {detail.email ?? "No email provided"}
              </p>
              {detail.zoomDisplayName && detail.zoomDisplayName !== detail.displayName ? (
                <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  Zoom display name: {detail.zoomDisplayName}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {detail.membershipId && detail.matchState !== "matched" ? (
              <Link
                href={`/admin/members/${detail.membershipId}`}
                className={secondaryButtonClassName}
              >
                <User className="h-4 w-4" aria-hidden="true" />
                View Profile
              </Link>
            ) : null}
            {detail.matchState === "matched" && detail.membershipId ? (
              <>
                <Link
                  href={`/admin/members/${detail.membershipId}`}
                  className={secondaryButtonClassName}
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  Open member profile
                </Link>
                <button
                  type="button"
                  className={dangerOutlineButtonClassName}
                  disabled={busy}
                  onClick={() => void handleMutate("unlink")}
                >
                  <Unlink className="h-4 w-4" aria-hidden="true" />
                  Unlink from learner
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={busy}
                  onClick={() => {
                    setActionError(null);
                    setMatchOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Match to learner
                </button>
                {detail.matchState === "unmatched" ? (
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={busy}
                    onClick={() => void handleMutate("mark_guest")}
                  >
                    <UserX className="h-4 w-4" aria-hidden="true" />
                    Mark as guest
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {actionError ? (
        <div
          className="rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      {/* Summary band */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="col-span-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 lg:col-span-1">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">Total time</p>
          <p className="mt-2 text-[28px] font-semibold leading-none text-[var(--admin-on-surface)]">
            {formatDurationParts(detail.totalDurationSeconds)}
          </p>
          {coverageRatio != null ? (
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className="h-full rounded-full bg-[var(--admin-primary)]"
                  style={{
                    width: `${String(Math.min(100, Math.max(0, detail.coveragePercent ?? 0)))}%`,
                  }}
                />
              </div>
              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatPct(detail.coveragePercent)} meeting coverage
              </span>
            </div>
          ) : null}
        </div>
        <SummaryCard
          label="Sessions"
          value={String(detail.sessionCount)}
          {...(detail.rejoinCount > 0 && detail.sessionCount > 1
            ? {
                caption: `${String(detail.rejoinCount)} rejoin${detail.rejoinCount === 1 ? "" : "s"}`,
              }
            : detail.sessionCount === 1
              ? { caption: "Single continuous session" }
              : {})}
        />
        <SummaryCard label="First joined" value={formatDateTime(detail.firstJoinedAt)} mono />
        <SummaryCard label="Last left" value={formatDateTime(detail.lastLeftAt)} mono />
        <div
          className={[
            "rounded border bg-[var(--admin-surface)] p-4",
            showGapEmphasis
              ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))]"
              : "border-[var(--admin-border)]",
          ].join(" ")}
        >
          <p className="text-xs text-[var(--admin-on-surface-variant)]">Longest gap</p>
          <p
            className={[
              "mt-2 font-mono text-xl",
              showGapEmphasis ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]",
            ].join(" ")}
          >
            {showGapEmphasis ? formatDuration(detail.longestGapSeconds) : "—"}
          </p>
          {showGapEmphasis ? (
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              Between reconnect sessions
            </p>
          ) : null}
        </div>
      </div>

      {/* Presence timeline */}
      <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
          Meeting Presence Timeline
        </h2>
        <PresenceTimeline detail={detail} />
      </div>

      {/* 65/35 split */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        <div className="overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="border-b border-[var(--admin-border)] px-4 py-3">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Detailed Session Records
            </h2>
          </div>
          {detail.sessions.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
              No individual session records were returned for this participant.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="h-11 border-b border-[var(--admin-border)] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="w-12 px-4">#</th>
                    <th className="px-4">Joined</th>
                    <th className="px-4">Left</th>
                    <th className="px-4">Duration</th>
                    <th className="min-w-[140px] px-4">Share</th>
                    <th className="w-14 px-4 text-center">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sessions.map((session) => {
                    const Device = deviceIcon(session.deviceHint);
                    const share = session.shareOfMeeting ?? 0;
                    return (
                      <tr
                        key={session.id}
                        className="h-11 border-b border-[var(--admin-border)] last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                      >
                        <td className="px-4 font-mono text-[var(--admin-on-surface-variant)]">
                          {session.index}
                        </td>
                        <td className="px-4 font-mono text-[var(--admin-on-surface)]">
                          {formatDateTime(session.joinTime)}
                        </td>
                        <td className="px-4 font-mono text-[var(--admin-on-surface)]">
                          {formatDateTime(session.leaveTime)}
                        </td>
                        <td className="px-4 font-mono text-[var(--admin-on-surface-variant)]">
                          {formatDuration(session.durationSeconds)}
                        </td>
                        <td className="px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                              <div
                                className="h-full rounded-full bg-[var(--admin-primary)]/80"
                                style={{
                                  width: `${String(Math.min(100, Math.max(0, share * 100)))}%`,
                                }}
                              />
                            </div>
                            <span className="w-10 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                              {session.shareOfMeeting != null ? formatPct(share * 100) : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 text-center">
                          <Device
                            className="mx-auto h-4 w-4 text-[var(--admin-on-surface-variant)]"
                            aria-label={session.deviceHint}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h2 className="mb-3 text-base font-semibold text-[var(--admin-on-surface)]">
              Attendance history
            </h2>
            {detail.attendanceHistory.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No prior meeting attendance on record.
              </p>
            ) : (
              <ul className="space-y-3">
                {detail.attendanceHistory.map((entry) => (
                  <li key={entry.meetingId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span
                        className={[
                          "truncate text-sm",
                          entry.isCurrent
                            ? "font-medium text-[var(--admin-primary)]"
                            : "text-[var(--admin-on-surface)]",
                        ].join(" ")}
                      >
                        {entry.topic ?? "Untitled meeting"}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        {entry.coveragePercent != null ? formatPct(entry.coveragePercent) : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                      <div
                        className={[
                          "h-full rounded-full",
                          entry.isCurrent
                            ? "bg-[var(--admin-primary)]"
                            : "bg-[var(--admin-primary)]/50",
                        ].join(" ")}
                        style={{
                          width: `${String(Math.min(100, Math.max(0, entry.coveragePercent ?? 0)))}%`,
                        }}
                      />
                    </div>
                    {entry.startedAt ? (
                      <p className="mt-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        {formatDateTime(entry.startedAt)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                LMS cross-check
              </h2>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-[var(--admin-border)] pb-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Enrollment</dt>
                <dd className="font-mono text-[var(--admin-on-surface)]">
                  {enrollmentLabel(detail.lmsCrossCheck.enrollmentStatus)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--admin-border)] pb-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Match method</dt>
                <dd className="font-mono text-[var(--admin-on-surface)]">
                  {matchMethodLabel(detail.lmsCrossCheck.matchMethod)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--admin-border)] pb-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Zoom duration</dt>
                <dd className="font-mono text-[var(--admin-on-surface)]">
                  {formatDuration(detail.lmsCrossCheck.zoomDurationSeconds)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">LMS duration</dt>
                <dd className="font-mono text-[var(--admin-on-surface)]">
                  {detail.lmsCrossCheck.lmsDurationSeconds != null
                    ? formatDuration(detail.lmsCrossCheck.lmsDurationSeconds)
                    : "—"}
                </dd>
              </div>
            </dl>
            {hasDiscrepancy ? (
              <div className="mt-4 flex flex-col gap-2 rounded border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-3">
                <div className="flex items-center gap-2 text-[var(--admin-warning)]">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <span className="text-[13px] font-semibold uppercase tracking-wide">
                    Duration discrepancy
                  </span>
                </div>
                <p className="text-[13px] text-[var(--admin-on-surface)]">
                  Zoom and LMS differ by{" "}
                  <strong className="font-mono">
                    {formatDuration(Math.abs(detail.lmsCrossCheck.discrepancySeconds ?? 0))}
                  </strong>
                  .
                </p>
              </div>
            ) : detail.lmsCrossCheck.lmsDurationSeconds != null ? (
              <p className="mt-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-[13px] text-[var(--admin-on-surface-variant)]">
                Zoom and LMS durations align for this session.
              </p>
            ) : null}
            {detail.membershipId ? (
              <Link
                href={`/admin/members/${detail.membershipId}`}
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-primary)] hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                View member profile
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        Reported by Zoom. Session timings and durations come from Zoom participant records and may
        differ from LMS attendance logs.
        {detail.meetingExternalId ? (
          <>
            {" "}
            Meeting ID{" "}
            <span className="font-mono text-[var(--admin-on-surface)]">
              {detail.meetingExternalId}
            </span>
            .
          </>
        ) : null}
      </p>

      <MatchDrawer
        open={matchOpen}
        onClose={() => {
          setMatchOpen(false);
        }}
        participantEmail={detail.email}
        otherUnmatchedMeetingCount={detail.otherUnmatchedMeetingCount}
        busy={busy}
        onMatch={(membershipId, applyToOtherMeetings) => {
          void handleMutate("match", { membershipId, applyToOtherMeetings });
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  mono = false,
}: {
  label: string;
  value: string;
  caption?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <p className="text-xs text-[var(--admin-on-surface-variant)]">{label}</p>
      <p
        className={[
          "mt-2 text-xl font-semibold leading-snug text-[var(--admin-on-surface)]",
          mono ? "font-mono text-[13px] font-normal" : "",
        ].join(" ")}
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">{caption}</p>
      ) : null}
    </div>
  );
}
