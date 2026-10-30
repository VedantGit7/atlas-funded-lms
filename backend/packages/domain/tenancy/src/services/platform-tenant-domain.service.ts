import { randomBytes } from "node:crypto";
import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { normalizePublicHostname } from "@atlas/core/domains/public-hostname";
import { AtlasHttpError } from "@atlas/core/http/errors";

type DomainCtx = {
  platformPrincipalId: string;
  requestId: string;
  reason: string;
};

type DomainRow = {
  id: string;
  hostname: string;
  type: string;
  status: string;
  is_primary: boolean;
  verification_txt_name: string | null;
  verification_txt_value: string | null;
  failure_reason: string | null;
  created_at: Date;
};

/** TXT records as node:dns returns them: each record is a list of chunks. */
export type ResolveTxt = (name: string) => Promise<string[][]>;

function conflict(message: string): never {
  throw new AtlasHttpError({ code: "VALIDATION_ERROR", status: 409, message });
}

function invalid(message: string): never {
  throw new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

/** The custom domain as stored, or a 400 when it is not a public DNS name. */
export function normalizeCustomHostname(raw: string): string {
  const hostname = normalizePublicHostname(raw);
  if (!hostname) invalid("Enter a public domain name, such as academy.example.com.");
  return hostname;
}

function view(row: DomainRow) {
  const pending = row.status !== "ACTIVE";
  return {
    id: row.id,
    hostname: row.hostname,
    type: row.type,
    status: row.status,
    isPrimary: row.is_primary,
    // The record to create is shown until the domain is verified.
    verification:
      pending && row.verification_txt_name && row.verification_txt_value
        ? { txtName: row.verification_txt_name, txtValue: row.verification_txt_value }
        : null,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
  };
}

async function findDomain(tx: PlatformTx, tenantId: string, domainId: string) {
  const rows = await tx.$queryRaw<DomainRow[]>`
    SELECT id::text, hostname, type, status::text, is_primary, verification_txt_name,
           verification_txt_value, failure_reason, created_at
    FROM tenant_domains
    WHERE id = ${domainId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL
  `;
  const row = rows[0];
  if (!row) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Domain not found.",
    });
  }
  return row;
}

async function audit(
  tx: PlatformTx,
  ctx: DomainCtx,
  tenantId: string,
  action: string,
  domainId: string,
  after: Record<string, unknown>,
) {
  await auditWriter.write(
    tx,
    {
      tenantId,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action,
      target: { type: "tenant_domain", id: domainId },
      before: null,
      after,
      reason: ctx.reason,
      metadata: {},
    },
  );
}

export async function listPlatformTenantDomains(tx: PlatformTx, tenantId: string) {
  const rows = await tx.$queryRaw<DomainRow[]>`
    SELECT id::text, hostname, type, status::text, is_primary, verification_txt_name,
           verification_txt_value, failure_reason, created_at
    FROM tenant_domains
    WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL
    ORDER BY is_primary DESC, created_at ASC
  `;
  return { data: rows.map(view) };
}

/**
 * Adds a custom domain, pending until verified. A tenant's own domain routes
 * are reachable only on a domain that already works, so the platform adds a
 * new tenant's first one.
 */
export async function addPlatformTenantCustomDomain(
  tx: PlatformTx,
  ctx: DomainCtx,
  tenantId: string,
  input: { hostname: string },
  options: { reservedHostnames: readonly string[] },
) {
  const hostname = normalizeCustomHostname(input.hostname);
  if (options.reservedHostnames.includes(hostname)) {
    conflict("That name belongs to the platform itself.");
  }

  const tenants = await tx.$queryRaw<Array<{ state: string }>>`
    SELECT state::text FROM tenants WHERE id = ${tenantId}::uuid AND deleted_at IS NULL
  `;
  const state = tenants[0]?.state;
  if (!state)
    throw new AtlasHttpError({
      code: "TENANT_NOT_FOUND",
      status: 404,
      message: "Tenant not found",
    });
  if (state === "ARCHIVED") conflict("An archived tenant cannot add domains.");

  const taken = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id::text FROM tenant_domains WHERE hostname = ${hostname} AND deleted_at IS NULL LIMIT 1
  `;
  if (taken.length > 0) conflict("That domain is already in use.");

  const rows = await tx.$queryRaw<DomainRow[]>`
    INSERT INTO tenant_domains (
      id, tenant_id, hostname, type, status, is_primary,
      verification_txt_name, verification_txt_value, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), ${tenantId}::uuid, ${hostname}, 'CUSTOM_DOMAIN', 'PENDING'::"DomainStatus",
      false, ${`_atlas-verify.${hostname}`}, ${`atlas=${randomBytes(24).toString("hex")}`},
      now(), now()
    )
    RETURNING id::text, hostname, type, status::text, is_primary, verification_txt_name,
              verification_txt_value, failure_reason, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error("Domain insert returned no row.");

  await audit(tx, ctx, tenantId, "tenant.domain.created", row.id, { hostname, type: row.type });
  return { data: view(row) };
}

function describeDnsFailure(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code === "ENOTFOUND" || code === "ENODATA") return "No TXT record found yet.";
  return `The DNS lookup failed (${code ?? "unknown error"}). Try again shortly.`;
}

/**
 * Checks the domain's TXT record. A match activates the domain, so requests
 * for it resolve to this tenant; anything else records why and leaves it
 * unusable. Only a pending or failed custom domain can be verified.
 */
export async function verifyPlatformTenantDomain(
  tx: PlatformTx,
  ctx: DomainCtx,
  tenantId: string,
  domainId: string,
  resolveTxt: ResolveTxt,
) {
  const domain = await findDomain(tx, tenantId, domainId);
  if (domain.type !== "CUSTOM_DOMAIN") conflict("Only a custom domain needs verifying.");
  if (domain.status === "ACTIVE") conflict("This domain is already verified.");
  if (domain.status === "DISABLED") conflict("This domain is disabled.");
  if (!domain.verification_txt_name || !domain.verification_txt_value) {
    conflict("This domain has no verification record. Remove it and add it again.");
  }

  let failure: string | null = null;
  try {
    const records = await resolveTxt(domain.verification_txt_name);
    const values = records.map((chunks) => chunks.join(""));
    if (!values.includes(domain.verification_txt_value)) {
      failure =
        values.length === 0
          ? "No TXT record found yet."
          : "A TXT record exists, but its value does not match.";
    }
  } catch (error) {
    failure = describeDnsFailure(error);
  }

  const rows = await tx.$queryRaw<DomainRow[]>`
    UPDATE tenant_domains
    SET status = ${failure ? "FAILED" : "ACTIVE"}::"DomainStatus",
        failure_reason = ${failure},
        updated_at = now()
    WHERE id = ${domainId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL
    RETURNING id::text, hostname, type, status::text, is_primary, verification_txt_name,
              verification_txt_value, failure_reason, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error("Domain update returned no row.");

  await audit(
    tx,
    ctx,
    tenantId,
    failure ? "tenant.domain.verification_failed" : "tenant.domain.verified",
    domainId,
    { hostname: domain.hostname, status: row.status, failureReason: failure },
  );
  return { data: view(row) };
}

/** Makes an active domain the tenant's primary one, the address its links use. */
export async function setPlatformTenantPrimaryDomain(
  tx: PlatformTx,
  ctx: DomainCtx,
  tenantId: string,
  domainId: string,
) {
  const domain = await findDomain(tx, tenantId, domainId);
  if (domain.status !== "ACTIVE") conflict("Only a verified, active domain can be primary.");

  await tx.$queryRaw`
    UPDATE tenant_domains SET is_primary = false, updated_at = now()
    WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL AND is_primary
  `;
  const rows = await tx.$queryRaw<DomainRow[]>`
    UPDATE tenant_domains SET is_primary = true, updated_at = now()
    WHERE id = ${domainId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL
    RETURNING id::text, hostname, type, status::text, is_primary, verification_txt_name,
              verification_txt_value, failure_reason, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error("Domain update returned no row.");

  await audit(tx, ctx, tenantId, "tenant.domain.primary_set", domainId, {
    hostname: domain.hostname,
  });
  return { data: view(row) };
}
