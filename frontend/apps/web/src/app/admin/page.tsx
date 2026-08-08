import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardCheck,
  Database,
  Download,
  Flag,
  GraduationCap,
  KeyRound,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AuditListResponse } from "@atlas/contracts/audit/audit";
import type { AdminOverviewResponse } from "@atlas/contracts/admin/admin-overview.dto";
import type {
  MemberStatsResponse,
  MembersListResponse,
} from "@atlas/contracts/membership/schemas/admin-members";
import type { RoleListResponse } from "@atlas/domain-access/schemas/access-admin";
import type { workflowListResponseSchema } from "@atlas/contracts/workflows/workflow-schemas";
import type { ProvisioningJobListResponseSchema } from "@atlas/domain-tenancy/schemas/platform-tenants";
import type { z } from "zod";

import { AdminPageGate } from "../../components/patterns/AdminPageGate";
import { AdminCommerceOverview } from "../../features/admin/overview/AdminCommerceOverview";
import { ADMIN_MODERATION_CASES_PATH } from "../../features/moderation/moderation-paths";
import { ServerApiError, serverApi } from "../../lib/server-api";

type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;
type ProvisioningJobListResponse = z.infer<typeof ProvisioningJobListResponseSchema>;

type ModerationCaseListResponse = {
  data: { items: Array<{ id: string; status: string }> };
};

type StudioCourseListResponse = {
  data: {
    items: Array<{ id: string; status: string }>;
    pageInfo: { hasNextPage: boolean };
  };
};

type ContentStatusSummary = {
  published: number;
  draft: number;
  review: number;
  archived: number;
};

function summarizeContentStatus(
  courses: StudioCourseListResponse["data"]["items"],
): ContentStatusSummary {
  const summary: ContentStatusSummary = { published: 0, draft: 0, review: 0, archived: 0 };
  for (const course of courses) {
    if (course.status === "PUBLISHED") summary.published += 1;
    if (course.status === "DRAFT") summary.draft += 1;
    if (course.status === "REVIEW") summary.review += 1;
    if (course.status === "ARCHIVED") summary.archived += 1;
  }
  return summary;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

/**
 * Soft-fail helper: one flaky secondary call must not blank the dashboard.
 * Auth failures still propagate so the page can render the denied gate.
 */
async function softGet<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      throw error;
    }
    return null;
  }
}

/**
 * Prefer the lightweight stats endpoint. Fall back to totalCount from a tiny
 * members list when stats is unavailable — avoids the old dual heavy list race
 * that produced "4 of 0 members" plus a transient error banner.
 */
async function loadMemberActivation(): Promise<{
  memberCount: number;
  activeLearnerCount: number;
  ok: boolean;
}> {
  const stats = await softGet(serverApi.get<MemberStatsResponse>("/api/v1/members/stats"));
  if (stats) {
    return {
      memberCount: stats.data.totalMembers,
      activeLearnerCount: stats.data.activeMembers,
      ok: true,
    };
  }

  const [allMembers, activeMembers] = await Promise.all([
    softGet(serverApi.get<MembersListResponse>("/api/v1/members?limit=1")),
    softGet(serverApi.get<MembersListResponse>("/api/v1/members?status=ACTIVE&limit=1")),
  ]);

  if (!allMembers && !activeMembers) {
    return { memberCount: 0, activeLearnerCount: 0, ok: false };
  }

  const memberCount = allMembers?.data.totalCount ?? activeMembers?.data.totalCount ?? 0;
  const activeLearnerCount = activeMembers?.data.totalCount ?? 0;

  return {
    memberCount: Math.max(memberCount, activeLearnerCount),
    activeLearnerCount,
    ok: true,
  };
}

type MetricTone = "primary" | "success" | "warning" | "neutral";

const TONE_ICON_CLASS: Record<MetricTone, string> = {
  primary: "bg-[var(--admin-primary)]/12 text-[var(--admin-primary)]",
  success: "bg-[var(--admin-success)]/15 text-[var(--admin-success)]",
  warning: "bg-[var(--admin-warning)]/15 text-[var(--admin-warning)]",
  neutral: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
};

const TONE_HOVER_BORDER: Record<MetricTone, string> = {
  primary: "hover:border-[var(--admin-primary)]",
  success: "hover:border-[var(--admin-success)]",
  warning: "hover:border-[var(--admin-warning)]",
  neutral: "hover:border-[var(--admin-on-surface-variant)]",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
  href: string;
  tone: MetricTone;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 transition-all hover:-translate-y-0.5 ${TONE_HOVER_BORDER[tone]}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className={`rounded-lg p-2 ${TONE_ICON_CLASS[tone]}`}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <ArrowUpRight
          className="h-4 w-4 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-[var(--admin-on-surface)]">{value}</p>
      <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
    </Link>
  );
}

function QuickLink({
  icon: Icon,
  label,
  caption,
  href,
}: {
  icon: LucideIcon;
  label: string;
  caption: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-colors hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
    >
      <span className="rounded-lg bg-[var(--admin-surface-high)] p-2 text-[var(--admin-on-surface-variant)] transition-colors group-hover:bg-[var(--admin-primary)]/15 group-hover:text-[var(--admin-primary)]">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]">
          {label}
        </span>
        <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
          {caption}
        </span>
      </span>
    </Link>
  );
}

function ContentPipeline({ summary }: { summary: ContentStatusSummary }) {
  const segments = [
    { key: "published", label: "Published", value: summary.published, color: "var(--admin-success)" },
    { key: "review", label: "In review", value: summary.review, color: "var(--admin-warning)" },
    { key: "draft", label: "Draft", value: summary.draft, color: "var(--admin-primary)" },
    { key: "archived", label: "Archived", value: summary.archived, color: "var(--admin-outline)" },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="mt-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--admin-on-surface-variant)]">Content pipeline</p>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">{total} course(s)</p>
      </div>
      {total > 0 ? (
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          {segments.map((segment) =>
            segment.value > 0 ? (
              <div
                key={segment.key}
                style={{
                  width: `${((segment.value / total) * 100).toFixed(3)}%`,
                  backgroundColor: segment.color,
                }}
                title={`${segment.label}: ${segment.value.toLocaleString()}`}
              />
            ) : null,
          )}
        </div>
      ) : (
        <div className="h-2.5 w-full rounded-full bg-[var(--admin-surface-high)]" />
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
            {segment.label}
            <span className="font-semibold text-[var(--admin-on-surface)]">{segment.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  let memberCount = 0;
  let activeLearnerCount = 0;
  let membersOk = false;
  let roleCount = 0;
  let auditAvailable = false;
  let recentAudit: AuditListResponse["data"] = [];
  let pendingReviews = 0;
  let entitlementCount = 0;
  let provisioningJobCount = 0;
  let openModerationCases = 0;
  let contentStatus: ContentStatusSummary | null = null;
  let loadError: string | null = null;
  let commerceOverview: AdminOverviewResponse["data"] | null = null;
  let welcomeName: string | null = null;

  try {
    const [
      activation,
      roles,
      audit,
      reviews,
      entitlements,
      provisioning,
      moderation,
      courses,
      overview,
      me,
    ] = await Promise.all([
      loadMemberActivation(),
      softGet(serverApi.get<RoleListResponse>("/api/v1/roles?limit=100")),
      softGet(serverApi.get<AuditListResponse>("/api/v1/audit?limit=6")),
      softGet(
        serverApi
          .get<WorkflowListResponse>("/api/v1/workflows?status=pending&limit=25")
          .then((response) => response.data.length),
      ),
      softGet(
        serverApi
          .get<{ data: Array<{ key: string }> }>("/api/v1/entitlements")
          .then((response) => response.data.length),
      ),
      softGet(
        serverApi
          .get<ProvisioningJobListResponse>("/api/v1/provisioning/jobs")
          .then((response) => response.data),
      ),
      softGet(
        serverApi
          .get<ModerationCaseListResponse>("/api/v1/moderation/cases?status=OPEN&limit=25")
          .then((response) => response.data.items.length),
      ),
      softGet(serverApi.get<StudioCourseListResponse>("/api/v1/courses?view=studio&limit=100")),
      softGet(serverApi.get<AdminOverviewResponse>("/api/v1/admin/overview")),
      softGet(
        serverApi.get<{
          data: {
            identity: { email: string | null };
            membership: { id: string };
          };
        }>("/api/v1/me"),
      ),
    ]);

    memberCount = activation.memberCount;
    activeLearnerCount = activation.activeLearnerCount;
    membersOk = activation.ok;

    roleCount = roles ? roles.data.items.length : 0;
    auditAvailable = audit != null;
    recentAudit = audit?.data ?? [];
    pendingReviews = reviews ?? 0;
    entitlementCount = entitlements ?? 0;
    provisioningJobCount = provisioning?.length ?? 0;
    openModerationCases = moderation ?? 0;
    commerceOverview = overview?.data ?? null;
    welcomeName = me?.data.identity.email ?? null;

    if (courses) {
      contentStatus = summarizeContentStatus(courses.data.items);
      if (courses.data.pageInfo.hasNextPage) {
        contentStatus.published = Math.max(contentStatus.published, 1);
      }
    }

    // Only surface a banner when membership totals are completely unavailable.
    // Soft failures on roles/audit/etc. already degrade inline ("n/a", 0) —
    // a refreshable red alert for those was the false-positive users hit.
    if (!membersOk) {
      loadError = "Member activation stats could not be loaded. Refresh to try again.";
    }
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T1"
          state="denied"
          title="Admin Dashboard"
          deniedMessage="You do not have permission to view the admin dashboard."
        />
      );
    }
    loadError = "Some admin summary data could not be loaded.";
  }

  const activationRate =
    memberCount > 0 ? Math.min(100, Math.round((activeLearnerCount / memberCount) * 100)) : 0;

  return (
    <AdminPageGate screenId="T1" state="ready" title="Admin Dashboard">
      <div className="space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--admin-on-surface)]">Overview</h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Operational health and setup shortcuts for tenant administration.
          </p>
        </div>

        {loadError ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--admin-danger)]/40 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
          >
            {loadError}
          </p>
        ) : null}

        {commerceOverview ? (
          <AdminCommerceOverview welcomeName={welcomeName} data={commerceOverview} />
        ) : null}

        <section className="admin-glass rounded-2xl p-6 shadow-xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                Learner activation
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-4">
                <span className="text-5xl font-extrabold leading-none tracking-tight text-[var(--admin-primary)] md:text-6xl">
                  {activationRate}%
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-success)]/15 px-3 py-1 text-sm font-semibold text-[var(--admin-success)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" />
                  {formatCount(activeLearnerCount)} of {formatCount(memberCount)} members active
                </span>
              </div>
              <p className="mt-3 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Share of the member roster currently active in the academy.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/members"
                prefetch={false}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90"
              >
                <Users className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Manage members
              </Link>
              <Link
                href="/admin/audit"
                prefetch={false}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)]"
              >
                <ScrollText className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Audit log
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <div
              className="h-3 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
              role="progressbar"
              aria-valuenow={activationRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Learner activation rate"
            >
              <div
                className="h-full rounded-full bg-[var(--admin-primary)] transition-[width]"
                style={{ width: `${activationRate.toString()}%` }}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--admin-outline)]/40 pt-6">
            {contentStatus ? (
              <ContentPipeline summary={contentStatus} />
            ) : (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Course catalogue summary is unavailable for your current access.
              </p>
            )}
          </div>
        </section>

        <section
          aria-label="Key metrics"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <MetricCard
            icon={Users}
            label="Active learners"
            value={formatCount(activeLearnerCount)}
            caption="Currently active members"
            href="/admin/members"
            tone="primary"
          />
          <MetricCard
            icon={ClipboardCheck}
            label="Review queue"
            value={formatCount(pendingReviews)}
            caption={pendingReviews > 0 ? "Pending publish reviews" : "No pending reviews"}
            href="/admin/review"
            tone={pendingReviews > 0 ? "warning" : "neutral"}
          />
          <MetricCard
            icon={ShieldAlert}
            label="Open moderation"
            value={formatCount(openModerationCases)}
            caption={openModerationCases > 0 ? "Open community cases" : "No open cases"}
            href={ADMIN_MODERATION_CASES_PATH}
            tone={openModerationCases > 0 ? "warning" : "neutral"}
          />
          <MetricCard
            icon={ScrollText}
            label="Audit events"
            value={auditAvailable ? formatCount(recentAudit.length) : "n/a"}
            caption={auditAvailable ? "Recent events loaded" : "Unavailable for your access"}
            href="/admin/audit"
            tone="neutral"
          />
        </section>

        <section aria-label="Setup and configuration" className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Setup and configuration</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink
              icon={ShieldCheck}
              label="Roles and permissions"
              caption={`${formatCount(roleCount)} role(s) in catalogue`}
              href="/admin/roles"
            />
            <QuickLink
              icon={Settings}
              label="Configuration"
              caption="Runtime config and policies"
              href="/admin/config"
            />
            <QuickLink
              icon={Flag}
              label="Feature flags"
              caption="Toggle tenant capabilities"
              href="/admin/feature-flags"
            />
            <QuickLink
              icon={KeyRound}
              label="Entitlements"
              caption={`${formatCount(entitlementCount)} plan capability flag(s)`}
              href="/admin/entitlements"
            />
            <QuickLink
              icon={GraduationCap}
              label="Studio content"
              caption="Author and publish courses"
              href="/studio/courses"
            />
            <QuickLink
              icon={MessagesSquare}
              label="Community moderation"
              caption="Review reported activity"
              href={ADMIN_MODERATION_CASES_PATH}
            />
            <QuickLink
              icon={Database}
              label="Provisioning"
              caption={`${formatCount(provisioningJobCount)} job record(s) on file`}
              href="/admin/audit"
            />
            <QuickLink
              icon={Download}
              label="Data exports"
              caption="Run approved data exports"
              href="/admin/exports"
            />
            <QuickLink
              icon={Trash2}
              label="Deletion requests"
              caption="Process data-rights deletions"
              href="/admin/deletion-requests"
            />
          </div>
        </section>

        <section
          aria-label="Recent activity"
          className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
        >
          <div className="flex items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]/40 px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Recent activity</h2>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">Latest tenant audit trail</p>
            </div>
            <Link
              href="/admin/audit"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90"
            >
              View full logs
            </Link>
          </div>

          {recentAudit.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Recent tenant audit events</caption>
                <thead>
                  <tr className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                    <th scope="col" className="px-6 py-3">
                      Time
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Action
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Target
                    </th>
                    <th scope="col" className="px-6 py-3 text-right">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {recentAudit.map((entry) => (
                    <tr key={entry.id} className="transition-colors hover:bg-[var(--admin-surface-high)]/40">
                      <td className="px-6 py-4 text-sm text-[var(--admin-on-surface-variant)]">
                        {new Date(entry.occurredAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-md bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-xs text-[var(--admin-on-surface)]">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--admin-on-surface)]">
                        {entry.targetType}
                        {entry.targetId ? (
                          <span className="text-[var(--admin-on-surface-variant)]">
                            {" "}
                            &middot; {entry.targetId.slice(0, 8)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href="/admin/audit"
                          prefetch={false}
                          aria-label={`Open audit detail for ${entry.action}`}
                          className="inline-flex text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                        >
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">No recent activity</p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                {auditAvailable
                  ? "Audit events will appear here as administrators take action."
                  : "Audit summary is unavailable for your current access."}
              </p>
            </div>
          )}
        </section>
      </div>
    </AdminPageGate>
  );
}
