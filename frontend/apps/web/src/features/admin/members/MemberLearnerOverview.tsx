import Link from "next/link";
import { BookOpen, ClipboardCheck, CreditCard, PlayCircle } from "lucide-react";
import type { z } from "zod";
import type { memberOverviewResponseSchema } from "@atlas/contracts/members/member-overview.schemas";
import { cardClassName, cardHeaderClassName } from "./member-detail-shared";

type Overview = z.infer<typeof memberOverviewResponseSchema>["data"];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      amountCents / 100,
    );
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  cancelled: "Cancelled",
  expired: "Expired",
  completed: "Completed",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const ACTIVITY: Record<
  Overview["activity"][number]["kind"],
  { label: string; Icon: typeof BookOpen }
> = {
  enrolled: { label: "Enrolled in", Icon: BookOpen },
  lesson_completed: { label: "Completed lesson", Icon: PlayCircle },
  assessment_submitted: { label: "Submitted", Icon: ClipboardCheck },
  payment: { label: "Paid for", Icon: CreditCard },
};

function plainStatus(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const thClassName =
  "px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";
const tdClassName = "px-4 py-3 align-top text-sm text-[var(--admin-on-surface)]";
const mutedClassName = "text-sm text-[var(--admin-on-surface-variant)]";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <dt className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">{label}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums text-[var(--admin-on-surface)]">
        {value}
      </dd>
    </div>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cardClassName}>
      <div className={cardHeaderClassName}>
        <h2 id={id} className="text-base font-semibold text-[var(--admin-on-surface)]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/**
 * The learner side of a member (QA review 2 H22): what they are studying, how
 * they score, what they paid and what they did recently.
 */
export function MemberLearnerOverview({ overview }: { overview: Overview }) {
  const { summary } = overview;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Courses" value={String(summary.coursesEnrolled)} />
        <Stat label="Completed" value={String(summary.coursesCompleted)} />
        <Stat label="Assessments taken" value={String(summary.assessmentsTaken)} />
        <Stat
          label="Average score"
          value={summary.averageScore == null ? "—" : `${String(summary.averageScore)}%`}
        />
      </dl>

      <Section title="Courses" id="member-courses-heading">
        {overview.courses.length === 0 ? (
          <p className={`p-5 ${mutedClassName}`}>Not enrolled in any course yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <tr>
                  <th scope="col" className={thClassName}>
                    Course
                  </th>
                  <th scope="col" className={thClassName}>
                    Progress
                  </th>
                  <th scope="col" className={thClassName}>
                    Enrolled
                  </th>
                  <th scope="col" className={thClassName}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {overview.courses.map((course) => (
                  <tr key={course.enrollmentId}>
                    <td className={tdClassName}>
                      <Link
                        href={`/studio/courses/${course.courseId}`}
                        className="font-medium hover:underline"
                      >
                        {course.title}
                      </Link>
                    </td>
                    <td className={tdClassName}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
                          role="progressbar"
                          aria-valuenow={course.progressPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${course.title} progress`}
                        >
                          <div
                            className="h-full rounded-full bg-[var(--admin-primary)]"
                            style={{ width: `${String(course.progressPct)}%` }}
                          />
                        </div>
                        <span className="tabular-nums">{course.progressPct}%</span>
                      </div>
                      <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                        {course.completedLessons} of {course.totalLessons} lessons
                      </span>
                    </td>
                    <td className={`${tdClassName} whitespace-nowrap`}>
                      {formatDate(course.enrolledAt)}
                    </td>
                    <td className={tdClassName}>
                      {course.completedAt
                        ? `Completed ${formatDate(course.completedAt)}`
                        : plainStatus(ENROLLMENT_STATUS_LABELS, course.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Assessment results" id="member-assessments-heading">
        {overview.assessments.length === 0 ? (
          <p className={`p-5 ${mutedClassName}`}>No assessments submitted yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {overview.assessments.map((attempt) => (
              <li
                key={attempt.attemptId}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/attempts/${attempt.attemptId}/result`}
                    className="text-sm font-medium text-[var(--admin-on-surface)] hover:underline"
                  >
                    {attempt.assessmentTitle}
                  </Link>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    {attempt.status === "SUBMITTED" ? "Waiting for grading" : "Graded"} ·{" "}
                    {formatDate(attempt.submittedAt)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--admin-on-surface)]">
                  {attempt.scorePercent == null ? "—" : `${String(attempt.scorePercent)}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {overview.payments ? (
        <Section title="Payments" id="member-payments-heading">
          {overview.payments.length === 0 ? (
            <p className={`p-5 ${mutedClassName}`}>No payments yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {overview.payments.map((payment) => (
                <li
                  key={payment.orderId}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      {payment.description ?? "Payment"}
                    </p>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {plainStatus(PAYMENT_STATUS_LABELS, payment.status)} ·{" "}
                      {formatDate(payment.paidAt ?? payment.createdAt)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[var(--admin-on-surface)]">
                    {formatMoney(payment.amountCents, payment.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      <Section title="Recent activity" id="member-activity-heading">
        {overview.activity.length === 0 ? (
          <p className={`p-5 ${mutedClassName}`}>No activity yet.</p>
        ) : (
          <ol className="space-y-0 px-5 py-3">
            {overview.activity.map((event, index) => {
              const { label, Icon } = ACTIVITY[event.kind];
              return (
                <li
                  key={`${event.kind}-${event.occurredAt}-${String(index)}`}
                  className="flex items-start gap-3 py-2"
                >
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <p className="min-w-0 flex-1 text-sm text-[var(--admin-on-surface)]">
                    {label} <span className="font-medium">{event.title}</span>
                  </p>
                  <time
                    dateTime={event.occurredAt}
                    className="shrink-0 text-xs text-[var(--admin-on-surface-variant)]"
                  >
                    {formatDate(event.occurredAt)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </>
  );
}
