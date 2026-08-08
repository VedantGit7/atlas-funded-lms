import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { batchesRepository } from "../batches/batches.repository";
import {
  createEnrollmentGroupBodySchema,
  createEnrollmentGroupResponseSchema,
  enrollmentOverviewResponseSchema,
  enrollmentRosterListResponseSchema,
  type EnrollmentOverviewQuery,
  type EnrollmentRosterQuery,
} from "./enrollments-roster.dto";
import { enrollmentRosterEmptyAudience } from "./enrollments-roster.errors";
import {
  enrollmentsRosterRepository,
  type EnrollmentRosterFilter,
} from "./enrollments-roster.repository";

const TYPE_LABELS: Record<string, string> = {
  paid: "Paid",
  free: "Free",
  trial: "Trial",
  offline: "Offline",
  manual: "Manual",
  complimentary: "Complimentary",
};

const CHART_TYPE_ORDER = ["paid", "free", "trial", "offline"] as const;

function toFilter(
  input: Partial<{
    enrolledFrom?: string | undefined;
    enrolledTo?: string | undefined;
    email?: string | undefined;
    enrolledType?: string | undefined;
    status?: string | undefined;
    courseId?: string | undefined;
  }>,
): EnrollmentRosterFilter {
  const filter: EnrollmentRosterFilter = {};
  if (input.enrolledFrom) filter.enrolledFrom = input.enrolledFrom;
  if (input.enrolledTo) filter.enrolledTo = input.enrolledTo;
  if (input.email) filter.email = input.email;
  if (input.enrolledType) filter.enrolledType = input.enrolledType;
  if (input.status) filter.status = input.status;
  if (input.courseId) filter.courseId = input.courseId;
  return filter;
}

function resolveOverviewWindow(query: EnrollmentOverviewQuery): {
  windowFrom: Date;
  windowTo: Date;
  windowLabel: string;
  filter: EnrollmentRosterFilter;
} {
  const baseFilter = toFilter(query);
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  defaultFrom.setUTCHours(0, 0, 0, 0);

  if (query.enrolledFrom || query.enrolledTo) {
    const windowFrom = query.enrolledFrom
      ? new Date(query.enrolledFrom)
      : defaultFrom;
    const windowTo = query.enrolledTo ? new Date(query.enrolledTo) : now;
    const days =
      Math.max(
        1,
        Math.round((windowTo.getTime() - windowFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1,
      );
    return {
      windowFrom,
      windowTo,
      windowLabel: days <= 31 ? `${days} Days` : "Selected Range",
      filter: baseFilter,
    };
  }

  return {
    windowFrom: defaultFrom,
    windowTo: now,
    windowLabel: "30 Days",
    filter: {
      ...baseFilter,
      enrolledFrom: defaultFrom.toISOString(),
      enrolledTo: now.toISOString(),
    },
  };
}

function previousWindow(windowFrom: Date, windowTo: Date): { from: Date; to: Date } {
  const durationMs = Math.max(windowTo.getTime() - windowFrom.getTime(), 24 * 60 * 60 * 1000);
  const to = new Date(windowFrom.getTime() - 1);
  const from = new Date(to.getTime() - durationMs);
  return { from, to };
}

function groupTypesForChart(
  rows: Array<{ type: string; count: number }>,
): Array<{ type: string; label: string; count: number; percent: number }> {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const key =
      row.type === "offline" || row.type === "manual" || row.type === "complimentary"
        ? "offline"
        : row.type;
    buckets.set(key, (buckets.get(key) ?? 0) + row.count);
  }
  const total = [...buckets.values()].reduce((sum, value) => sum + value, 0);
  const ordered = [
    ...CHART_TYPE_ORDER,
    ...[...buckets.keys()].filter(
      (type) => !(CHART_TYPE_ORDER as readonly string[]).includes(type),
    ),
  ];
  return ordered.map((type) => {
    const count = buckets.get(type) ?? 0;
    return {
      type,
      label: TYPE_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    };
  });
}

function slugifyKey(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `enr-${base || "group"}-${Date.now().toString(36)}`.slice(0, 64);
}

export async function getEnrollmentOverview(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: EnrollmentOverviewQuery,
) {
  const { windowFrom, windowTo, windowLabel, filter } = resolveOverviewWindow(query);
  const nonDateFilter: EnrollmentRosterFilter = {
    ...(filter.email ? { email: filter.email } : {}),
    ...(filter.enrolledType ? { enrolledType: filter.enrolledType } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.courseId ? { courseId: filter.courseId } : {}),
  };
  const previous = previousWindow(windowFrom, windowTo);

  const [summary, byTypeRows, trend, previousPeriodCount] = await Promise.all([
    enrollmentsRosterRepository.getOverviewSummary(tx, filter),
    enrollmentsRosterRepository.getOverviewByType(tx, filter),
    enrollmentsRosterRepository.getOverviewTrend(
      tx,
      nonDateFilter,
      windowFrom.toISOString(),
      windowTo.toISOString(),
    ),
    enrollmentsRosterRepository.countInWindow(
      tx,
      nonDateFilter,
      previous.from.toISOString(),
      previous.to.toISOString(),
    ),
  ]);

  const changePercent =
    previousPeriodCount === 0
      ? summary.totalCount > 0
        ? 100
        : null
      : Math.round(
          ((summary.totalCount - previousPeriodCount) / previousPeriodCount) * 1000,
        ) / 10;

  return enrollmentOverviewResponseSchema.parse({
    data: {
      summary: {
        totalCount: summary.totalCount,
        activeCount: summary.activeCount,
        expiringSoonCount: summary.expiringSoonCount,
        previousPeriodCount,
        changePercent,
        windowLabel,
        windowFrom: windowFrom.toISOString(),
        windowTo: windowTo.toISOString(),
      },
      byType: groupTypesForChart(byTypeRows),
      trend,
    },
  });
}

export async function listEnrollmentRoster(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: EnrollmentRosterQuery,
) {
  const filter = toFilter(query);
  const [totalCount, rows] = await Promise.all([
    enrollmentsRosterRepository.countRoster(tx, filter),
    enrollmentsRosterRepository.listRoster(tx, query),
  ]);

  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);

  return enrollmentRosterListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        productTitle: row.product_title,
        enrolledType: row.enrolled_type,
        status: row.status,
        enrolledAt: row.enrolled_at.toISOString(),
        expiresAt: row.expires_at?.toISOString() ?? null,
      })),
      pageInfo: {
        page: query.page,
        pageSize: query.limit,
        totalCount,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
      columns: query.columns,
    },
  });
}

export async function resolveEnrollmentMembershipIds(
  tx: TenantTx,
  input: {
    membershipIds?: string[] | undefined;
    enrolledFrom?: string | undefined;
    enrolledTo?: string | undefined;
    email?: string | undefined;
    enrolledType?: string | undefined;
    status?: string | undefined;
    courseId?: string | undefined;
  },
): Promise<string[]> {
  if (input.membershipIds && input.membershipIds.length > 0) {
    return [...new Set(input.membershipIds)];
  }

  const membershipIds = await enrollmentsRosterRepository.listMembershipIds(tx, toFilter(input));
  if (membershipIds.length === 0) {
    throw enrollmentRosterEmptyAudience();
  }
  return membershipIds;
}

export async function createEnrollmentGroup(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = createEnrollmentGroupBodySchema.parse(rawBody);
  const membershipIds = await resolveEnrollmentMembershipIds(tx, body);

  const key = slugifyKey(body.title);
  const batch = await batchesRepository.insertBatch(tx, {
    key,
    name: body.title,
    status: "ACTIVE",
    metadataJson: {
      source: "enrollments_report",
      description: body.description ?? null,
      createdFrom: "reports.enrollments",
    },
  });

  let memberCount = 0;
  for (const membershipId of membershipIds) {
    await batchesRepository.assignMember(tx, {
      batchId: batch.id,
      membershipId,
    });
    memberCount += 1;
  }

  return createEnrollmentGroupResponseSchema.parse({
    data: {
      batchId: batch.id,
      key: batch.key,
      name: batch.name,
      memberCount,
    },
  });
}
