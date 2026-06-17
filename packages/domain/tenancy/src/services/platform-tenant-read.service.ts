import type { PlatformTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  PlatformTenantListQuerySchema,
  type PlatformTenantListQuery,
} from "../schemas/platform-tenants";
import {
  findPlatformTenantById,
  listPlatformTenants,
} from "../repositories/platform-tenant.repository";
import { listProvisioningJobsForTenant } from "../repositories/provisioning-job.repository";
import type {
  PlatformTenantRow,
  ProvisioningJobErrorJson,
} from "../repositories/platform-tenant.types";

function mapTenant(row: PlatformTenantRow) {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    legalName: row.legal_name,
    state: row.state,
    defaultLocale: row.default_locale,
    defaultTimezone: row.default_timezone,
    primaryDomain: row.primary_domain_id
      ? {
          id: row.primary_domain_id,
          hostname: row.primary_domain_hostname,
          status: row.primary_domain_status,
          type: row.primary_domain_type,
        }
      : null,
    provisioning: {
      latestJobId: row.latest_job_id ?? null,
      latestStatus: row.latest_job_status ?? null,
    },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function decodeListCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };

    if (!parsed.createdAt || !parsed.id) {
      throw new Error("Invalid cursor");
    }

    return {
      createdAt: new Date(parsed.createdAt),
      id: parsed.id,
    };
  } catch {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Invalid list cursor",
    });
  }
}

function readProvisioningJobError(errorJson: unknown): {
  code: string | null;
  message: string | null;
} {
  if (errorJson == null || typeof errorJson !== "object") {
    return { code: null, message: null };
  }

  const parsed = errorJson as ProvisioningJobErrorJson;
  return {
    code: parsed.code ?? null,
    message: parsed.message ?? null,
  };
}

export async function readPlatformTenants(tx: PlatformTx, rawQuery: unknown) {
  const query: PlatformTenantListQuery = PlatformTenantListQuerySchema.parse(rawQuery);
  const cursor = query.cursor ? decodeListCursor(query.cursor) : null;
  const rows = await listPlatformTenants(tx, {
    ...query,
    cursorCreatedAt: cursor?.createdAt ?? null,
    cursorId: cursor?.id ?? null,
  });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    data: pageRows.map(mapTenant),
    page: {
      hasMore,
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({
                createdAt: last.created_at.toISOString(),
                id: last.id,
              }),
            ).toString("base64url")
          : null,
    },
  };
}

export async function readPlatformTenantDetail(tx: PlatformTx, tenantId: string) {
  const row = await findPlatformTenantById(tx, tenantId);

  if (!row) {
    throw new AtlasHttpError({
      code: "TENANT_NOT_FOUND",
      status: 404,
      message: "Tenant not found",
    });
  }

  return {
    data: mapTenant(row),
  };
}

export async function readTenantProvisioningJobs(tx: PlatformTx, tenantId: string) {
  const rows = await listProvisioningJobsForTenant(tx, tenantId);

  return {
    data: rows.map((row) => {
      const error = readProvisioningJobError(row.error_json);

      return {
        id: row.id,
        tenantId: row.tenant_id,
        status: row.status,
        step: row.step,
        errorCode: error.code,
        safeErrorMessage: error.message,
        idempotencyKey: row.idempotency_key,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    }),
  };
}
