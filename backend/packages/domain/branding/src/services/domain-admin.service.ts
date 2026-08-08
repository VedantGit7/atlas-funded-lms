import type { TenantTx } from "@atlas/db";
import { randomBytes } from "node:crypto";
import { enforceEntitlement } from "@atlas/authorization";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { CreateDomainRequestSchema } from "../schemas/domains";
import {
  disableTenantDomain,
  findDomainByHostname,
  insertTenantDomain,
  listTenantDomains,
  setPrimaryTenantDomain,
} from "../repositories/domain.repository";
import type { TenantDomainRow } from "../repositories/types";

function normalizeDomainType(type: string): "ATLAS_SUBDOMAIN" | "CUSTOM_DOMAIN" {
  const normalized = type.toUpperCase();
  if (normalized === "ATLAS_SUBDOMAIN" || normalized === "CUSTOM_DOMAIN") {
    return normalized;
  }

  throw new Error(`UNSUPPORTED_DOMAIN_TYPE:${type}`);
}

function mapDomain(row: TenantDomainRow): {
  id: string;
  hostname: string;
  type: "ATLAS_SUBDOMAIN" | "CUSTOM_DOMAIN";
  status: TenantDomainRow["status"];
  isPrimary: boolean;
  verificationTxtName: string | null;
  verificationTxtValue: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: row.id,
    hostname: row.hostname,
    type: normalizeDomainType(row.type),
    status: row.status,
    isPrimary: row.is_primary,
    verificationTxtName: row.verification_txt_name,
    verificationTxtValue: row.verification_txt_value,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function readTenantDomains(tx: TenantTx) {
  const rows = await listTenantDomains(tx);
  return { data: rows.map(mapDomain) };
}

export async function createTenantDomain(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  },
  rawInput: unknown,
) {
  const input = CreateDomainRequestSchema.parse(rawInput);

  if (input.type === "CUSTOM_DOMAIN") {
    await enforceEntitlement(tx, {
      tenantId: ctx.tenantId,
      key: "branding.custom_domain.enable",
      requestId: ctx.requestId,
    });
  }

  const existing = await findDomainByHostname(tx, input.hostname);
  if (existing) {
    throw new Error("DOMAIN_ALREADY_EXISTS");
  }

  const isCustom = input.type === "CUSTOM_DOMAIN";

  const verificationTxtName = isCustom ? `_atlas-verify.${input.hostname}` : null;

  const verificationTxtValue = isCustom ? `atlas=${randomBytes(24).toString("hex")}` : null;

  const row = await insertTenantDomain(tx, {
    hostname: input.hostname,
    type: input.type,
    makePrimary: input.makePrimary,
    verificationTxtName,
    verificationTxtValue,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "tenant.domain.created",
      target: { type: "tenant_domain", id: row.id },
      before: null,
      after: {
        hostname: input.hostname,
        type: input.type,
        status: row.status,
      },
      reason: null,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "domain.changed",
    aggregateType: "tenant_domain",
    aggregateId: row.id,
    payload: {
      tenantId: ctx.tenantId,
      domainId: row.id,
      hostname: input.hostname,
      action: "created",
    },
    idempotencyKey: `${ctx.requestId}:domain-created:${row.id}`,
  });

  return { data: mapDomain(row) };
}

export async function deleteTenantDomain(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  },
  domainId: string,
) {
  const row = await disableTenantDomain(tx, domainId);
  if (!row) throw new Error("DOMAIN_NOT_FOUND");

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "tenant.domain.deleted",
      target: { type: "tenant_domain", id: domainId },
      before: null,
      after: { status: "DISABLED" },
      reason: null,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "domain.changed",
    aggregateType: "tenant_domain",
    aggregateId: domainId,
    payload: {
      tenantId: ctx.tenantId,
      domainId,
      action: "disabled",
    },
    idempotencyKey: `${ctx.requestId}:domain-disabled:${domainId}`,
  });

  return {
    data: {
      id: row.id,
      status: row.status,
    },
  };
}

export async function setTenantDomainPrimary(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  },
  domainId: string,
) {
  const row = await setPrimaryTenantDomain(tx, domainId);
  if (!row) throw new Error("DOMAIN_NOT_FOUND_OR_INACTIVE");

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "tenant.domain.primary_set",
      target: { type: "tenant_domain", id: domainId },
      before: null,
      after: { hostname: row.hostname, isPrimary: true },
      reason: null,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "domain.changed",
    aggregateType: "tenant_domain",
    aggregateId: domainId,
    payload: {
      tenantId: ctx.tenantId,
      domainId,
      action: "primary_set",
    },
    idempotencyKey: `${ctx.requestId}:domain-primary:${domainId}`,
  });

  return { data: mapDomain(row) };
}
