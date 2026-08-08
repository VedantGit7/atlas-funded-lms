import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  resourceUsageDormantResponseSchema,
  resourceUsageHistoryResponseSchema,
  resourceUsageInactiveResponseSchema,
  resourceUsageOverviewResponseSchema,
  type ResourceUsageDormantQuery,
  type ResourceUsageHistoryQuery,
  type ResourceUsageInactiveQuery,
} from "./resource-usage-roster.dto";
import { resourceUsageRosterRepository } from "./resource-usage-roster.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export async function getResourceUsageOverview(tx: TenantTx, _ctx: ServiceCtx) {
  const [meters, optimization] = await Promise.all([
    resourceUsageRosterRepository.getMeters(tx),
    resourceUsageRosterRepository.getOptimizationCounts(tx),
  ]);

  return resourceUsageOverviewResponseSchema.parse({
    data: {
      meters,
      optimization,
      notes: {
        bandwidthMetered: false,
        drmMetered: false,
        videoHoursMetered: false,
      },
    },
  });
}

export async function listResourceUsageHistory(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ResourceUsageHistoryQuery,
) {
  const [totalCount, rows] = await Promise.all([
    resourceUsageRosterRepository.countHistory(tx, query),
    resourceUsageRosterRepository.listHistory(tx, query),
  ]);

  return resourceUsageHistoryResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        metricKey: row.metric_key,
        metricLabel: row.metric_label,
        period: row.period,
        value: row.value,
        unit: row.unit,
        calculatedAt: row.calculated_at?.toISOString() ?? null,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

export async function listResourceUsageDormant(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ResourceUsageDormantQuery,
) {
  const [totalCount, rows] = await Promise.all([
    resourceUsageRosterRepository.countDormant(tx, query),
    resourceUsageRosterRepository.listDormant(tx, query),
  ]);

  return resourceUsageDormantResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        courseId: row.course_id,
        title: row.title,
        status: row.status,
        lessonCount: row.lesson_count,
        storageGb: row.storage_gb,
        lastLearnerActivityAt: row.last_learner_activity_at?.toISOString() ?? null,
        createdAt: row.created_at?.toISOString() ?? null,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function listResourceUsageInactive(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ResourceUsageInactiveQuery,
) {
  const [totalCount, rows] = await Promise.all([
    resourceUsageRosterRepository.countInactive(tx, query),
    resourceUsageRosterRepository.listInactive(tx, query),
  ]);

  return resourceUsageInactiveResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        status: row.status,
        lastActiveAt: row.last_active_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}
