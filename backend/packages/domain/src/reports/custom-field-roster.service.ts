import type { TenantTx } from "@atlas/db";
import { batchesRepository } from "../batches/batches.repository";
import type { ServiceCtx } from "../shared/domain.types";
import type {
  customFieldDetailBooleanSchema,
  customFieldDetailCrossTabSchema,
  customFieldDetailNumberSchema,
  customFieldDetailSelectSchema,
  customFieldDetailTextSchema,
} from "./custom-field-roster.dto";
import {
  createCustomFieldGroupResponseSchema,
  customFieldCatalogueResponseSchema,
  customFieldDefinitionsReportResponseSchema,
  customFieldDetailResponseSchema,
  customFieldLearnerDetailResponseSchema,
  customFieldRosterListResponseSchema,
  updateCustomFieldLearnerValuesResponseSchema,
  type CustomFieldCatalogueQuery,
  type CustomFieldDetailQuery,
  type CustomFieldRosterQuery,
  type UpdateCustomFieldLearnerValuesBody,
} from "./custom-field-roster.dto";
import {
  customFieldDetailNotFound,
  customFieldLearnerNotFound,
  customFieldRosterEmptyAudience,
} from "./custom-field-roster.errors";
import {
  customFieldRosterRepository,
  type CustomFieldRosterFilter,
} from "./custom-field-roster.repository";
import { customFieldsRepository } from "../custom-fields/custom-fields.repository";
import type { z } from "zod";

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

function slugifyKey(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "learners"}-${Date.now().toString(36)}`;
}

function toFilter(
  input: Partial<{
    q?: string;
    email?: string;
    status?: string;
    signedUpFrom?: string;
    signedUpTo?: string;
    minTotalSpentCents?: number;
    maxTotalSpentCents?: number;
  }>,
): CustomFieldRosterFilter {
  const filter: CustomFieldRosterFilter = {};
  if (input.q) filter.q = input.q;
  if (input.email) filter.email = input.email;
  if (input.status) filter.status = input.status;
  if (input.signedUpFrom) filter.signedUpFrom = input.signedUpFrom;
  if (input.signedUpTo) filter.signedUpTo = input.signedUpTo;
  if (input.minTotalSpentCents != null) filter.minTotalSpentCents = input.minTotalSpentCents;
  if (input.maxTotalSpentCents != null) filter.maxTotalSpentCents = input.maxTotalSpentCents;
  return filter;
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

export async function listCustomFieldDefinitionsForReport(tx: TenantTx, _ctx: ServiceCtx) {
  const definitions = await customFieldRosterRepository.listFieldDefinitions(tx);
  return customFieldDefinitionsReportResponseSchema.parse({
    data: {
      items: definitions.map((definition) => ({
        id: definition.id,
        key: definition.key,
        label: definition.label,
        fieldType: definition.field_type,
      })),
    },
  });
}

function parseOptionsJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function roundPct(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

export async function listCustomFieldCatalogue(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: CustomFieldCatalogueQuery,
) {
  const rows = await customFieldRosterRepository.listFieldCatalogue(tx);
  const learnerCount = rows[0]?.learner_count ?? 0;

  const mapped = rows.map((row) => {
    const coveragePct =
      row.learner_count === 0 ? null : (row.filled_count / row.learner_count) * 100;
    const options = parseOptionsJson(row.options_json);
    const mostCommonValue = formatCustomValue(row.most_common_value_json);
    const mostCommonSharePct =
      row.filled_count > 0 && row.most_common_count > 0
        ? (row.most_common_count / row.filled_count) * 100
        : null;

    const isSelect = row.field_type === "select";
    const optionsUsedCount =
      isSelect && options.length > 0 ? Math.min(row.distinct_value_count, options.length) : null;
    const unusedOptions =
      isSelect &&
      options.length > 0 &&
      optionsUsedCount != null &&
      optionsUsedCount < options.length
        ? [
            `${options.length - optionsUsedCount} option${options.length - optionsUsedCount === 1 ? "" : "s"} unused`,
          ]
        : [];

    return {
      id: row.id,
      key: row.key,
      label: row.label,
      fieldType: row.field_type,
      status: row.status,
      options,
      learnerCount: row.learner_count,
      filledCount: row.filled_count,
      coveragePct: roundPct(coveragePct),
      distinctValueCount: row.distinct_value_count,
      optionsUsedCount,
      unusedOptions,
      mostCommonValue,
      mostCommonSharePct: roundPct(mostCommonSharePct),
      lastUpdatedAt: row.last_updated_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  });

  const activeFieldCount = mapped.filter((item) => item.status === "ACTIVE").length;
  const archivedFieldCount = mapped.filter((item) => item.status === "ARCHIVED").length;
  const coverageValues = mapped
    .filter((item) => item.status === "ACTIVE" && item.coveragePct != null)
    .map((item) => item.coveragePct as number);
  const averageCoveragePct =
    coverageValues.length === 0
      ? null
      : roundPct(coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length);
  const fullyCoveredFieldCount = mapped.filter(
    (item) => item.status === "ACTIVE" && item.coveragePct != null && item.coveragePct >= 100,
  ).length;
  const fieldsBelow40Coverage = mapped.filter(
    (item) => item.status === "ACTIVE" && item.coveragePct != null && item.coveragePct < 40,
  ).length;
  const neverUsedFieldCount = mapped.filter(
    (item) => item.status === "ACTIVE" && item.filledCount === 0,
  ).length;

  let filtered = mapped;

  if (query.q) {
    const needle = query.q.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) || item.key.toLowerCase().includes(needle),
    );
  }
  if (query.fieldType) {
    filtered = filtered.filter((item) => item.fieldType === query.fieldType);
  }
  if (query.status !== "ALL") {
    filtered = filtered.filter((item) => item.status === query.status);
  }
  if (query.coverage === "below_40") {
    filtered = filtered.filter(
      (item) => item.coveragePct != null && item.coveragePct < 40 && item.filledCount > 0,
    );
  } else if (query.coverage === "40_80") {
    filtered = filtered.filter(
      (item) => item.coveragePct != null && item.coveragePct >= 40 && item.coveragePct <= 80,
    );
  } else if (query.coverage === "above_80") {
    filtered = filtered.filter((item) => item.coveragePct != null && item.coveragePct > 80);
  } else if (query.coverage === "never_used") {
    filtered = filtered.filter((item) => item.filledCount === 0);
  }

  filtered = [...filtered].sort((a, b) => {
    if (query.sortBy === "label_asc") return a.label.localeCompare(b.label);
    if (query.sortBy === "created_desc") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const aCov = a.coveragePct ?? (a.filledCount === 0 ? -1 : 0);
    const bCov = b.coveragePct ?? (b.filledCount === 0 ? -1 : 0);
    if (query.sortBy === "coverage_desc") return bCov - aCov || a.label.localeCompare(b.label);
    return aCov - bCov || a.label.localeCompare(b.label);
  });

  return customFieldCatalogueResponseSchema.parse({
    data: {
      items: filtered,
      summary: {
        fieldsDefined: mapped.length,
        activeFieldCount,
        archivedFieldCount,
        averageCoveragePct,
        fullyCoveredFieldCount,
        fieldsBelow40Coverage,
        neverUsedFieldCount,
        learnerCount,
      },
    },
  });
}

export async function listCustomFieldRoster(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: CustomFieldRosterQuery,
) {
  const filter = toFilter({
    ...(query.q ? { q: query.q } : {}),
    ...(query.email ? { email: query.email } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.signedUpFrom ? { signedUpFrom: query.signedUpFrom } : {}),
    ...(query.signedUpTo ? { signedUpTo: query.signedUpTo } : {}),
    ...(query.minTotalSpentCents != null ? { minTotalSpentCents: query.minTotalSpentCents } : {}),
    ...(query.maxTotalSpentCents != null ? { maxTotalSpentCents: query.maxTotalSpentCents } : {}),
  });
  const [totalCount, rows, definitions, summaryRow] = await Promise.all([
    customFieldRosterRepository.countLearners(tx, filter),
    customFieldRosterRepository.listLearners(tx, query),
    customFieldRosterRepository.listFieldDefinitions(tx),
    customFieldRosterRepository.getCoverageSummary(tx, filter),
  ]);

  const membershipIds = rows.map((row) => row.membership_id);
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

  const averageCoveragePct =
    summaryRow.average_coverage_pct == null
      ? null
      : Math.round(summaryRow.average_coverage_pct * 10) / 10;

  return customFieldRosterListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        status: row.status,
        enrollmentCount: row.enrollment_count,
        totalSpentCents: row.total_spent_cents,
        currency: row.currency,
        lastActiveAt: row.last_active_at?.toISOString() ?? null,
        signedUpAt: row.signed_up_at?.toISOString() ?? null,
        customFields: {
          ...emptyCustom,
          ...(valuesByMembership.get(row.membership_id) ?? {}),
        },
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
      fieldDefinitions: definitions.map((definition) => ({
        id: definition.id,
        key: definition.key,
        label: definition.label,
        fieldType: definition.field_type,
      })),
      summary: {
        learnerCount: summaryRow.learner_count,
        activeLearnerCount: summaryRow.active_learner_count,
        inactiveLearnerCount: summaryRow.inactive_learner_count,
        customFieldCount: summaryRow.custom_field_count,
        averageCoveragePct,
        learnersWithAllFieldsFilled: summaryRow.learners_with_all_fields_filled,
        fieldsBelow40Coverage: summaryRow.fields_below_40_coverage,
      },
    },
  });
}

export async function resolveCustomFieldMembershipIds(
  tx: TenantTx,
  input: {
    membershipIds?: string[];
    q?: string;
    email?: string;
    status?: string;
    signedUpFrom?: string;
    signedUpTo?: string;
    minTotalSpentCents?: number;
    maxTotalSpentCents?: number;
  },
): Promise<string[]> {
  if (input.membershipIds && input.membershipIds.length > 0) {
    return [...new Set(input.membershipIds)];
  }
  const membershipIds = await customFieldRosterRepository.listMembershipIds(tx, toFilter(input));
  if (membershipIds.length === 0) throw customFieldRosterEmptyAudience();
  return membershipIds;
}

export async function createCustomFieldLearnerGroup(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: {
    title: string;
    description?: string;
    syncType?: "static" | "live";
    criteriaSummary?: string;
    membershipIds?: string[];
    q?: string;
    email?: string;
    status?: string;
    signedUpFrom?: string;
    signedUpTo?: string;
    minTotalSpentCents?: number;
    maxTotalSpentCents?: number;
  },
) {
  const membershipIds = await resolveCustomFieldMembershipIds(tx, input);
  const createdByLabel = null;
  const criteriaParts: string[] = [];
  if (input.q) criteriaParts.push(`Search: ${input.q}`);
  if (input.email) criteriaParts.push(`Email: ${input.email}`);
  if (input.status) criteriaParts.push(`Status: ${input.status}`);
  if (input.signedUpFrom || input.signedUpTo) {
    criteriaParts.push(`Signed up ${input.signedUpFrom ?? "…"} → ${input.signedUpTo ?? "…"}`);
  }
  if (input.minTotalSpentCents != null || input.maxTotalSpentCents != null) {
    criteriaParts.push(`Spend ${input.minTotalSpentCents ?? 0}–${input.maxTotalSpentCents ?? "∞"}`);
  }

  const batch = await batchesRepository.insertBatch(tx, {
    key: slugifyKey(input.title),
    name: input.title,
    status: "ACTIVE",
    metadataJson: {
      source: "custom_field_report",
      description: input.description ?? null,
      createdFrom: "reports.custom-field",
      syncType: input.syncType ?? "static",
      criteriaSummary: input.criteriaSummary ?? (criteriaParts.join(" · ") || null),
      createdByLabel,
      createdByMembershipId: ctx.actorMembershipId,
    },
  });

  let memberCount = 0;
  for (const membershipId of membershipIds) {
    await batchesRepository.assignMember(tx, { batchId: batch.id, membershipId });
    memberCount += 1;
  }

  return createCustomFieldGroupResponseSchema.parse({
    data: {
      batchId: batch.id,
      key: batch.key,
      name: batch.name,
      memberCount,
    },
  });
}

function medianOf(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? null;
}

function stdDevOf(values: number[], mean: number): number | null {
  if (values.length < 2) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function buildNumberBuckets(
  values: number[],
): Array<{ label: string; min: number; max: number; count: number }> {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: formatBucketLabel(min, max), min, max, count: values.length }];
  }
  const bucketCount = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(values.length))));
  const width = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketMin = min + index * width;
    const bucketMax = index === bucketCount - 1 ? max : min + (index + 1) * width;
    return {
      label: formatBucketLabel(bucketMin, bucketMax),
      min: bucketMin,
      max: bucketMax,
      count: 0,
    };
  });
  for (const value of values) {
    let index = Math.floor((value - min) / width);
    if (index >= bucketCount) index = bucketCount - 1;
    if (index < 0) index = 0;
    const bucket = buckets[index];
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

function formatBucketLabel(min: number, max: number): string {
  const fmt = (n: number) => {
    if (Math.abs(n) >= 1000) {
      return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    }
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };
  return `${fmt(min)}–${fmt(max)}`;
}

function buildStrongestAssociation(
  rowValues: string[],
  columnValues: string[],
  cells: number[][],
  grandTotal: number,
): string | null {
  if (grandTotal === 0 || rowValues.length === 0 || columnValues.length === 0) return null;
  let best: { row: string; col: string; count: number; lift: number } | null = null;
  const rowTotals = cells.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = columnValues.map((_, colIndex) =>
    cells.reduce((sum, row) => sum + (row[colIndex] ?? 0), 0),
  );
  for (let r = 0; r < rowValues.length; r += 1) {
    for (let c = 0; c < columnValues.length; c += 1) {
      const count = cells[r]?.[c] ?? 0;
      if (count === 0) continue;
      const expected = ((rowTotals[r] ?? 0) * (colTotals[c] ?? 0)) / grandTotal;
      const lift = expected > 0 ? count / expected : count;
      if (!best || lift > best.lift || (lift === best.lift && count > best.count)) {
        best = {
          row: rowValues[r] ?? "",
          col: columnValues[c] ?? "",
          count,
          lift,
        };
      }
    }
  }
  if (!best) return null;
  return `Strongest overlap: “${best.row}” × “${best.col}” (${best.count.toLocaleString()} learners).`;
}

export async function getCustomFieldDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  fieldKey: string,
  query: CustomFieldDetailQuery,
) {
  const definition = await customFieldRosterRepository.getFieldDefinitionByKey(tx, fieldKey);
  if (!definition) {
    throw customFieldDetailNotFound();
  }

  const options = parseOptionsJson(definition.options_json);
  const summaryRow = await customFieldRosterRepository.getFieldDetailSummary(tx, definition.id);
  const filledCount = summaryRow.filled_count;
  const learnerCount = summaryRow.learner_count;
  const missingCount = Math.max(0, learnerCount - filledCount);
  const coveragePct = learnerCount === 0 ? null : roundPct((filledCount / learnerCount) * 100);
  const mostCommonValue = formatCustomValue(summaryRow.most_common_value_json);
  const mostCommonSharePct =
    filledCount > 0 && summaryRow.most_common_count > 0
      ? roundPct((summaryRow.most_common_count / filledCount) * 100)
      : null;

  const valueCounts = await customFieldRosterRepository.listFieldValueCounts(tx, definition.id);
  const compareCandidates = (await customFieldRosterRepository.listFieldDefinitions(tx)).filter(
    (item) => item.key !== definition.key && item.field_type === "select",
  );

  let selectPayload: z.output<typeof customFieldDetailSelectSchema> | null = null;
  let numberPayload: z.output<typeof customFieldDetailNumberSchema> | null = null;
  let booleanPayload: z.output<typeof customFieldDetailBooleanSchema> | null = null;
  let textPayload: z.output<typeof customFieldDetailTextSchema> | null = null;
  let crossTabPayload: z.output<typeof customFieldDetailCrossTabSchema> | null = null;

  if (definition.field_type === "select") {
    const countByValue = new Map(valueCounts.map((row) => [row.value_text, row.count]));
    const optionRows = options.map((value) => {
      const count = countByValue.get(value) ?? 0;
      return {
        value,
        count,
        sharePct: filledCount > 0 ? roundPct((count / filledCount) * 100) : null,
        unused: count === 0,
      };
    });
    const optionSet = new Set(options);
    const orphaned = valueCounts
      .filter((row) => !optionSet.has(row.value_text))
      .map((row) => ({ value: row.value_text, count: row.count }));
    selectPayload = {
      options: optionRows,
      orphaned,
      unusedDefinedCount: optionRows.filter((row) => row.unused).length,
    };
  } else if (definition.field_type === "number") {
    const numericRows = await customFieldRosterRepository.listNumericFieldValues(tx, definition.id);
    const values = numericRows.map((row) => row.num_value).sort((a, b) => a - b);
    const sum = values.reduce((acc, value) => acc + value, 0);
    const mean = values.length > 0 ? sum / values.length : null;
    const median = medianOf(values);
    const stdDev = mean == null ? null : stdDevOf(values, mean);
    const withScores = numericRows.map((row) => {
      const zScore =
        mean == null || stdDev == null || stdDev === 0 ? null : (row.num_value - mean) / stdDev;
      return { ...row, zScore };
    });
    const sortedAsc = [...withScores].sort((a, b) => a.num_value - b.num_value);
    const outliersLow = sortedAsc.slice(0, 5).map((row) => ({
      membershipId: row.membership_id,
      learnerName: row.learner_name,
      email: row.email,
      value: row.num_value,
      zScore: row.zScore == null ? null : Math.round(row.zScore * 10) / 10,
    }));
    const outliersHigh = [...sortedAsc]
      .reverse()
      .slice(0, 5)
      .map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        value: row.num_value,
        zScore: row.zScore == null ? null : Math.round(row.zScore * 10) / 10,
      }));
    numberPayload = {
      buckets: buildNumberBuckets(values),
      stats: {
        min: values.length > 0 ? (values[0] ?? null) : null,
        max: values.length > 0 ? (values[values.length - 1] ?? null) : null,
        mean: mean == null ? null : Math.round(mean * 100) / 100,
        median: median == null ? null : Math.round(median * 100) / 100,
        stdDev: stdDev == null ? null : Math.round(stdDev * 100) / 100,
        sum: values.length > 0 ? Math.round(sum * 100) / 100 : null,
      },
      outliersHigh,
      outliersLow,
    };
  } else if (definition.field_type === "boolean") {
    const isYes = (value: string) => ["true", "yes", "1"].includes(value.toLowerCase());
    const isNo = (value: string) => ["false", "no", "0"].includes(value.toLowerCase());
    const resolvedYes = valueCounts
      .filter((row) => isYes(row.value_text))
      .reduce((sum, row) => sum + row.count, 0);
    const resolvedNo = valueCounts
      .filter((row) => isNo(row.value_text))
      .reduce((sum, row) => sum + row.count, 0);
    const trendRows = await customFieldRosterRepository.listBooleanWeeklyTrend(tx, definition.id);
    const trend = trendRows.map((row) => {
      const total = row.yes_count + row.no_count;
      return {
        weekStart: row.week_start.toISOString(),
        yesCount: row.yes_count,
        noCount: row.no_count,
        yesSharePct: total > 0 ? roundPct((row.yes_count / total) * 100) : null,
      };
    });
    const firstShare = trend.find((point) => point.yesSharePct != null)?.yesSharePct ?? null;
    const lastShare =
      [...trend].reverse().find((point) => point.yesSharePct != null)?.yesSharePct ?? null;
    let trendCaption: string | null = null;
    if (firstShare != null && lastShare != null) {
      const delta = Math.round((lastShare - firstShare) * 10) / 10;
      if (delta > 0) trendCaption = `Yes share up ${delta} pts over 12 weeks.`;
      else if (delta < 0) trendCaption = `Yes share down ${Math.abs(delta)} pts over 12 weeks.`;
      else trendCaption = "Yes share held steady over 12 weeks.";
    }
    booleanPayload = {
      yesCount: resolvedYes,
      noCount: resolvedNo,
      missingCount,
      yesSharePct: learnerCount > 0 ? roundPct((resolvedYes / learnerCount) * 100) : null,
      noSharePct: learnerCount > 0 ? roundPct((resolvedNo / learnerCount) * 100) : null,
      missingSharePct: learnerCount > 0 ? roundPct((missingCount / learnerCount) * 100) : null,
      trend,
      trendCaption,
    };
  } else {
    textPayload = {
      topValues: valueCounts.slice(0, 12).map((row) => ({
        value: row.value_text,
        count: row.count,
        sharePct: filledCount > 0 ? roundPct((row.count / filledCount) * 100) : null,
      })),
    };
  }

  if (definition.field_type === "select") {
    const compareKey = query.compareWith ?? compareCandidates[0]?.key ?? null;
    if (compareKey) {
      const other = await customFieldRosterRepository.getFieldDefinitionByKey(tx, compareKey);
      if (other && other.field_type === "select") {
        const otherOptions = parseOptionsJson(other.options_json);
        const pairs = await customFieldRosterRepository.listCrossTabCounts(
          tx,
          definition.id,
          other.id,
        );
        const rowValues =
          options.length > 0 ? options : [...new Set(pairs.map((pair) => pair.row_value))].sort();
        const columnValues =
          otherOptions.length > 0
            ? otherOptions
            : [...new Set(pairs.map((pair) => pair.col_value))].sort();
        const countMap = new Map(
          pairs.map((pair) => [`${pair.row_value}||${pair.col_value}`, pair.count]),
        );
        const cells = rowValues.map((rowValue) =>
          columnValues.map((colValue) => countMap.get(`${rowValue}||${colValue}`) ?? 0),
        );
        const rowTotals = cells.map((row) => row.reduce((a, b) => a + b, 0));
        const columnTotals = columnValues.map((_, colIndex) =>
          cells.reduce((sum, row) => sum + (row[colIndex] ?? 0), 0),
        );
        const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
        crossTabPayload = {
          otherField: {
            key: other.key,
            label: other.label,
            options: otherOptions,
          },
          rowValues,
          columnValues,
          cells,
          rowTotals,
          columnTotals,
          grandTotal,
          strongestAssociation: buildStrongestAssociation(
            rowValues,
            columnValues,
            cells,
            grandTotal,
          ),
        };
      }
    }
  }

  const learnerFilter = {
    definitionId: definition.id,
    ...(query.q ? { q: query.q } : {}),
    ...(query.valueFilter ? { valueFilter: query.valueFilter } : {}),
    ...(query.minValue != null ? { minValue: query.minValue } : {}),
    ...(query.maxValue != null ? { maxValue: query.maxValue } : {}),
  };
  const totalLearners = await customFieldRosterRepository.countFieldDetailLearners(
    tx,
    learnerFilter,
  );
  const learnerRows = await customFieldRosterRepository.listFieldDetailLearners(tx, {
    ...learnerFilter,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  });

  return customFieldDetailResponseSchema.parse({
    data: {
      field: {
        id: definition.id,
        key: definition.key,
        label: definition.label,
        fieldType: definition.field_type,
        status: definition.status,
        options,
        createdAt: definition.created_at.toISOString(),
      },
      summary: {
        learnerCount,
        filledCount,
        missingCount,
        coveragePct,
        distinctValueCount: summaryRow.distinct_value_count,
        mostCommonValue,
        mostCommonSharePct,
        lastUpdatedAt: summaryRow.last_updated_at?.toISOString() ?? null,
      },
      neverUsed: filledCount === 0,
      select: selectPayload,
      number: numberPayload,
      boolean: booleanPayload,
      text: textPayload,
      crossTab: crossTabPayload,
      compareFields: compareCandidates.map((item) => ({
        key: item.key,
        label: item.label,
        fieldType: item.field_type,
      })),
      learners: {
        items: learnerRows.map((row) => ({
          membershipId: row.membership_id,
          learnerName: row.learner_name,
          email: row.email,
          status: row.status,
          enrollmentCount: row.enrollment_count,
          totalSpentCents: row.total_spent_cents,
          currency: row.currency,
          lastActiveAt: row.last_active_at?.toISOString() ?? null,
          signedUpAt: row.signed_up_at?.toISOString() ?? null,
          fieldValue: row.field_value,
        })),
        pageInfo: pageInfo(totalLearners, query.page, query.limit),
      },
    },
  });
}

function isFilledValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) return isFilledValue(record["value"]);
    try {
      const text = JSON.stringify(value);
      return text !== "null" && text !== '""' && text !== "[]" && text !== "{}";
    } catch {
      return false;
    }
  }
  return false;
}

function buildAuditCaption(args: {
  filled: boolean;
  updatedAt: Date | null;
  updatedByName: string | null;
}): string {
  if (!args.filled) return "Never set";
  if (args.updatedByName) return `Set by ${args.updatedByName}`;
  if (args.updatedAt) {
    return `Updated ${args.updatedAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  }
  return "Set";
}

export async function getCustomFieldLearnerDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  membershipId: string,
) {
  const learner = await customFieldRosterRepository.findLearnerSummary(tx, membershipId);
  if (!learner) throw customFieldLearnerNotFound();

  let fieldRows: Awaited<ReturnType<typeof customFieldRosterRepository.listLearnerFieldValues>>;
  let historyRows: Awaited<ReturnType<typeof customFieldRosterRepository.listLearnerFieldHistory>>;

  try {
    fieldRows = await customFieldRosterRepository.listLearnerFieldValues(tx, membershipId);
  } catch {
    fieldRows = [];
  }

  try {
    historyRows = await customFieldRosterRepository.listLearnerFieldHistory(tx, membershipId, 50);
  } catch {
    historyRows = [];
  }

  const fields = fieldRows.map((row) => {
    const filled = isFilledValue(row.value_json);
    return {
      definitionId: row.definition_id,
      key: row.key,
      label: row.label,
      fieldType: row.field_type,
      status: row.status,
      options: parseOptionsJson(row.options_json),
      value: filled ? formatCustomValue(row.value_json) : null,
      valueJson: filled ? row.value_json : null,
      filled,
      updatedAt: row.updated_at?.toISOString() ?? null,
      updatedByName: row.updated_by_name,
      auditCaption: buildAuditCaption({
        filled,
        updatedAt: row.updated_at,
        updatedByName: row.updated_by_name,
      }),
    };
  });

  const fieldCount = fields.length;
  const filledCount = fields.filter((field) => field.filled).length;
  const missingCount = Math.max(0, fieldCount - filledCount);
  const completenessPct = fieldCount === 0 ? null : roundPct((filledCount / fieldCount) * 100);

  return customFieldLearnerDetailResponseSchema.parse({
    data: {
      learner: {
        membershipId: learner.membership_id,
        learnerName: learner.learner_name,
        email: learner.email,
        status: learner.status,
        avatarUrl: null,
        enrollmentCount: learner.enrollment_count,
        totalSpentCents: learner.total_spent_cents,
        currency: learner.currency,
        lastActiveAt: learner.last_active_at?.toISOString() ?? null,
        signedUpAt: learner.signed_up_at?.toISOString() ?? null,
      },
      summary: {
        fieldCount,
        filledCount,
        missingCount,
        completenessPct,
      },
      fields,
      history: historyRows.map((row) => ({
        id: row.id,
        definitionId: row.definition_id,
        fieldKey: row.field_key,
        fieldLabel: row.field_label,
        fieldType: row.field_type,
        oldValue: formatCustomValue(row.old_value_json),
        newValue: formatCustomValue(row.new_value_json),
        changedAt: row.changed_at.toISOString(),
        changedByName: row.changed_by_name,
      })),
      zeroFieldsDefined: fieldCount === 0,
      noValuesSet: fieldCount > 0 && filledCount === 0,
    },
  });
}

export async function updateCustomFieldLearnerValues(
  tx: TenantTx,
  ctx: ServiceCtx,
  membershipId: string,
  body: UpdateCustomFieldLearnerValuesBody,
) {
  const learner = await customFieldRosterRepository.findLearnerSummary(tx, membershipId);
  if (!learner) throw customFieldLearnerNotFound();

  let updatedCount = 0;
  let clearedCount = 0;

  for (const item of body.values) {
    const definition = await customFieldsRepository.findDefinitionById(tx, item.definitionId);
    if (!definition) throw customFieldDetailNotFound();

    if (item.valueJson == null || !isFilledValue(item.valueJson)) {
      const cleared = await customFieldsRepository.clearValue(tx, {
        definitionId: item.definitionId,
        membershipId,
        updatedByMembershipId: ctx.actorMembershipId,
      });
      if (cleared) clearedCount += 1;
      continue;
    }

    await customFieldsRepository.upsertValue(tx, {
      definitionId: item.definitionId,
      membershipId,
      valueJson: item.valueJson,
      updatedByMembershipId: ctx.actorMembershipId,
    });
    updatedCount += 1;
  }

  return updateCustomFieldLearnerValuesResponseSchema.parse({
    data: { updatedCount, clearedCount },
  });
}
