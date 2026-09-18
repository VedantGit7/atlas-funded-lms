// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import type {
  LocaleImportBody,
  LocaleImportPreviewBody,
  UpdateLocaleReviewBody,
  UpsertLocaleMetadataBody,
  UpsertLocaleResourcesBody,
} from "./locale.dto";
import { buildImportPreview, runLocaleQaChecks } from "./locale.qa";
import { localeRepository } from "./locale.repository";
import type {
  LocaleMetadataRow,
  LocaleQaIssueRow,
  LocaleResourceDto,
  LocaleResourceRow,
  ServiceCtx,
} from "./locale.types";

function mapResourceDto(row: LocaleResourceRow): LocaleResourceDto {
  return {
    locale: row.locale,
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at.toISOString(),
    reviewStatus: row.review_status,
  };
}

function mapMetadataDto(row: LocaleMetadataRow) {
  return {
    locale: row.locale,
    nativeName: row.native_name,
    isRtl: row.is_rtl,
    isDefault: row.is_default,
    isFallback: row.is_fallback,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapQaIssueDto(row: LocaleQaIssueRow) {
  return {
    id: row.id,
    locale: row.locale,
    key: row.key,
    severity: row.severity,
    issueType: row.issue_type,
    message: row.message,
    createdAt: row.created_at.toISOString(),
  };
}

function mapQaRunDto(row: {
  id: string;
  issue_count: number;
  started_at: Date;
  completed_at: Date;
}) {
  return {
    id: row.id,
    issueCount: row.issue_count,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at.toISOString(),
  };
}

async function resolveSourceLocale(tx: TenantTx, tenantId: string): Promise<string> {
  const metadata = await localeRepository.listMetadata(tx, tenantId);
  const defaultFromMetadata = metadata.find((row) => row.is_default)?.locale;
  if (defaultFromMetadata) return defaultFromMetadata;
  return localeRepository.getTenantDefaultLocale(tx, tenantId);
}

async function resolveFallbackLocale(tx: TenantTx, tenantId: string): Promise<string | null> {
  const metadata = await localeRepository.listMetadata(tx, tenantId);
  return metadata.find((row) => row.is_fallback)?.locale ?? null;
}

async function registerCanonicalKeysForLocale(
  tx: TenantTx,
  tenantId: string,
  locale: string,
  keys: string[],
) {
  const sourceLocale = await resolveSourceLocale(tx, tenantId);
  if (locale !== sourceLocale) return;

  for (const key of keys) {
    await localeRepository.upsertCanonicalKey(tx, {
      tenantId,
      key,
      sourceLocale,
    });
  }
}

function buildResourceMap(rows: LocaleResourceRow[]): Map<string, string> {
  return new Map(rows.map((row) => [row.key, row.value]));
}

function buildLocaleResourceMaps(rows: LocaleResourceRow[]): Map<string, Map<string, string>> {
  const byLocale = new Map<string, Map<string, string>>();
  for (const row of rows) {
    const localeMap = byLocale.get(row.locale) ?? new Map<string, string>();
    localeMap.set(row.key, row.value);
    byLocale.set(row.locale, localeMap);
  }
  return byLocale;
}

export async function listLocaleResources(tx: TenantTx, ctx: ServiceCtx) {
  const rows = await localeRepository.listResources(tx, ctx.tenantId);
  return { data: rows.map(mapResourceDto) };
}

export async function upsertLocaleResources(
  tx: TenantTx,
  ctx: ServiceCtx,
  locale: string,
  input: UpsertLocaleResourcesBody,
) {
  const updated: LocaleResourceDto[] = [];

  for (const resource of input.resources) {
    const row = await localeRepository.upsertResource(tx, {
      tenantId: ctx.tenantId,
      locale,
      key: resource.key,
      value: resource.value,
      resetReview: true,
    });
    updated.push(mapResourceDto(row));
  }

  await registerCanonicalKeysForLocale(
    tx,
    ctx.tenantId,
    locale,
    input.resources.map((resource) => resource.key),
  );

  return { data: updated };
}

export async function deleteLocaleResource(
  tx: TenantTx,
  ctx: ServiceCtx,
  locale: string,
  key: string,
) {
  const deleted = await localeRepository.deleteResource(tx, ctx.tenantId, locale, key);
  if (!deleted) {
    throw new Error("Locale resource not found.");
  }

  return {
    data: {
      locale,
      key,
      deleted: true as const,
    },
  };
}

export async function listLocaleMetadata(tx: TenantTx, ctx: ServiceCtx) {
  const rows = await localeRepository.listMetadata(tx, ctx.tenantId);
  return { data: rows.map(mapMetadataDto) };
}

export async function upsertLocaleMetadata(
  tx: TenantTx,
  ctx: ServiceCtx,
  locale: string,
  input: UpsertLocaleMetadataBody,
) {
  const existing = await localeRepository.getMetadataByLocale(tx, ctx.tenantId, locale);

  if (input.isDefault) {
    await localeRepository.clearDefaultLocaleFlags(tx, ctx.tenantId);
  }
  if (input.isFallback) {
    await localeRepository.clearFallbackLocaleFlags(tx, ctx.tenantId);
  }

  const row = await localeRepository.upsertMetadata(tx, {
    tenantId: ctx.tenantId,
    locale,
    nativeName: input.nativeName !== undefined ? input.nativeName : (existing?.native_name ?? null),
    isRtl: input.isRtl ?? existing?.is_rtl ?? false,
    isDefault: input.isDefault ?? existing?.is_default ?? false,
    isFallback: input.isFallback ?? existing?.is_fallback ?? false,
  });

  return { data: mapMetadataDto(row) };
}

export async function deleteLocaleMetadata(tx: TenantTx, ctx: ServiceCtx, locale: string) {
  const existing = await localeRepository.getMetadataByLocale(tx, ctx.tenantId, locale);
  if (!existing) {
    throw new Error("Language not found.");
  }
  if (existing.is_default) {
    throw new Error("Cannot remove the default language. Set another language as default first.");
  }

  await localeRepository.deleteMetadata(tx, ctx.tenantId, locale);

  return {
    data: {
      locale,
      deleted: true as const,
    },
  };
}

export async function listLocaleCanonicalKeys(tx: TenantTx, ctx: ServiceCtx) {
  const rows = await localeRepository.listCanonicalKeys(tx, ctx.tenantId);
  return {
    data: rows.map((row) => ({
      key: row.key,
      sourceLocale: row.source_locale,
      description: row.description,
      updatedAt: row.updated_at.toISOString(),
    })),
  };
}

export async function getLocaleCoverage(tx: TenantTx, ctx: ServiceCtx) {
  const canonicalKeys = await localeRepository.listCanonicalKeys(tx, ctx.tenantId);
  const resources = await localeRepository.listResources(tx, ctx.tenantId);
  const localeMaps = buildLocaleResourceMaps(resources);
  const locales = [...new Set(resources.map((row) => row.locale))].sort();

  const data = locales.map((locale) => {
    const localeValues = localeMaps.get(locale) ?? new Map<string, string>();
    const missingKeys = canonicalKeys
      .map((entry) => entry.key)
      .filter((key) => !localeValues.has(key));
    const translatedCount = canonicalKeys.length - missingKeys.length;
    const coveragePercent =
      canonicalKeys.length === 0 ? 100 : Math.round((translatedCount / canonicalKeys.length) * 100);

    return {
      locale,
      totalCanonicalKeys: canonicalKeys.length,
      translatedCount,
      coveragePercent,
      missingKeys,
    };
  });

  return { data };
}

export async function getLocaleOverview(tx: TenantTx, ctx: ServiceCtx) {
  const [resources, canonicalKeys, pendingReviewCount, latestRun, defaultLocale, fallbackLocale] =
    await Promise.all([
      localeRepository.listResources(tx, ctx.tenantId),
      localeRepository.listCanonicalKeys(tx, ctx.tenantId),
      localeRepository.countPendingReviews(tx, ctx.tenantId),
      localeRepository.getLatestQaCheckRun(tx, ctx.tenantId),
      resolveSourceLocale(tx, ctx.tenantId),
      resolveFallbackLocale(tx, ctx.tenantId),
    ]);

  const localeCount = new Set(resources.map((row) => row.locale)).size;
  let qaIssueCount = 0;
  if (latestRun) {
    qaIssueCount = latestRun.issue_count;
  }

  return {
    data: {
      localeCount,
      resourceCount: resources.length,
      canonicalKeyCount: canonicalKeys.length,
      pendingReviewCount,
      qaIssueCount,
      lastQaRunAt: latestRun?.completed_at.toISOString() ?? null,
      defaultLocale,
      fallbackLocale,
    },
  };
}

export async function listLocaleReviewQueue(tx: TenantTx, ctx: ServiceCtx) {
  const sourceLocale = await resolveSourceLocale(tx, ctx.tenantId);
  const [rows, sourceResources] = await Promise.all([
    localeRepository.listReviewQueue(tx, ctx.tenantId),
    localeRepository.listResourcesByLocale(tx, ctx.tenantId, sourceLocale),
  ]);
  const sourceMap = buildResourceMap(sourceResources);

  return {
    data: rows.map((row) => ({
      locale: row.locale,
      key: row.key,
      value: row.value,
      reviewStatus: row.review_status,
      sourceValue: row.locale === sourceLocale ? row.value : (sourceMap.get(row.key) ?? null),
      updatedAt: row.updated_at.toISOString(),
    })),
  };
}

export async function updateLocaleReview(
  tx: TenantTx,
  ctx: ServiceCtx,
  locale: string,
  key: string,
  input: UpdateLocaleReviewBody,
) {
  const row = await localeRepository.updateReviewStatus(tx, {
    tenantId: ctx.tenantId,
    locale,
    key,
    status: input.status,
    reviewedBy: ctx.actorMembershipId,
  });

  if (!row) {
    throw new Error("Locale resource not found.");
  }

  const sourceLocale = await resolveSourceLocale(tx, ctx.tenantId);
  const sourceResource = await localeRepository.getResource(tx, ctx.tenantId, sourceLocale, key);

  return {
    data: {
      locale: row.locale,
      key: row.key,
      value: row.value,
      reviewStatus: row.review_status,
      sourceValue: row.locale === sourceLocale ? row.value : (sourceResource?.value ?? null),
      updatedAt: row.updated_at.toISOString(),
    },
  };
}

export async function getLocaleQaChecks(tx: TenantTx, ctx: ServiceCtx) {
  const latestRun = await localeRepository.getLatestQaCheckRun(tx, ctx.tenantId);
  if (!latestRun) {
    return { data: { run: null, issues: [] } };
  }

  const issues = await localeRepository.listQaIssuesForRun(tx, ctx.tenantId, latestRun.id);
  return {
    data: {
      run: mapQaRunDto(latestRun),
      issues: issues.map(mapQaIssueDto),
    },
  };
}

export async function runLocaleQaChecksForTenant(tx: TenantTx, ctx: ServiceCtx) {
  const [canonicalKeys, resources, sourceLocale] = await Promise.all([
    localeRepository.listCanonicalKeys(tx, ctx.tenantId),
    localeRepository.listResources(tx, ctx.tenantId),
    resolveSourceLocale(tx, ctx.tenantId),
  ]);

  const canonicalKeyList = canonicalKeys.map((entry) => entry.key);
  const localeMaps = buildLocaleResourceMaps(resources);
  const sourceValues = localeMaps.get(sourceLocale) ?? new Map<string, string>();
  const targetLocales = [...localeMaps.keys()].sort();

  const issueDrafts = runLocaleQaChecks({
    canonicalKeys: canonicalKeyList,
    sourceLocale,
    sourceValues,
    localeValuesByLocale: localeMaps,
    targetLocales,
  });

  const run = await localeRepository.createQaCheckRun(tx, {
    tenantId: ctx.tenantId,
    startedBy: ctx.actorMembershipId,
    issueCount: issueDrafts.length,
  });

  const issues = await localeRepository.insertQaIssues(tx, {
    tenantId: ctx.tenantId,
    runId: run.id,
    issues: issueDrafts.map((issue) => ({
      locale: issue.locale,
      key: issue.key,
      severity: issue.severity,
      issueType: issue.issue_type,
      message: issue.message,
    })),
  });

  return {
    data: {
      run: mapQaRunDto(run),
      issues: issues.map(mapQaIssueDto),
    },
  };
}

export async function previewLocaleImport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: LocaleImportPreviewBody,
) {
  const existingRows = await localeRepository.listResourcesByLocale(tx, ctx.tenantId, input.locale);
  const existing = buildResourceMap(existingRows);
  const preview = buildImportPreview({
    locale: input.locale,
    incoming: input.resources,
    existing,
  });
  return { data: preview };
}

export async function importLocaleResources(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: LocaleImportBody,
) {
  const updated = await upsertLocaleResources(tx, ctx, input.locale, {
    resources: input.resources,
  });
  return {
    data: {
      locale: input.locale,
      applied: updated.data.length,
      resources: updated.data,
    },
  };
}

export async function exportLocaleResources(tx: TenantTx, ctx: ServiceCtx, locale: string) {
  const rows = await localeRepository.listResourcesByLocale(tx, ctx.tenantId, locale);
  return {
    data: {
      locale,
      format: "json" as const,
      resources: rows.map((row) => ({ key: row.key, value: row.value })),
      exportedAt: new Date().toISOString(),
    },
  };
}
