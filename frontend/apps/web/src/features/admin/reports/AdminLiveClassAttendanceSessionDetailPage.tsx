"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { ghostButtonClassName } from "../../analytics/analytics-admin-shared";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  type LiveSessionAttendeesPayload,
  type LiveSessionDetail,
} from "./admin-live-class-attendance-roster-api";
import {
  MessageDrawer,
  PageSkeleton,
  secondaryButtonClassName,
} from "./admin-live-class-attendance-session-shared";
import {
  SessionAttendees,
  SessionHeader,
  SessionKpis,
  SessionStatusPanel,
} from "./admin-live-class-attendance-session-sections";
import { useLiveClassAttendanceSession } from "./use-live-class-attendance-session";

export function AdminLiveClassAttendanceSessionDetailPage(props: {
  sessionId: string;
  /** The session, loaded by the server; the first browser load is skipped when present. */
  initialDetail?: ReportInitialData<LiveSessionDetail> | null;
  /** The first page of attendees, loaded by the server alongside the session. */
  initialAttendees?: ReportInitialData<LiveSessionAttendeesPayload> | null;
}) {
  const view = useLiveClassAttendanceSession(props);
  const {
    actionError,
    cancelled,
    channelEmail,
    channelInApp,
    detail,
    error,
    handleSendMessage,
    loading,
    messageAudience,
    messageBody,
    messageBusy,
    messageCount,
    messageError,
    messageOpen,
    messageSubject,
    retryAll,
    scheduled,
    setActionError,
    setChannelEmail,
    setChannelInApp,
    setError,
    setMessageBody,
    setMessageError,
    setMessageOpen,
    setMessageSubject,
  } = view;

  if (loading && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <PageSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-[var(--admin-danger)]">
                Couldn&apos;t load session attendance.
              </p>
              <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => void retryAll()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
        <div className="opacity-40">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const primaryMessageDisabled =
    cancelled || (scheduled ? detail.registeredCount === 0 : detail.absentCount === 0);
  const primaryMessageLabel = scheduled
    ? "Message registrants"
    : `Message absentees (${detail.absentCount})`;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary-strong)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary-strong)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href="/admin/reports/live-class-attendance"
          className="hover:text-[var(--admin-primary-strong)]"
        >
          Live Class Attendance
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-on-surface)]">{detail.title}</span>
      </nav>

      <Link
        href="/admin/reports/live-class-attendance"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        All sessions
      </Link>

      <SessionHeader view={{ ...view, detail, primaryMessageDisabled, primaryMessageLabel }} />

      {actionError || error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{actionError ?? error}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                setActionError(null);
                setError(null);
              }}
            >
              Dismiss
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => void retryAll()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <SessionKpis view={{ ...view, detail }} />

      <SessionStatusPanel view={{ ...view, detail }} />

      <SessionAttendees view={{ ...view, detail }} />

      <MessageDrawer
        open={messageOpen}
        audience={messageAudience}
        count={messageCount}
        sessionTitle={detail.title}
        subject={messageSubject}
        body={messageBody}
        channelEmail={channelEmail}
        channelInApp={channelInApp}
        busy={messageBusy}
        error={messageError}
        onSubjectChange={setMessageSubject}
        onBodyChange={setMessageBody}
        onChannelEmailChange={setChannelEmail}
        onChannelInAppChange={setChannelInApp}
        onClose={() => {
          if (!messageBusy) {
            setMessageOpen(false);
            setMessageError(null);
          }
        }}
        onSend={() => {
          void handleSendMessage();
        }}
        onTestSend={() => {
          void handleSendMessage({ sendTestToSelf: true });
        }}
      />
    </div>
  );
}
