"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Headset,
  MessageSquare,
  Package,
  ShoppingBag,
  Star,
  Users,
} from "lucide-react";

import type { AdminOverviewResponse } from "@atlas/contracts/admin/admin-overview.contract";

import { ADMIN_MODERATION_CASES_PATH } from "../../moderation/moderation-paths";

type OverviewData = AdminOverviewResponse["data"];
type TabKey = "enrollments" | "learners" | "orders";

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toLocaleString()} ${currency}`;
  }
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function EnrollmentChart({ points }: { points: OverviewData["monthlyEnrollments"] }) {
  const width = 640;
  const height = 220;
  const padX = 28;
  const padY = 24;

  const { paidPath, freePath, maxY } = useMemo(() => {
    const max = Math.max(1, ...points.flatMap((p) => [p.paid, p.free]));
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;
    const xAt = (index: number) =>
      padX + (points.length <= 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
    const yAt = (value: number) => padY + plotH - (value / max) * plotH;

    const toPath = (key: "paid" | "free") =>
      points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(point[key])}`)
        .join(" ");

    return { paidPath: toPath("paid"), freePath: toPath("free"), maxY: max };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-[var(--admin-on-surface-variant)]">
        No enrollment activity in the selected range.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[220px] w-full min-w-[320px]"
        role="img"
        aria-label={`Monthly enrollments chart, max ${maxY}`}
      >
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="var(--admin-border)"
          strokeWidth="1"
        />
        <path
          d={paidPath}
          fill="none"
          stroke="var(--admin-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d={freePath}
          fill="none"
          stroke="var(--admin-warning)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {points.map((point, index) => {
          const x =
            padX +
            (points.length <= 1
              ? (width - padX * 2) / 2
              : (index / (points.length - 1)) * (width - padX * 2));
          return (
            <text
              key={point.month}
              x={x}
              y={height - 6}
              textAnchor="middle"
              className="fill-[var(--admin-on-surface-variant)] text-[10px]"
            >
              {monthLabel(point.month)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function KpiTile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 transition-colors hover:border-[var(--admin-primary)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-[var(--admin-on-surface)]">{value}</p>
    </Link>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-[var(--admin-on-surface)]">{value}</p>
    </div>
  );
}

function TaskRow({
  icon: Icon,
  label,
  caption,
  href,
  count,
}: {
  icon: typeof Star;
  label: string;
  caption: string;
  href: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-3 transition-colors hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
    >
      <span className="rounded-lg bg-[var(--admin-surface-high)] p-2 text-[var(--admin-on-surface-variant)]">
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
            {label}
          </span>
          {count > 0 ? (
            <span className="rounded-full bg-[var(--admin-warning)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--admin-warning)]">
              {count}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
          {caption}
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
    </Link>
  );
}

export function AdminCommerceOverview({
  welcomeName,
  data,
}: {
  welcomeName: string | null;
  data: OverviewData;
}) {
  const [tab, setTab] = useState<TabKey>("enrollments");
  const currency = data.currency || "INR";
  const pendingTotal =
    data.pendingTasks.publishReviews +
    data.pendingTasks.moderationCases +
    data.pendingTasks.deletionRequests +
    data.pendingTasks.courseReviews;

  const firstEnrollmentMonth = data.monthlyEnrollments[0];
  const lastEnrollmentMonth = data.monthlyEnrollments.at(-1);
  const rangeLabel =
    firstEnrollmentMonth && lastEnrollmentMonth
      ? `${monthLabel(firstEnrollmentMonth.month)} – ${monthLabel(lastEnrollmentMonth.month)}`
      : "Last 12 months";

  const secondaryStats =
    tab === "enrollments"
      ? [
          {
            label: "Last 12 months value",
            value: formatMoney(data.enrollmentBreakdown.last12MonthsValueCents, currency),
          },
          {
            label: "Paid enrollments value",
            value: formatMoney(data.enrollmentBreakdown.paidValueCents, currency),
          },
          {
            label: "Free enrollments",
            value: formatCount(data.enrollmentBreakdown.freeEnrollmentCount),
          },
        ]
      : tab === "learners"
        ? [
            {
              label: "Active learners",
              value: formatCount(data.kpis.learnerCount),
            },
            {
              label: "Paid enrollments",
              value: formatCount(data.enrollmentBreakdown.paidEnrollmentCount),
            },
            {
              label: "Free enrollments",
              value: formatCount(data.enrollmentBreakdown.freeEnrollmentCount),
            },
          ]
        : [
            {
              label: "Total enrollments",
              value: formatCount(data.kpis.enrollmentCount),
            },
            {
              label: "Paid orders",
              value: formatCount(data.enrollmentBreakdown.paidEnrollmentCount),
            },
            {
              label: "Free orders",
              value: formatCount(data.enrollmentBreakdown.freeEnrollmentCount),
            },
          ];

  const tabs: Array<{ key: TabKey; label: string; icon: typeof ShoppingBag }> = [
    { key: "enrollments", label: "Enrollments", icon: ShoppingBag },
    { key: "learners", label: "Learners", icon: Users },
    { key: "orders", label: "Orders", icon: Package },
  ];

  return (
    <section aria-label="Academy commerce overview" className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-[var(--admin-on-surface)]">
          {welcomeName ? `Welcome, ${welcomeName}` : "Academy overview"}
        </h2>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Enrollment value, catalogue, and operational queues. Value figures estimate course price ×
          enrollments until a payment ledger is available.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile
          label="Enrollment value"
          value={formatMoney(data.kpis.enrollmentValueCents, currency)}
          href="/studio/courses"
        />
        <KpiTile
          label="Courses"
          value={formatCount(data.kpis.productCount)}
          href="/studio/courses"
        />
        <KpiTile
          label="Learners"
          value={formatCount(data.kpis.learnerCount)}
          href="/admin/members"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div
            role="tablist"
            aria-label="Overview sections"
            className="inline-flex rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1"
          >
            {tabs.map((item) => {
              const active = tab === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(item.key);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {secondaryStats.map((stat) => (
              <StatChip key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
                  Monthly enrollments
                </h3>
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Total for {rangeLabel}
                </p>
              </div>
              <span className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                Last 12 months
              </span>
            </div>
            <EnrollmentChart points={data.monthlyEnrollments} />
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--admin-on-surface-variant)]">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--admin-primary)]" />
                Paid enrollments
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--admin-warning)]" />
                Free enrollments
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">Top courses</h3>
              <Link
                href="/studio/courses"
                prefetch={false}
                className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
              >
                View all
              </Link>
            </div>
            {data.topProducts.length > 0 ? (
              <ul className="divide-y divide-[var(--admin-border)]">
                {data.topProducts.map((product, index) => (
                  <li key={product.id}>
                    <Link
                      href={product.href}
                      prefetch={false}
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-[var(--admin-surface-high)]/50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--admin-surface-high)] text-xs font-bold text-[var(--admin-on-surface-variant)]">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                          {product.title}
                        </span>
                        <span className="block text-xs text-[var(--admin-on-surface-variant)]">
                          {formatCount(product.studentCount)} learner
                          {product.studentCount === 1 ? "" : "s"}
                          {product.priceCents != null && product.priceCents > 0
                            ? ` · ${formatMoney(product.priceCents, product.currency ?? currency)}`
                            : " · Free"}
                        </span>
                      </span>
                      <BookOpen
                        className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-2 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                  No results found
                </p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Publish courses and enroll learners to see rankings here.
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[var(--admin-on-surface)]">
                Scheduled events
              </h3>
              <span className="rounded-full bg-[var(--admin-surface-high)] px-2.5 py-0.5 text-xs font-bold text-[var(--admin-on-surface-variant)]">
                {data.scheduledEvents.length}
              </span>
            </div>
            {data.scheduledEvents.length > 0 ? (
              <ul className="space-y-2">
                {data.scheduledEvents.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)]/40 px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      {event.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {new Date(event.startsAt).toLocaleDateString()} –{" "}
                      {new Date(event.endsAt).toLocaleDateString()}
                      <span className="ml-2 uppercase tracking-wide">{event.status}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CalendarDays
                  className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                  No scheduled events
                </p>
                <Link
                  href="/admin/gamification"
                  prefetch={false}
                  className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                >
                  Manage seasonal events
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[var(--admin-on-surface)]">Pending tasks</h3>
              <span className="rounded-full bg-[var(--admin-surface-high)] px-2.5 py-0.5 text-xs font-bold text-[var(--admin-on-surface-variant)]">
                {pendingTotal}
              </span>
            </div>
            <div className="space-y-2">
              <TaskRow
                icon={ClipboardCheck}
                label="Publish reviews"
                caption={
                  data.pendingTasks.publishReviews > 0
                    ? `${formatCount(data.pendingTasks.publishReviews)} course(s) awaiting review`
                    : "No pending task"
                }
                href="/admin/review"
                count={data.pendingTasks.publishReviews}
              />
              <TaskRow
                icon={Headset}
                label="Moderation cases"
                caption={
                  data.pendingTasks.moderationCases > 0
                    ? `${formatCount(data.pendingTasks.moderationCases)} open case(s)`
                    : "No pending task"
                }
                href={ADMIN_MODERATION_CASES_PATH}
                count={data.pendingTasks.moderationCases}
              />
              <TaskRow
                icon={MessageSquare}
                label="School-access removal"
                caption={
                  data.pendingTasks.deletionRequests > 0
                    ? `${formatCount(data.pendingTasks.deletionRequests)} in progress`
                    : "No pending task"
                }
                href="/admin/deletion-requests"
                count={data.pendingTasks.deletionRequests}
              />
              <TaskRow
                icon={Star}
                label="Ratings & reviews"
                caption={
                  data.pendingTasks.courseReviews > 0
                    ? `${formatCount(data.pendingTasks.courseReviews)} in the last 30 days`
                    : "No pending task"
                }
                href="/studio/courses"
                count={data.pendingTasks.courseReviews}
              />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
