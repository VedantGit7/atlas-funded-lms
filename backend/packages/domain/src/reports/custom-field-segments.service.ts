import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { batchesRepository } from "../batches/batches.repository";
import type { ServiceCtx } from "../shared/domain.types";
import {
  assessConditionsCompleteness,
  buildConditionSummary,
  countConditions,
} from "./custom-field-segments.conditions";
import {
  createCustomFieldSegmentBodySchema,
  customFieldSegmentDeleteResponseSchema,
  customFieldSegmentDetailResponseSchema,
  customFieldSegmentExportResponseSchema,
  customFieldSegmentGroupResponseSchema,
  customFieldSegmentItemSchema,
  customFieldSegmentLearnersExportResponseSchema,
  customFieldSegmentLearnersResponseSchema,
  customFieldSegmentListResponseSchema,
  customFieldSegmentMutationResponseSchema,
  customFieldSegmentPreviewResponseSchema,
  customFieldSegmentViewResponseSchema,
  previewCustomFieldSegmentBodySchema,
  segmentConditionsTreeSchema,
  updateCustomFieldSegmentBodySchema,
  type CreateCustomFieldSegmentBody,
  type CreateSegmentGroupBody,
  type CustomFieldSegmentItem,
  type CustomFieldSegmentLearnersQuery,
  type PreviewCustomFieldSegmentBody,
  type SegmentConditionsTree,
  type UpdateCustomFieldSegmentBody,
} from "./custom-field-segments.dto";
import {
  customFieldSegmentEmptyAudience,
  customFieldSegmentInvalidConditions,
  customFieldSegmentNotFound,
} from "./custom-field-segments.errors";
import { customFieldSegmentsRepository, type SegmentRow } from "./custom-field-segments.repository";
import { customFieldRosterRepository } from "./custom-field-roster.repository";
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

function slugifyKey(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "segment"}-${randomUUID().slice(0, 8)}`;
}

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function parseTree(raw: unknown): SegmentConditionsTree {
  return segmentConditionsTreeSchema.parse(raw);
}

function isStale(matchedCountAt: Date | null, updatedAt: Date): boolean {
  const ref = matchedCountAt ?? updatedAt;
  return Date.now() - ref.getTime() > STALE_MS;
}

async function mapSegmentItem(
  tx: TenantTx,
  row: SegmentRow,
  fieldLabels: Map<string, string>,
): Promise<CustomFieldSegmentItem> {
  const conditions = parseTree(row.conditions_json);
  const counts = countConditions(conditions);
  const matchedCount = row.matched_count;
  const previousMatchedCount = row.previous_matched_count;
  const matchedDelta =
    matchedCount != null && previousMatchedCount != null
      ? matchedCount - previousMatchedCount
      : null;
  const dependencyCount = await customFieldSegmentsRepository.countScheduleDependencies(tx, row.id);

  return customFieldSegmentItemSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility === "private" ? "private" : "shared",
    refreshMode: row.refresh_mode === "snapshot" ? "snapshot" : "live",
    conditions,
    conditionSummary: buildConditionSummary(conditions, fieldLabels),
    conditionCount: counts.conditionCount,
    groupCount: counts.groupCount,
    matchedCount,
    previousMatchedCount,
    matchedDelta,
    matchedCountAt: toIso(row.matched_count_at),
    isStale: isStale(row.matched_count_at, row.updated_at),
    createdByMembershipId: row.created_by_membership_id,
    createdByName: row.created_by_name,
    dependencyCount,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

export async function listCustomFieldSegments(tx: TenantTx, ctx: ServiceCtx) {
  const [rows, fieldTypes, fieldLabels] = await Promise.all([
    customFieldSegmentsRepository.listSegments(tx, ctx.actorMembershipId),
    customFieldSegmentsRepository.listFieldTypes(tx),
    customFieldSegmentsRepository.listFieldLabels(tx),
  ]);

  const items = await Promise.all(rows.map((row) => mapSegmentItem(tx, row, fieldLabels)));

  const sharedCount = items.filter((item) => item.visibility === "shared").length;
  const privateCount = items.filter((item) => item.visibility === "private").length;
  const staleCount = items.filter((item) => item.isStale).length;

  let largestSegmentName: string | null = null;
  let largestSegmentCount: number | null = null;
  for (const item of items) {
    if (item.matchedCount == null) continue;
    if (largestSegmentCount == null || item.matchedCount > largestSegmentCount) {
      largestSegmentCount = item.matchedCount;
      largestSegmentName = item.name;
    }
  }

  const trees = items.map((item) => item.conditions);
  const learnersCovered =
    trees.length === 0
      ? 0
      : await customFieldSegmentsRepository.countMatchingAny(tx, trees, fieldTypes);

  const usedInMessages = items.reduce((sum, item) => sum + item.dependencyCount, 0);

  return customFieldSegmentListResponseSchema.parse({
    data: {
      items,
      summary: {
        segmentCount: items.length,
        sharedCount,
        privateCount,
        learnersCovered,
        largestSegmentName,
        largestSegmentCount,
        staleCount,
        usedInMessages,
      },
    },
  });
}

export async function getCustomFieldSegment(tx: TenantTx, ctx: ServiceCtx, segmentId: string) {
  const row = await customFieldSegmentsRepository.getSegment(tx, segmentId, ctx.actorMembershipId);
  if (!row) throw customFieldSegmentNotFound();
  const fieldLabels = await customFieldSegmentsRepository.listFieldLabels(tx);
  const item = await mapSegmentItem(tx, row, fieldLabels);
  return customFieldSegmentDetailResponseSchema.parse({ data: item });
}

async function computeMatchCount(tx: TenantTx, conditions: SegmentConditionsTree): Promise<number> {
  const fieldTypes = await customFieldSegmentsRepository.listFieldTypes(tx);
  const completeness = assessConditionsCompleteness(conditions, fieldTypes);
  if (!completeness.complete) {
    throw customFieldSegmentInvalidConditions(
      completeness.message ?? "Finish all conditions before saving.",
    );
  }
  const count = await customFieldSegmentsRepository.countMatching(tx, conditions, fieldTypes);
  if (count == null) {
    throw customFieldSegmentInvalidConditions("Could not evaluate segment conditions.");
  }
  return count;
}

export async function createCustomFieldSegment(
  tx: TenantTx,
  ctx: ServiceCtx,
  body: CreateCustomFieldSegmentBody,
) {
  const input = createCustomFieldSegmentBodySchema.parse(body);
  const matchedCount = await computeMatchCount(tx, input.conditions);
  let snapshotBatchId: string | null = null;

  if (input.refreshMode === "snapshot") {
    const fieldTypes = await customFieldSegmentsRepository.listFieldTypes(tx);
    const membershipIds = await customFieldSegmentsRepository.listMatchingMembershipIds(
      tx,
      input.conditions,
      fieldTypes,
    );
    const batch = await batchesRepository.insertBatch(tx, {
      key: slugifyKey(input.name),
      name: `${input.name} (snapshot)`,
      status: "ACTIVE",
      metadataJson: {
        source: "custom_field_segment_snapshot",
        createdFrom: "reports.custom-field.segments",
      },
    });
    for (const membershipId of membershipIds) {
      await batchesRepository.assignMember(tx, { batchId: batch.id, membershipId });
    }
    snapshotBatchId = batch.id;
  }

  const inserted = await customFieldSegmentsRepository.insertSegment(tx, {
    id: randomUUID(),
    name: input.name,
    description: input.description ?? null,
    visibility: input.visibility,
    refreshMode: input.refreshMode,
    conditionsJson: input.conditions,
    matchedCount,
    previousMatchedCount: null,
    matchedCountAt: new Date(),
    snapshotBatchId,
    createdByMembershipId: ctx.actorMembershipId,
  });

  const hydrated = await customFieldSegmentsRepository.getSegment(
    tx,
    inserted.id,
    ctx.actorMembershipId,
  );
  const fieldLabels = await customFieldSegmentsRepository.listFieldLabels(tx);
  const item = await mapSegmentItem(tx, hydrated ?? inserted, fieldLabels);
  return customFieldSegmentMutationResponseSchema.parse({ data: item });
}

export async function updateCustomFieldSegment(
  tx: TenantTx,
  ctx: ServiceCtx,
  segmentId: string,
  body: UpdateCustomFieldSegmentBody,
) {
  const input = updateCustomFieldSegmentBodySchema.parse(body);
  const existing = await customFieldSegmentsRepository.getSegment(
    tx,
    segmentId,
    ctx.actorMembershipId,
  );
  if (!existing) throw customFieldSegmentNotFound();

  const nextConditions = input.conditions ? input.conditions : parseTree(existing.conditions_json);
  const nextRefreshMode = input.refreshMode ?? (existing.refresh_mode as "live" | "snapshot");
  const conditionsChanged = input.conditions !== undefined;
  const refreshChanged = input.refreshMode !== undefined;

  let matchedCount = existing.matched_count;
  let previousMatchedCount = existing.previous_matched_count;
  let matchedCountAt = existing.matched_count_at;
  let snapshotBatchId = existing.snapshot_batch_id;

  if (conditionsChanged || refreshChanged) {
    const nextCount = await computeMatchCount(tx, nextConditions);
    previousMatchedCount = existing.matched_count;
    matchedCount = nextCount;
    matchedCountAt = new Date();

    if (nextRefreshMode === "snapshot") {
      const fieldTypes = await customFieldSegmentsRepository.listFieldTypes(tx);
      const membershipIds = await customFieldSegmentsRepository.listMatchingMembershipIds(
        tx,
        nextConditions,
        fieldTypes,
      );
      const batch = await batchesRepository.insertBatch(tx, {
        key: slugifyKey(input.name ?? existing.name),
        name: `${input.name ?? existing.name} (snapshot)`,
        status: "ACTIVE",
        metadataJson: {
          source: "custom_field_segment_snapshot",
          createdFrom: "reports.custom-field.segments",
          segmentId,
        },
      });
      for (const membershipId of membershipIds) {
        await batchesRepository.assignMember(tx, { batchId: batch.id, membershipId });
      }
      snapshotBatchId = batch.id;
    }
  }

  const updated = await customFieldSegmentsRepository.updateSegment(tx, {
    id: segmentId,
    name: input.name,
    description: input.description,
    visibility: input.visibility,
    refreshMode: input.refreshMode,
    conditionsJson: input.conditions,
    matchedCount,
    previousMatchedCount,
    matchedCountAt,
    snapshotBatchId,
  });
  if (!updated) throw customFieldSegmentNotFound();

  const hydrated = await customFieldSegmentsRepository.getSegment(
    tx,
    segmentId,
    ctx.actorMembershipId,
  );
  const fieldLabels = await customFieldSegmentsRepository.listFieldLabels(tx);
  const item = await mapSegmentItem(tx, hydrated ?? updated, fieldLabels);
  return customFieldSegmentMutationResponseSchema.parse({ data: item });
}

export async function duplicateCustomFieldSegment(
  tx: TenantTx,
  ctx: ServiceCtx,
  segmentId: string,
) {
  const existing = await customFieldSegmentsRepository.getSegment(
    tx,
    segmentId,
    ctx.actorMembershipId,
  );
  if (!existing) throw customFieldSegmentNotFound();
  const conditions = parseTree(existing.conditions_json);
  return createCustomFieldSegment(tx, ctx, {
    name: `${existing.name} (copy)`,
    description: existing.description,
    visibility: existing.visibility === "private" ? "private" : "shared",
    refreshMode: existing.refresh_mode === "snapshot" ? "snapshot" : "live",
    conditions,
  });
}

export async function deleteCustomFieldSegment(tx: TenantTx, ctx: ServiceCtx, segmentId: string) {
  const existing = await customFieldSegmentsRepository.getSegment(
    tx,
    segmentId,
    ctx.actorMembershipId,
  );
  if (!existing) throw customFieldSegmentNotFound();
  await customFieldSegmentsRepository.deleteSegment(tx, segmentId);
  return customFieldSegmentDeleteResponseSchema.parse({
    data: { id: segmentId, deleted: true },
  });
}

export async function previewCustomFieldSegment(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: PreviewCustomFieldSegmentBody,
) {
  const input = previewCustomFieldSegmentBodySchema.parse(body);
  const fieldTypes = await customFieldSegmentsRepository.listFieldTypes(tx);
  const completeness = assessConditionsCompleteness(input.conditions, fieldTypes);
  if (!completeness.complete) {
    return customFieldSegmentPreviewResponseSchema.parse({
      data: {
        matchedCount: 0,
        incomplete: true,
        incompleteMessage: completeness.message,
        learners: [],
      },
    });
  }

  const [matchedCount, learners] = await Promise.all([
    customFieldSegmentsRepository.countMatching(tx, input.conditions, fieldTypes),
    customFieldSegmentsRepository.listMatchingLearners(
      tx,
      input.conditions,
      fieldTypes,
      input.limit,
    ),
  ]);

  return customFieldSegmentPreviewResponseSchema.parse({
    data: {
      matchedCount: matchedCount ?? 0,
      incomplete: false,
      incompleteMessage: null,
      learners: learners.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
      })),
    },
  });
}

export async function createGroupFromCustomFieldSegment(
  tx: TenantTx,
  ctx: ServiceCtx,
  segmentId: string,
  body: CreateSegmentGroupBody,
) {
  const existing = await customFieldSegmentsRepository.getSegment(
    tx,
    segmentId,
    ctx.actorMembershipId,
  );
  if (!existing) throw customFieldSegmentNotFound();

  const fieldTypes = await customFieldSegmentsRepository.listFieldTypes(tx);
  const conditions = parseTree(existing.conditions_json);
  const membershipIds = await customFieldSegmentsRepository.listMatchingMembershipIds(
    tx,
    conditions,
    fieldTypes,
  );
  if (membershipIds.length === 0) throw customFieldSegmentEmptyAudience();

  const title = body.title?.trim() || existing.name;
  const batch = await batchesRepository.insertBatch(tx, {
    key: slugifyKey(title),
    name: title,
    status: "ACTIVE",
    metadataJson: {
      source: "custom_field_segment",
      segmentId,
      segmentName: existing.name,
      description: body.description ?? existing.description,
      createdFrom: "reports.custom-field.segments",
      syncType: existing.refresh_mode === "live" ? "live" : "static",
      criteriaSummary: existing.name,
      createdByMembershipId: ctx.actorMembershipId,
    },
  });

  let memberCount = 0;
  for (const membershipId of membershipIds) {
    await batchesRepository.assignMember(tx, { batchId: batch.id, membershipId });
    memberCount += 1;
  }

  return customFieldSegmentGroupResponseSchema.parse({
    data: {
      batchId: batch.id,
      key: batch.key,
      name: batch.name,
      memberCount,
    },
  });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export async function exportCustomFieldSegmentsCsv(tx: TenantTx, ctx: ServiceCtx) {
  const listed = await listCustomFieldSegments(tx, ctx);
  const header = [
    "name",
    "visibility",
    "refresh_mode",
    "condition_summary",
    "condition_count",
    "group_count",
    "matched_count",
    "created_by",
    "last_refreshed",
    "is_stale",
  ];
  const lines = [header.join(",")];
  for (const item of listed.data.items) {
    lines.push(
      [
        csvEscape(item.name),
        item.visibility,
        item.refreshMode,
        csvEscape(item.conditionSummary),
        String(item.conditionCount),
        String(item.groupCount),
        item.matchedCount == null ? "" : String(item.matchedCount),
        csvEscape(item.createdByName ?? ""),
        item.matchedCountAt ?? "",
        item.isStale ? "true" : "false",
      ].join(","),
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return customFieldSegmentExportResponseSchema.parse({
    data: {
      csv: `${lines.join("\n")}\n`,
      filename: `custom-field-segments-${stamp}.csv`,
      rowCount: listed.data.items.length,
    },
  });
}

function formatCustomValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) return formatCustomValue(record["value"]);
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function getCustomFieldSegmentView(tx: TenantTx, ctx: ServiceCtx, segmentId: string) {
  const row = await customFieldSegmentsRepository.getSegment(tx, segmentId, ctx.actorMembershipId);
  if (!row) throw customFieldSegmentNotFound();

  const [fieldLabels, fieldTypes] = await Promise.all([
    customFieldSegmentsRepository.listFieldLabels(tx),
    customFieldSegmentsRepository.listFieldTypes(tx),
  ]);
  const segment = await mapSegmentItem(tx, row, fieldLabels);
  const conditions = parseTree(row.conditions_json);

  const [membershipIds, totalLearnerCount, otherSegments] = await Promise.all([
    customFieldSegmentsRepository.listMatchingMembershipIds(tx, conditions, fieldTypes, 5000),
    customFieldSegmentsRepository.countAllLearners(tx),
    customFieldSegmentsRepository.listSegments(tx, ctx.actorMembershipId),
  ]);

  const matchedCount = membershipIds.length;
  const zeroMatch = matchedCount === 0;

  const [stats, histogram, signupCohorts, fieldDistRows] = await Promise.all([
    customFieldSegmentsRepository.getMatchedLearnerStats(tx, membershipIds),
    customFieldSegmentsRepository.getSpendHistogram(tx, membershipIds),
    customFieldSegmentsRepository.getSignupCohorts(tx, membershipIds),
    customFieldSegmentsRepository.getFieldDistributions(tx, membershipIds),
  ]);

  const shareOfLearnersPct =
    totalLearnerCount === 0 ? null : round1((matchedCount / totalLearnerCount) * 100);
  const activeLast30DaysPct =
    matchedCount === 0 ? null : round1((stats.active_last_30_days / matchedCount) * 100);

  const maxHist = Math.max(1, ...histogram.buckets.map((bucket) => bucket.count));
  const spendHistogram = histogram.buckets.map((bucket) => ({
    label: bucket.label,
    count: bucket.count,
    heightPct: Math.round((bucket.count / maxHist) * 100),
  }));

  const maxSignup = Math.max(1, ...signupCohorts.map((cohort) => cohort.count));
  const signupCohortsOut = signupCohorts.map((cohort) => ({
    label: cohort.label,
    count: cohort.count,
    pct: Math.round((cohort.count / maxSignup) * 100),
  }));

  const byField = new Map<
    string,
    {
      fieldKey: string;
      fieldLabel: string;
      fieldType: string;
      buckets: Array<{ value: string; segmentCount: number; tenantCount: number }>;
    }
  >();
  for (const dist of fieldDistRows) {
    const current = byField.get(dist.field_key) ?? {
      fieldKey: dist.field_key,
      fieldLabel: dist.field_label,
      fieldType: dist.field_type,
      buckets: [],
    };
    current.buckets.push({
      value: dist.value,
      segmentCount: dist.segment_count,
      tenantCount: dist.tenant_count,
    });
    byField.set(dist.field_key, current);
  }

  const tenantFilledByField = new Map<string, number>();
  const segmentFilledByField = new Map<string, number>();
  for (const dist of fieldDistRows) {
    tenantFilledByField.set(
      dist.field_key,
      (tenantFilledByField.get(dist.field_key) ?? 0) + dist.tenant_count,
    );
    segmentFilledByField.set(
      dist.field_key,
      (segmentFilledByField.get(dist.field_key) ?? 0) + dist.segment_count,
    );
  }

  const allDivergences = [...byField.values()]
    .map((field) => {
      const segmentFilled = Math.max(1, segmentFilledByField.get(field.fieldKey) ?? 1);
      const tenantFilled = Math.max(1, tenantFilledByField.get(field.fieldKey) ?? 1);
      const buckets = field.buckets
        .map((bucket) => ({
          value: bucket.value,
          segmentPct: round1((bucket.segmentCount / segmentFilled) * 100),
          tenantPct: round1((bucket.tenantCount / tenantFilled) * 100),
        }))
        .sort((a, b) => b.segmentPct - a.segmentPct)
        .slice(0, 5);
      let maxDivergencePct = 0;
      let captionValue = buckets[0]?.value ?? "";
      let captionSegment = 0;
      let captionTenant = 0;
      for (const bucket of buckets) {
        const divergence = Math.abs(bucket.segmentPct - bucket.tenantPct);
        if (divergence > maxDivergencePct) {
          maxDivergencePct = divergence;
          captionValue = bucket.value;
          captionSegment = bucket.segmentPct;
          captionTenant = bucket.tenantPct;
        }
      }
      return {
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        caption:
          buckets.length === 0
            ? "No filled values yet"
            : `${String(captionSegment)}% prefer ${captionValue}, versus ${String(captionTenant)}% of all learners`,
        maxDivergencePct: round1(maxDivergencePct),
        buckets,
      };
    })
    .sort((a, b) => b.maxDivergencePct - a.maxDivergencePct);

  const distinctive = allDivergences.filter((item) => item.maxDivergencePct >= 8);
  const similarFieldCount = Math.max(0, allDivergences.length - distinctive.length);
  const fieldDivergences = (distinctive.length > 0 ? distinctive : allDivergences).slice(0, 6);

  const membershipSet = new Set(membershipIds);
  const overlaps: Array<{
    segmentId: string;
    name: string;
    overlapCount: number;
    overlapPct: number;
  }> = [];
  const siblings = otherSegments.filter((other) => other.id !== segmentId).slice(0, 20);
  for (const other of siblings) {
    try {
      const otherTree = parseTree(other.conditions_json);
      const otherIds = await customFieldSegmentsRepository.listMatchingMembershipIds(
        tx,
        otherTree,
        fieldTypes,
        5000,
      );
      let overlapCount = 0;
      for (const id of otherIds) {
        if (membershipSet.has(id)) overlapCount += 1;
      }
      if (overlapCount === 0) continue;
      overlaps.push({
        segmentId: other.id,
        name: other.name,
        overlapCount,
        overlapPct: matchedCount === 0 ? 0 : round1((overlapCount / matchedCount) * 100),
      });
    } catch {
      // skip invalid sibling trees
    }
  }
  overlaps.sort((a, b) => b.overlapCount - a.overlapCount);

  const matchedDelta =
    segment.matchedCount != null && segment.previousMatchedCount != null
      ? segment.matchedCount - segment.previousMatchedCount
      : segment.matchedDelta;

  return customFieldSegmentViewResponseSchema.parse({
    data: {
      segment: {
        ...segment,
        matchedCount,
        matchedDelta,
      },
      analytics: {
        matchedCount,
        previousMatchedCount: segment.previousMatchedCount,
        matchedDelta,
        matchedCountAt: segment.matchedCountAt,
        totalLearnerCount,
        shareOfLearnersPct,
        averageTotalSpentCents:
          stats.average_total_spent_cents == null
            ? null
            : Math.round(stats.average_total_spent_cents),
        currency: stats.currency,
        averageEnrollmentCount:
          stats.average_enrollment_count == null ? null : round1(stats.average_enrollment_count),
        activeLast30DaysCount: stats.active_last_30_days,
        activeLast30DaysPct,
        spendHistogram,
        tenantMedianSpentCents:
          histogram.tenantMedianCents == null ? null : Math.round(histogram.tenantMedianCents),
        tenantMedianBucketIndex: histogram.tenantMedianBucketIndex,
        signupCohorts: signupCohortsOut,
        fieldDivergences,
        similarFieldCount,
        overlaps: overlaps.slice(0, 3),
      },
      zeroMatch,
    },
  });
}

export async function listCustomFieldSegmentLearners(
  tx: TenantTx,
  ctx: ServiceCtx,
  segmentId: string,
  query: CustomFieldSegmentLearnersQuery,
) {
  const row = await customFieldSegmentsRepository.getSegment(tx, segmentId, ctx.actorMembershipId);
  if (!row) throw customFieldSegmentNotFound();

  const fieldTypes = await customFieldSegmentsRepository.listFieldTypes(tx);
  const conditions = parseTree(row.conditions_json);
  const definitions = await customFieldRosterRepository.listFieldDefinitions(tx);
  const page = await customFieldSegmentsRepository.listMatchingLearnersPage(
    tx,
    conditions,
    fieldTypes,
    { q: query.q, page: query.page, limit: query.limit },
  );

  const membershipIds = page.rows.map((item) => item.membership_id);
  const values = await customFieldRosterRepository.listValuesForMemberships(tx, membershipIds);
  const valuesByMembership = new Map<string, Record<string, string | null>>();
  for (const value of values) {
    const current = valuesByMembership.get(value.membership_id) ?? {};
    current[value.field_key] = formatCustomValue(value.value_json);
    valuesByMembership.set(value.membership_id, current);
  }

  const emptyCustom: Record<string, string | null> = {};
  for (const definition of definitions) {
    emptyCustom[definition.key] = null;
  }

  const totalPages = page.total === 0 ? 0 : Math.ceil(page.total / query.limit);

  return customFieldSegmentLearnersResponseSchema.parse({
    data: {
      items: page.rows.map((item) => ({
        membershipId: item.membership_id,
        learnerName: item.learner_name,
        email: item.email,
        status: item.status,
        enrollmentCount: item.enrollment_count,
        totalSpentCents: item.total_spent_cents,
        currency: item.currency,
        lastActiveAt: item.last_active_at?.toISOString() ?? null,
        signedUpAt: item.signed_up_at?.toISOString() ?? null,
        customFields: {
          ...emptyCustom,
          ...(valuesByMembership.get(item.membership_id) ?? {}),
        },
      })),
      pageInfo: {
        page: query.page,
        pageSize: query.limit,
        totalCount: page.total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
      fieldDefinitions: definitions.map((definition) => ({
        id: definition.id,
        key: definition.key,
        label: definition.label,
        fieldType: definition.field_type,
      })),
    },
  });
}

export async function exportCustomFieldSegmentLearnersCsv(
  tx: TenantTx,
  ctx: ServiceCtx,
  segmentId: string,
) {
  const fieldTypes = await customFieldSegmentsRepository.listFieldTypes(tx);
  const row = await customFieldSegmentsRepository.getSegment(tx, segmentId, ctx.actorMembershipId);
  if (!row) throw customFieldSegmentNotFound();
  const conditions = parseTree(row.conditions_json);
  const definitions = await customFieldRosterRepository.listFieldDefinitions(tx);
  const page = await customFieldSegmentsRepository.listMatchingLearnersPage(
    tx,
    conditions,
    fieldTypes,
    { page: 1, limit: 2000 },
  );
  const membershipIds = page.rows.map((item) => item.membership_id);
  const values = await customFieldRosterRepository.listValuesForMemberships(tx, membershipIds);
  const valuesByMembership = new Map<string, Record<string, string | null>>();
  for (const value of values) {
    const current = valuesByMembership.get(value.membership_id) ?? {};
    current[value.field_key] = formatCustomValue(value.value_json);
    valuesByMembership.set(value.membership_id, current);
  }

  const header = [
    "learner_name",
    "email",
    "status",
    "enrollment_count",
    "total_spent_cents",
    "currency",
    "last_active_at",
    "signed_up_at",
    ...definitions.map((definition) => definition.key),
  ];
  const lines = [header.join(",")];
  for (const item of page.rows) {
    const custom = valuesByMembership.get(item.membership_id) ?? {};
    lines.push(
      [
        csvEscape(item.learner_name ?? ""),
        csvEscape(item.email ?? ""),
        item.status,
        String(item.enrollment_count),
        String(item.total_spent_cents),
        item.currency,
        item.last_active_at?.toISOString() ?? "",
        item.signed_up_at?.toISOString() ?? "",
        ...definitions.map((definition) => csvEscape(custom[definition.key] ?? "")),
      ].join(","),
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return customFieldSegmentLearnersExportResponseSchema.parse({
    data: {
      csv: `${lines.join("\n")}\n`,
      filename: `segment-${segmentId.slice(0, 8)}-learners-${stamp}.csv`,
      rowCount: page.rows.length,
    },
  });
}
