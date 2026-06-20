import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { findRolePermissionGrant } from "@atlas/authorization";
import { enforceEntitlement } from "@atlas/authorization";
import { outbox } from "@atlas/events";
import { readRuntimeBrandingProjection } from "@atlas/domain-branding";
import { hashClientIp, hashUserAgent } from "@atlas/security";
import { randomUUID } from "node:crypto";
import type {
  CertificateIssueBody,
  CertificateListQuery,
  CertificateRevokeBody,
  CreateCertificateTemplateBody,
  DeleteCertificateTemplateBody,
  PublishCertificateTemplateBody,
  UpdateCertificateTemplateBody,
} from "./certificate.contract";
import {
  CERTIFICATE_AUDIT_ISSUED,
  CERTIFICATE_AUDIT_REVOKED,
  CERTIFICATE_ISSUED_EVENT,
  CERTIFICATE_REVOKED_EVENT,
  CERTIFICATE_TEMPLATE_DELETED,
} from "./certificate.events";
import {
  certificateIssueConflict,
  certificateNotFound,
  certificateRevokeConflict,
  certificateTemplateKeyConflict,
  certificateTemplateNotEditable,
  certificateTemplateNotFound,
  certificateTemplateNotPublishable,
  certificateWorkflowNotConfigured,
  invalidTargetMembership,
} from "./certificate.errors";
import { certificateTemplateFieldSchema, certificateTemplateJsonSchema } from "./certificate.dto";
import { certificateRepository } from "./certificate.repository";
import type { CertificateRow, CertificateTemplateRow, ServiceCtx } from "./certificate.types";

function mapTemplateDto(row: CertificateTemplateRow) {
  const parsed = certificateTemplateFieldSchema.parse(row.template_json);
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    templateJson: parsed,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function buildVerificationPath(credentialId: string): string {
  return `/verify/${credentialId}`;
}

function mapCertificateDto(
  row: CertificateRow & { template_name?: string; recipient_label?: string | null },
) {
  return {
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name ?? "Certificate",
    membershipId: row.membership_id,
    credentialId: row.credential_id,
    status: row.status,
    issuedAt: row.issued_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString() ?? null,
    verificationUrl: buildVerificationPath(row.credential_id),
    recipientLabel: row.recipient_label ?? null,
  };
}

function workflowRequiresReview(definitionJson: Record<string, unknown>): boolean {
  return definitionJson["requiresReview"] !== false;
}

async function isAdminBypass(tx: TenantTx, ctx: ServiceCtx): Promise<boolean> {
  const grant = await findRolePermissionGrant({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    permissionKey: "certificate.read",
  });
  const roleKeys = grant?.roleKeys ?? [];
  return roleKeys.includes("owner") || roleKeys.includes("admin");
}

function generateCredentialId(): string {
  return `cred_${randomUUID().replace(/-/g, "")}`;
}

export async function listCertificateTemplates(tx: TenantTx, ctx: ServiceCtx) {
  const rows = await certificateRepository.listTemplates(tx, ctx.tenantId);
  return { data: rows.map(mapTemplateDto) };
}

export async function createCertificateTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateCertificateTemplateBody,
) {
  const existing = await certificateRepository.findTemplateByKey(tx, ctx.tenantId, input.key);
  if (existing) {
    throw certificateTemplateKeyConflict();
  }

  const created = await certificateRepository.insertTemplate(tx, {
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    templateJson: input.templateJson,
  });

  return { data: mapTemplateDto(created) };
}

export async function updateCertificateTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: UpdateCertificateTemplateBody,
) {
  const existing = await certificateRepository.findTemplateById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw certificateTemplateNotFound();
  }

  if (existing.status !== "DRAFT") {
    throw certificateTemplateNotEditable();
  }

  if (input.key && input.key !== existing.key) {
    const conflict = await certificateRepository.findTemplateByKey(tx, ctx.tenantId, input.key);
    if (conflict) {
      throw certificateTemplateKeyConflict();
    }
  }

  const updated = await certificateRepository.updateTemplate(tx, {
    templateId: input.id,
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.templateJson !== undefined ? { templateJson: input.templateJson } : {}),
  });

  if (!updated) {
    throw certificateTemplateNotFound();
  }

  return { data: mapTemplateDto(updated) };
}

export async function deleteCertificateTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: DeleteCertificateTemplateBody,
) {
  const existing = await certificateRepository.findTemplateById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw certificateTemplateNotFound();
  }

  const deleted = await certificateRepository.softDeleteTemplate(tx, input.id);
  if (!deleted) {
    throw certificateTemplateNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: CERTIFICATE_TEMPLATE_DELETED,
      target: { type: "certificate_template", id: input.id },
      before: { key: existing.key, name: existing.name, status: existing.status },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return { data: { id: input.id, deleted: true as const } };
}

export async function publishCertificateTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  templateId: string,
  input: PublishCertificateTemplateBody,
) {
  const template = await certificateRepository.findTemplateById(tx, templateId);
  if (!template || template.tenant_id !== ctx.tenantId) {
    throw certificateTemplateNotFound();
  }

  if (template.status !== "DRAFT") {
    throw certificateTemplateNotPublishable();
  }

  certificateTemplateJsonSchema.parse(template.template_json);

  const workflow = await certificateRepository.findWorkflowDefinitionByKey(
    tx,
    "certificate_template.publish",
  );
  if (!workflow) {
    throw certificateWorkflowNotConfigured();
  }

  const requiresReview = workflowRequiresReview(workflow.definition_json);
  const toState = requiresReview ? "REVIEW" : "PUBLISHED";

  const transition = await certificateRepository.insertWorkflowTransition(tx, {
    tenantId: ctx.tenantId,
    workflowDefinitionId: workflow.id,
    targetType: "certificate_template",
    targetId: templateId,
    fromState: "DRAFT",
    toState,
    actorMembershipId: ctx.actorMembershipId,
    reason: input.reason ?? null,
    metadata: { action: requiresReview ? "submit" : "approve" },
  });

  await certificateRepository.updateTemplateStatus(tx, templateId, toState);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "workflow.transition",
      target: { type: "certificate_template", id: templateId },
      before: { status: template.status },
      after: { status: toState, workflowTransitionId: transition.id },
      reason: input.reason ?? null,
      metadata: {
        workflowDefinitionId: workflow.id,
        targetType: "certificate_template",
      },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "workflow.transitioned",
    aggregateType: "workflow_transition",
    aggregateId: transition.id,
    payload: {
      workflowTransitionId: transition.id,
      targetType: "certificate_template",
      targetId: templateId,
      action: requiresReview ? "submit" : "approve",
      fromState: "DRAFT",
      toState,
    },
    idempotencyKey: `${ctx.requestId}:workflow.transitioned:${transition.id}`,
  });

  const updated = await certificateRepository.findTemplateById(tx, templateId);
  if (!updated) {
    throw certificateTemplateNotFound();
  }

  return { data: mapTemplateDto(updated) };
}

export async function publishCertificateTemplateForTests(
  tx: TenantTx,
  templateId: string,
): Promise<void> {
  await certificateRepository.updateTemplateStatus(tx, templateId, "PUBLISHED");
}

export async function listCertificates(tx: TenantTx, ctx: ServiceCtx, query: CertificateListQuery) {
  const admin = await isAdminBypass(tx, ctx);

  const rows = await certificateRepository.listCertificates(tx, {
    tenantId: ctx.tenantId,
    limit: query.limit,
    ...(query.cursor != null ? { cursor: query.cursor } : {}),
    ...(query.status != null ? { status: query.status } : {}),
    ...(admin && query.membershipId != null ? { membershipId: query.membershipId } : {}),
    ...(!admin ? { membershipId: ctx.actorMembershipId } : {}),
  });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const last = pageRows.at(-1);

  return {
    data: pageRows.map(mapCertificateDto),
    page: {
      nextCursor: hasMore && last != null ? last.id : null,
      hasMore,
    },
  };
}

async function runIssueWorkflowGate(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<string | null> {
  const workflow = await certificateRepository.findWorkflowDefinitionByKey(tx, "certificate.issue");
  if (!workflow) {
    throw certificateWorkflowNotConfigured();
  }

  const requiresReview = workflowRequiresReview(workflow.definition_json);
  const toState = requiresReview ? "REVIEW" : "PUBLISHED";

  const transition = await certificateRepository.insertWorkflowTransition(tx, {
    tenantId: ctx.tenantId,
    workflowDefinitionId: workflow.id,
    targetType: "certificate",
    targetId: certificateId,
    fromState: "DRAFT",
    toState,
    actorMembershipId: ctx.actorMembershipId,
    reason: null,
    metadata: { action: requiresReview ? "submit" : "approve" },
  });

  if (requiresReview) {
    throw certificateIssueConflict("Certificate issuance requires workflow approval.");
  }

  return transition.id;
}

export async function issueCertificate(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CertificateIssueBody,
  idempotencyKey: string,
) {
  const template = await certificateRepository.findTemplateById(tx, input.templateId);
  if (!template || template.tenant_id !== ctx.tenantId || template.status !== "PUBLISHED") {
    throw certificateIssueConflict("Certificate template must be published.");
  }

  const active = await certificateRepository.membershipIsActive(tx, input.recipientMembershipId);
  if (!active) {
    throw invalidTargetMembership();
  }

  const sourcePublished = await certificateRepository.sourceIsPublished(tx, input.source);
  if (!sourcePublished) {
    throw certificateIssueConflict("Issue source must be published.");
  }

  const credentialId = generateCredentialId();
  const certificateId = randomUUID();

  const workflowTransitionId = await runIssueWorkflowGate(tx, ctx, certificateId);

  const metadataJson = {
    source: input.source,
    issuance: {
      issuedByMembershipId: ctx.actorMembershipId,
      idempotencyKey,
    },
  };

  const certificate = await certificateRepository.insertCertificateWithId(tx, {
    id: certificateId,
    tenantId: ctx.tenantId,
    templateId: input.templateId,
    membershipId: input.recipientMembershipId,
    credentialId,
    metadataJson,
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
      action: CERTIFICATE_AUDIT_ISSUED,
      target: { type: "certificate", id: certificate.id },
      before: null,
      after: {
        credentialId: certificate.credential_id,
        templateId: certificate.template_id,
        membershipId: certificate.membership_id,
        status: certificate.status,
      },
      reason: null,
      metadata: { source: input.source },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: CERTIFICATE_ISSUED_EVENT,
    aggregateType: "certificate",
    aggregateId: certificate.id,
    payload: {
      certificateId: certificate.id,
      credentialId: certificate.credential_id,
      templateId: certificate.template_id,
      membershipId: certificate.membership_id,
      issuedAt: certificate.issued_at.toISOString(),
      workflowTransitionId,
    },
    idempotencyKey: `${idempotencyKey}:${CERTIFICATE_ISSUED_EVENT}:${certificate.id}`,
  });

  const row = {
    ...certificate,
    template_name: template.name,
    recipient_label: null,
  };

  return { data: mapCertificateDto(row) };
}

export async function revokeCertificate(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
  input: CertificateRevokeBody,
) {
  const existing = await certificateRepository.findCertificateById(tx, certificateId);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw certificateNotFound();
  }

  if (existing.status !== "issued") {
    throw certificateRevokeConflict("Only issued certificates can be revoked.");
  }

  const priorMetadata =
    existing.metadata_json && typeof existing.metadata_json === "object"
      ? (existing.metadata_json as Record<string, unknown>)
      : {};

  const metadataJson = {
    ...priorMetadata,
    revocation: {
      reason: input.reason,
      revokedByMembershipId: ctx.actorMembershipId,
      revokedAt: new Date().toISOString(),
    },
  };

  const revoked = await certificateRepository.revokeCertificate(tx, {
    certificateId,
    metadataJson,
  });

  if (!revoked) {
    throw certificateRevokeConflict("Certificate could not be revoked.");
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: CERTIFICATE_AUDIT_REVOKED,
      target: { type: "certificate", id: certificateId },
      before: { status: existing.status, credentialId: existing.credential_id },
      after: { status: "revoked", credentialId: existing.credential_id },
      reason: input.reason,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: CERTIFICATE_REVOKED_EVENT,
    aggregateType: "certificate",
    aggregateId: certificateId,
    payload: {
      certificateId,
      credentialId: existing.credential_id,
      revokedAt: revoked.revoked_at?.toISOString() ?? new Date().toISOString(),
    },
    idempotencyKey: `${ctx.requestId}:${CERTIFICATE_REVOKED_EVENT}:${certificateId}`,
  });

  const template = await certificateRepository.findTemplateById(tx, revoked.template_id);
  return {
    data: mapCertificateDto({
      ...revoked,
      template_name: template?.name ?? "Certificate",
      recipient_label: null,
    }),
  };
}

export async function verifyCredentialPublic(args: {
  tx: TenantTx;
  tenantId: string;
  requestId: string;
  credentialId: string;
  req: Request;
}) {
  await enforceEntitlement(args.tx, {
    tenantId: args.tenantId,
    key: "certification.enable",
    requestId: args.requestId,
  });

  const certificate = await certificateRepository.findCertificateByCredentialId(
    args.tx,
    args.tenantId,
    args.credentialId,
  );

  if (!certificate) {
    throw certificateNotFound();
  }

  const verifiedAt = new Date();
  await certificateRepository.insertCredentialVerification(args.tx, {
    tenantId: args.tenantId,
    certificateId: certificate.id,
    ipHash: hashClientIp(args.req),
    userAgentHash: hashUserAgent(args.req),
  });

  const branding = await readRuntimeBrandingProjection(args.tx);

  return {
    data: {
      credentialId: certificate.credential_id,
      status: certificate.status,
      issuedAt: certificate.issued_at.toISOString(),
      verifiedAt: verifiedAt.toISOString(),
      issuer: {
        displayName: branding.issuerName ?? branding.publicName,
        logoUrl: null,
      },
    },
  };
}
