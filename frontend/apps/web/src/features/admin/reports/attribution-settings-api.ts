import { clientApi } from "../../../lib/client-api";

/**
 * The things that actually govern the attribution log.
 *
 * There is no attribution-specific configuration in this system: no attribution
 * window, no model toggle, no per-tenant tracking switch. What does govern the
 * log lives in two places that already have their own editors — the marketing
 * tracking snippets and the shared export settings — so this module only reads
 * them. Building a second editor for either would guarantee the two drift.
 *
 * The three reads sit behind three different permissions, so each is fetched
 * and reported independently; a reports-only admin can see the log's health
 * without seeing the tracking configuration.
 */

/** The three script slots that fire the beacon. */
export type AttributionSnippets = {
  siteBodyHtml: string | null;
  orderTrackingHtml: string | null;
  signupTrackingHtml: string | null;
  updatedAt: string | null;
};

/** A section either loaded, was refused, or failed — and they are not the same. */
export type SectionResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

async function readSection<T>(load: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { kind: "ok", data: await load() };
  } catch (caught) {
    // A refusal is not a failure. Rendering "could not load" over a permission
    // boundary sends an operator hunting for an outage that is not there.
    const status = (caught as { status?: number }).status;
    if (status === 403 || status === 401) return { kind: "forbidden" };
    const message = (caught as { message?: string }).message;
    return {
      kind: "error",
      message: typeof message === "string" && message ? message : "Could not be read.",
    };
  }
}

/**
 * The tracking snippets, read only.
 *
 * Gated on `config.update` — the same permission that edits them — so an
 * operator who can read the attribution log may still be refused here.
 */
export async function fetchAttributionSnippets(): Promise<SectionResult<AttributionSnippets>> {
  return await readSection(async () => {
    const response = await clientApi.get<{ data: AttributionSnippets }>(
      "/api/v1/marketing/integrations/snippets",
    );
    return response.data;
  });
}

/** The export retention and personal-data rules that apply to attribution exports. */
export type AttributionExportRules = {
  fileRetentionValue: number;
  fileRetentionUnit: string;
  runRecordRetention: string;
  maxRowsPerExport: number;
  requireReasonForPii: boolean;
  personalDataTreatments: Record<string, string>;
};

export async function fetchAttributionExportRules(): Promise<
  SectionResult<AttributionExportRules>
> {
  return await readSection(async () => {
    const response = await clientApi.get<{ data: { settings: AttributionExportRules } }>(
      "/api/v1/reports/exports/settings",
    );
    return response.data.settings;
  });
}

/**
 * Retention for the event log.
 *
 * `retentionDays: null` is the "keep everything" choice and the default — this
 * log has history in live tenants, so a finite default would delete real data.
 */
export type AttributionRetention = {
  retentionDays: number | null;
  updatedAt: string | null;
  updatedByName: string | null;
  totalEvents: number;
  /** What the current setting would delete on the next sweep. */
  deletableNow: number;
  oldestOccurredAt: string | null;
  minRetentionDays: number;
  maxRetentionDays: number;
};

export async function fetchAttributionRetention(): Promise<SectionResult<AttributionRetention>> {
  return await readSection(async () => {
    const response = await clientApi.get<{ data: AttributionRetention }>(
      "/api/v1/sales/attribution/retention",
    );
    return response.data;
  });
}

export type AttributionRetentionPreview = {
  retentionDays: number | null;
  totalEvents: number;
  deletable: number;
  oldestOccurredAt: string | null;
};

/** What a window would delete, asked before anything is saved. */
export async function previewAttributionRetention(
  retentionDays: number | null,
): Promise<AttributionRetentionPreview> {
  const params = new URLSearchParams();
  if (retentionDays !== null) params.set("retentionDays", String(retentionDays));
  const query = params.toString();
  const response = await clientApi.get<{ data: AttributionRetentionPreview }>(
    query
      ? `/api/v1/sales/attribution/retention/preview?${query}`
      : "/api/v1/sales/attribution/retention/preview",
  );
  return response.data;
}

export async function saveAttributionRetention(
  retentionDays: number | null,
): Promise<AttributionRetention> {
  const response = await clientApi.put<{ data: AttributionRetention }>(
    "/api/v1/sales/attribution/retention",
    { retentionDays },
    "attribution-retention-set",
    { successMessage: "Retention window saved." },
  );
  return response.data;
}

export async function purgeAttributionEventsNow(): Promise<{
  deleted: number;
  moreRemaining: boolean;
}> {
  const response = await clientApi.post<{
    data: { deleted: number; moreRemaining: boolean };
  }>("/api/v1/sales/attribution/retention/purge", {}, "attribution-retention-purge", {
    successMessage: "Purge complete.",
  });
  return response.data;
}
