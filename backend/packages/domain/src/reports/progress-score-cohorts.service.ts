import type { TenantTx } from "@atlas/db";
import {
  cohortGroupsQuerySchema,
  cohortGroupsResponseSchema,
  cohortMessagesQuerySchema,
  cohortMessagesResponseSchema,
  type CohortGroupsQuery,
  type CohortMessagesQuery,
} from "./progress-score-roster.dto";
import { progressScoreCohortsRepository } from "./progress-score-cohorts.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function pageInfo(totalCount: number, page: number, pageSize: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asUuid(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function sourceKindFromCreatedFrom(createdFrom: string | null, source: string | null): "progress" | "scores" {
  const hay = `${createdFrom ?? ""} ${source ?? ""}`.toLowerCase();
  if (hay.includes("scores")) return "scores";
  return "progress";
}

function reportHrefForCampaign(args: {
  sourceKind: "progress" | "scores";
  productType: string | null;
  productId: string | null;
  assessmentId: string | null;
}): string | null {
  if (args.sourceKind === "scores" && args.assessmentId) {
    return `/admin/reports/progress-score/scores/quizzes/${args.assessmentId}`;
  }
  if (args.sourceKind === "progress" && args.productType && args.productId) {
    return `/admin/reports/progress-score/progress/${args.productType}/${args.productId}`;
  }
  if (args.sourceKind === "progress") {
    return "/admin/reports/progress-score/progress";
  }
  return "/admin/reports/progress-score/scores";
}

function campaignStatus(delivered: number, failed: number): "sent" | "partially_failed" | "failed" {
  if (failed > 0 && delivered > 0) return "partially_failed";
  if (failed > 0 && delivered === 0) return "failed";
  return "sent";
}

export async function listCohortGroups(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query: CohortGroupsQuery = cohortGroupsQuerySchema.parse(rawQuery);
  const offset = (query.page - 1) * query.limit;
  const [totalCount, rows] = await Promise.all([
    progressScoreCohortsRepository.countCohortGroups(tx, query.q),
    progressScoreCohortsRepository.listCohortGroups(tx, {
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
      offset,
    }),
  ]);

  const items = rows.map((row) => {
    const meta = progressScoreCohortsRepository.asObject(row.metadata_json);
    const createdFrom = asString(meta["createdFrom"]);
    const sourceKind = sourceKindFromCreatedFrom(createdFrom, asString(meta["source"]));
    const syncRaw = asString(meta["syncType"]);
    return {
      batchId: row.id,
      key: row.key,
      name: row.name,
      description: asString(meta["description"]),
      sourceKind,
      productType: asString(meta["productType"]),
      productId: asUuid(meta["productId"]),
      productTitle: asString(meta["productTitle"]),
      assessmentId: asUuid(meta["assessmentId"]),
      assessmentTitle: asString(meta["assessmentTitle"]),
      criteriaSummary: asString(meta["criteriaSummary"]),
      memberCount: row.member_count,
      syncType: syncRaw === "live" ? ("live" as const) : ("static" as const),
      createdAt: row.created_at.toISOString(),
      createdByLabel: row.created_by_label,
    };
  });

  return cohortGroupsResponseSchema.parse({
    data: {
      items,
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function listCohortMessages(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query: CohortMessagesQuery = cohortMessagesQuerySchema.parse(rawQuery);
  const offset = (query.page - 1) * query.limit;
  const [totalCount, rows] = await Promise.all([
    progressScoreCohortsRepository.countCohortCampaigns(tx),
    progressScoreCohortsRepository.listCohortCampaigns(tx, {
      limit: query.limit,
      offset,
    }),
  ]);

  const items = rows.map((row) => {
    const sourceKind = sourceKindFromCreatedFrom(null, row.source);
    const delivered = row.delivered_count;
    const failed = row.failed_count;
    const skipped = Math.max(
      row.skipped_count,
      Math.max(0, row.recipient_count - delivered - failed),
    );
    return {
      campaignId: row.campaign_id,
      subject: row.subject?.trim() || "Untitled message",
      audienceCaption: row.audience_caption,
      sourceKind,
      productTitle: row.product_title,
      assessmentTitle: row.assessment_title,
      deliveredCount: delivered,
      skippedCount: skipped,
      failedCount: failed,
      openedCount: null,
      recipientCount: row.recipient_count,
      status: campaignStatus(delivered, failed),
      sentByLabel: row.sent_by_label,
      sentAt: row.sent_at.toISOString(),
      reportHref: reportHrefForCampaign({
        sourceKind,
        productType: row.product_type,
        productId: row.product_id,
        assessmentId: row.assessment_id,
      }),
    };
  });

  return cohortMessagesResponseSchema.parse({
    data: {
      items,
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}
