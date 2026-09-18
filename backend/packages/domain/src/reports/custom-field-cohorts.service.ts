import type { TenantTx } from "@atlas/db";
import {
  customFieldCohortGroupsQuerySchema,
  customFieldCohortGroupsResponseSchema,
  customFieldCohortMessagesQuerySchema,
  customFieldCohortMessagesResponseSchema,
  type CustomFieldCohortGroupsQuery,
  type CustomFieldCohortMessagesQuery,
} from "./custom-field-roster.dto";
import { customFieldCohortsRepository } from "./custom-field-cohorts.repository";

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

function sourceKindFromMeta(source: string | null): "segment" | "ad_hoc" | "segment_snapshot" {
  if (source === "custom_field_segment_snapshot") return "segment_snapshot";
  if (source === "custom_field_segment") return "segment";
  return "ad_hoc";
}

function sourceLabelForGroup(args: {
  sourceKind: "segment" | "ad_hoc" | "segment_snapshot";
  segmentName: string | null;
}): string {
  if (args.sourceKind === "ad_hoc") return "Ad-hoc filters";
  const name = args.segmentName?.trim();
  if (args.sourceKind === "segment_snapshot") {
    return name ? `Segment snapshot · ${name}` : "Segment snapshot";
  }
  return name ? `Segment · ${name}` : "Segment";
}

function messageSourceKind(source: string | null, segmentId: string | null): "segment" | "ad_hoc" {
  if (segmentId || (source ?? "").includes("segment")) return "segment";
  return "ad_hoc";
}

function campaignStatus(delivered: number, failed: number): "sent" | "partially_failed" | "failed" {
  if (failed > 0 && delivered > 0) return "partially_failed";
  if (failed > 0 && delivered === 0) return "failed";
  return "sent";
}

export async function listCustomFieldCohortGroups(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query: CustomFieldCohortGroupsQuery = customFieldCohortGroupsQuerySchema.parse(rawQuery);
  const offset = (query.page - 1) * query.limit;
  const [totalCount, rows] = await Promise.all([
    customFieldCohortsRepository.countCohortGroups(tx, query.q),
    customFieldCohortsRepository.listCohortGroups(tx, {
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
      offset,
    }),
  ]);

  const items = rows.map((row) => {
    const meta = customFieldCohortsRepository.asObject(row.metadata_json);
    const source = asString(meta["source"]);
    const sourceKind = sourceKindFromMeta(source);
    const segmentName = asString(meta["segmentName"]);
    const syncRaw = asString(meta["syncType"]);
    const syncType: "static" | "live" =
      syncRaw === "live" || syncRaw === "static"
        ? syncRaw
        : sourceKind === "segment"
          ? "live"
          : "static";

    return {
      batchId: row.id,
      key: row.key,
      name: row.name,
      description: asString(meta["description"]),
      sourceKind,
      sourceLabel: sourceLabelForGroup({ sourceKind, segmentName }),
      segmentId: asUuid(meta["segmentId"]),
      segmentName,
      criteriaSummary: asString(meta["criteriaSummary"]),
      memberCount: row.member_count,
      syncType,
      createdAt: row.created_at.toISOString(),
      createdByLabel: row.created_by_label ?? asString(meta["createdByLabel"]),
    };
  });

  return customFieldCohortGroupsResponseSchema.parse({
    data: {
      items,
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function listCustomFieldCohortMessages(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query: CustomFieldCohortMessagesQuery =
    customFieldCohortMessagesQuerySchema.parse(rawQuery);
  const offset = (query.page - 1) * query.limit;
  const [totalCount, rows] = await Promise.all([
    customFieldCohortsRepository.countCohortCampaigns(tx),
    customFieldCohortsRepository.listCohortCampaigns(tx, {
      limit: query.limit,
      offset,
    }),
  ]);

  const items = rows.map((row) => {
    const segmentId = asUuid(row.segment_id);
    const segmentName = asString(row.segment_name);
    const sourceKind = messageSourceKind(row.source, segmentId);
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
      sourceLabel:
        sourceKind === "segment"
          ? segmentName
            ? `Segment · ${segmentName}`
            : "Segment source"
          : "Ad-hoc filters",
      segmentId,
      segmentName,
      deliveredCount: delivered,
      skippedCount: skipped,
      failedCount: failed,
      openedCount: null,
      clickedCount: null,
      recipientCount: row.recipient_count,
      status: campaignStatus(delivered, failed),
      sentByLabel: row.sent_by_label,
      sentAt: row.sent_at.toISOString(),
      reportHref: segmentId
        ? `/admin/reports/custom-field/segments/${segmentId}`
        : "/admin/reports/custom-field",
    };
  });

  return customFieldCohortMessagesResponseSchema.parse({
    data: {
      items,
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}
