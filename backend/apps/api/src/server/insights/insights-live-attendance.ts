import type { LiveDashboardAttendanceSnapshot } from "./insights.repository";

export const LIVE_ATTENDANCE_REPORT_HREF = "/admin/reports/live-class-attendance";
export const LIVE_ATTENDANCE_SESSIONS_HREF = "/admin/live-sessions";
export const LIVE_ATTENDANCE_GAP_ALERT_PCT = 30;

export type InsightLiveAttendanceQuery = {
  page: number;
  pageSize: number;
};

export type InsightLiveAttendanceDay = {
  period: string;
  label: string;
  attended: number;
  registered: number;
  gap: number;
  rate: number | null;
  sessionCount: number;
  weekday: number;
  isWeekend: boolean;
  gapAlert: boolean;
};

export type InsightLiveAttendanceBoard = {
  slug: "live-dashboard";
  title: string;
  generatedAt: string;
  days: number;
  windowLabel: string;
  caveat: string;
  empty: boolean;
  attendanceHref: string;
  sessionsHref: string;
  dashboardHref: string;
  sessionsBoardHref: string;
  nowHref: string;
  query: InsightLiveAttendanceQuery;
  summary: {
    attendanceRate: number;
    attended: number;
    rostered: number;
    noShowGap: number;
    noShowPct: number;
    avgDailyGap: number;
    bestDay: { period: string; label: string; rate: number } | null;
    worstDay: { period: string; label: string; rate: number } | null;
  };
  trend: {
    points: Array<{
      period: string;
      label: string;
      attended: number;
      registered: number;
      gap: number;
      rate: number | null;
      isWeekend: boolean;
    }>;
    maxValue: number;
    meanAttended: number;
    caption: string;
  };
  weekdayGaps: Array<{
    weekday: number;
    label: string;
    gapRate: number | null;
    sampleDays: number;
    highlight: boolean;
  }>;
  weekdayCaption: string;
  topGapSessions: Array<{
    id: string;
    title: string;
    rostered: number;
    attended: number;
    gap: number;
    href: string;
  }>;
  scatter: {
    points: Array<{
      id: string;
      title: string;
      rostered: number;
      rate: number;
      x: number;
      y: number;
      href: string;
    }>;
    caption: string;
  };
  daily: InsightLiveAttendanceDay[];
  totalDaily: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function sessionHref(batchId: string | null, sessionId: string): string {
  if (batchId) {
    return `/admin/reports/batches/${batchId}/live-sessions/${sessionId}`;
  }
  return LIVE_ATTENDANCE_SESSIONS_HREF;
}

function dayLabel(period: string): string {
  const date = new Date(`${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function weekdayLabel(weekday: number): string {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels[weekday - 1] ?? `D${weekday}`;
}

export function buildInsightLiveAttendance(
  snapshot: LiveDashboardAttendanceSnapshot,
  query: InsightLiveAttendanceQuery,
  generatedAt = new Date().toISOString(),
): InsightLiveAttendanceBoard {
  const enriched = snapshot.daily.map((day) => {
    const gap = Math.max(0, day.registered - day.attended);
    const rate = day.registered > 0 ? Math.round((day.attended / day.registered) * 100) : null;
    const gapPct = day.registered > 0 ? Math.round((gap / day.registered) * 100) : null;
    return {
      period: day.period,
      label: dayLabel(day.period),
      attended: day.attended,
      registered: day.registered,
      gap,
      rate,
      sessionCount: day.sessionCount,
      weekday: day.weekday,
      isWeekend: day.weekday >= 6,
      gapAlert: gapPct != null && gapPct > LIVE_ATTENDANCE_GAP_ALERT_PCT,
    };
  });

  const activeDays = enriched.filter((day) => day.registered > 0 || day.attended > 0);
  const totalAttended = enriched.reduce((sum, day) => sum + day.attended, 0);
  const totalRostered = enriched.reduce((sum, day) => sum + day.registered, 0);
  const noShowGap = Math.max(0, totalRostered - totalAttended);
  const attendanceRate = totalRostered > 0 ? Math.round((totalAttended / totalRostered) * 100) : 0;
  const noShowPct = totalRostered > 0 ? Math.round((noShowGap / totalRostered) * 100) : 0;
  const avgDailyGap =
    activeDays.length > 0
      ? Math.round(activeDays.reduce((sum, day) => sum + day.gap, 0) / activeDays.length)
      : 0;

  const ratedDays = activeDays.filter((day) => day.rate != null);
  let bestDay: InsightLiveAttendanceBoard["summary"]["bestDay"] = null;
  let worstDay: InsightLiveAttendanceBoard["summary"]["worstDay"] = null;
  for (const day of ratedDays) {
    if (day.rate == null) continue;
    if (!bestDay || day.rate > bestDay.rate) {
      bestDay = { period: day.period, label: day.label, rate: day.rate };
    }
    if (!worstDay || day.rate < worstDay.rate) {
      worstDay = { period: day.period, label: day.label, rate: day.rate };
    }
  }

  const maxValue = Math.max(1, ...enriched.map((day) => Math.max(day.attended, day.registered)));
  const meanAttended =
    activeDays.length > 0
      ? Math.round(
          (activeDays.reduce((sum, day) => sum + day.attended, 0) / activeDays.length) * 10,
        ) / 10
      : 0;

  const midpoint = Math.floor(activeDays.length / 2);
  const firstHalf = activeDays.slice(0, midpoint);
  const secondHalf = activeDays.slice(midpoint);
  const avgGap = (days: typeof activeDays) =>
    days.length === 0 ? 0 : Math.round(days.reduce((sum, day) => sum + day.gap, 0) / days.length);
  const firstGap = avgGap(firstHalf);
  const secondGap = avgGap(secondHalf);
  let trendCaption = "Not enough active days to describe a gap trend yet.";
  if (firstHalf.length > 0 && secondHalf.length > 0) {
    if (secondGap > firstGap) {
      trendCaption = `The gap widened from ${firstGap} to ${secondGap} learners across the window.`;
    } else if (secondGap < firstGap) {
      trendCaption = `The gap narrowed from ${firstGap} to ${secondGap} learners across the window.`;
    } else {
      trendCaption = `The average no-show gap held near ${firstGap} learners across the window.`;
    }
  }

  const weekdayBuckets = Array.from({ length: 7 }, (_, index) => {
    const weekday = index + 1;
    const days = activeDays.filter((day) => day.weekday === weekday);
    const registered = days.reduce((sum, day) => sum + day.registered, 0);
    const attended = days.reduce((sum, day) => sum + day.attended, 0);
    const gapRate =
      registered > 0 ? Math.round(((registered - attended) / registered) * 100) : null;
    return {
      weekday,
      label: weekdayLabel(weekday),
      gapRate,
      sampleDays: days.length,
      highlight: false,
    };
  });
  const maxWeekdayGap = Math.max(0, ...weekdayBuckets.map((bucket) => bucket.gapRate ?? -1));
  for (const bucket of weekdayBuckets) {
    bucket.highlight =
      bucket.gapRate != null && bucket.gapRate === maxWeekdayGap && maxWeekdayGap > 0;
  }
  const highlightLabel = weekdayBuckets.find((bucket) => bucket.highlight)?.label ?? null;

  const maxRoster = Math.max(
    1,
    ...snapshot.scatterSessions.map((session) => session.rosteredCount),
  );
  const scatterPoints = snapshot.scatterSessions.map((session) => ({
    id: session.id,
    title: session.title,
    rostered: session.rosteredCount,
    rate: session.attendanceRate,
    x: Math.round((session.rosteredCount / maxRoster) * 1000) / 10,
    y: Math.max(0, Math.min(100, 100 - session.attendanceRate)),
    href: sessionHref(session.batchId, session.id),
  }));
  const largeLow =
    scatterPoints.filter((point) => point.rostered >= maxRoster * 0.6 && point.rate < 60).length >
    0;

  const descending = [...enriched].reverse();
  const pageSize = Math.max(1, Math.min(30, query.pageSize));
  const pageCount = Math.max(1, Math.ceil(descending.length / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * pageSize;

  return {
    slug: "live-dashboard",
    title: "Attendance",
    generatedAt,
    days: snapshot.days,
    windowLabel: `Last ${snapshot.days} days`,
    caveat:
      "Registered / rostered counts learners who registered plus learners rostered in by batch membership. Attendance rate is attended divided by that figure.",
    empty: totalRostered <= 0 && totalAttended <= 0,
    attendanceHref: LIVE_ATTENDANCE_REPORT_HREF,
    sessionsHref: LIVE_ATTENDANCE_SESSIONS_HREF,
    dashboardHref: "/admin/insights/live-dashboard",
    sessionsBoardHref: "/admin/insights/live-dashboard/sessions",
    nowHref: "/admin/insights/live-dashboard/now",
    query: { page, pageSize },
    summary: {
      attendanceRate,
      attended: totalAttended,
      rostered: totalRostered,
      noShowGap,
      noShowPct,
      avgDailyGap,
      bestDay,
      worstDay,
    },
    trend: {
      points: enriched.map((day) => ({
        period: day.period,
        label: day.label,
        attended: day.attended,
        registered: day.registered,
        gap: day.gap,
        rate: day.rate,
        isWeekend: day.isWeekend,
      })),
      maxValue,
      meanAttended,
      caption: trendCaption,
    },
    weekdayGaps: weekdayBuckets,
    weekdayCaption: highlightLabel
      ? `${highlightLabel}s see the highest average no-show rate.`
      : "No weekday pattern yet in this window.",
    topGapSessions: snapshot.topGapSessions.map((session) => ({
      id: session.id,
      title: session.title,
      rostered: session.rosteredCount,
      attended: session.attendedCount,
      gap: Math.max(0, session.rosteredCount - session.attendedCount),
      href: sessionHref(session.batchId, session.id),
    })),
    scatter: {
      points: scatterPoints,
      caption: largeLow
        ? "Larger sessions skew lower on turnout in this window."
        : "Session turnout plotted against roster size.",
    },
    daily: descending.slice(start, start + pageSize),
    totalDaily: descending.length,
    page,
    pageSize,
    pageCount,
  };
}
