import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { findRolePermissionGrant } from "@atlas/authorization";
import { enforceEntitlement } from "@atlas/authorization";
import { outbox } from "@atlas/events";
import { readRuntimeBrandingProjection } from "@atlas/domain-branding";
import { hashClientIp, hashUserAgent } from "@atlas/security";
import { randomUUID } from "node:crypto";
import type {
  CertificateBulkIssueBody,
  CertificateIssueBody,
  CertificateLifecycleActionBody,
  CertificateListQuery,
  CertificateRevokeBody,
  CreateCertificateBrandKitBody,
  CreateCertificateTemplateBody,
  DeleteCertificateBrandKitBody,
  DeleteCertificateTemplateBody,
  PublishCertificateTemplateBody,
  UpdateCertificateBrandKitBody,
  UpdateCertificateTemplateBody,
} from "./certificate.contract";
import {
  CERTIFICATE_AUDIT_ISSUED,
  CERTIFICATE_AUDIT_REVOKED,
  CERTIFICATE_EXPIRED_EVENT,
  CERTIFICATE_ISSUED_EVENT,
  CERTIFICATE_REVOKED_EVENT,
  CERTIFICATE_SUSPENDED_EVENT,
  CERTIFICATE_TEMPLATE_DELETED,
} from "./certificate.events";
import {
  certificateBrandKitNotFound,
  certificateDownloadNotReady,
  certificateIssueConflict,
  certificateNotFound,
  certificateRevokeConflict,
  certificateTemplateKeyConflict,
  certificateTemplateNotApprovable,
  certificateTemplateNotEditable,
  certificateTemplateNotFound,
  certificateTemplateNotPublishable,
  certificateWorkflowNotConfigured,
  invalidTargetMembership,
} from "./certificate.errors";
import {
  certificateIssueSourceSchema,
  certificateTemplateJsonUnionSchema,
} from "./certificate.dto";
import {
  certificateDesignDocumentSchema,
  type CertificateDesignDocument,
} from "./certificate-design-document";
import { anchorCertificateHash } from "./certificate-blockchain.service";
import { setCertificateStatusBit } from "./certificate-status-list.service";
import {
  hashCertificateDesignSnapshot,
  readSnapshotValidityDays,
  resolveCertificateExpiry,
} from "./certificate-lifecycle";
import { certificateRepository } from "./certificate.repository";
import { buildOpenBadgeCredential, signCredentialEd25519 } from "./open-badge.service";
import type {
  CertificateBrandKitRow,
  CertificateRow,
  CertificateTemplateRow,
  ServiceCtx,
} from "./certificate.types";
import { designDocumentToHtmlAsync, sampleDataFromVariables } from "./certificate-design-to-html";

function resolveIssuerDid(): string {
  return process.env["CERTIFICATE_ISSUER_DID"] ?? "did:web:atlas-funded-lms";
}

function resolvePublicVerificationUrl(credentialId: string): string {
  const base = process.env["CERTIFICATE_PUBLIC_BASE_URL"]?.replace(/\/$/, "") ?? "";
  return `${base}${buildVerificationPath(credentialId)}`;
}

function mapTemplateDto(row: CertificateTemplateRow) {
  const parsed = certificateTemplateJsonUnionSchema.parse(row.template_json);
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
    expiresAt: row.expires_at?.toISOString(),
    serialNumber: row.serial_number ?? undefined,
    courseTitle: row.course_title ?? undefined,
    recipientName: row.recipient_name ?? undefined,
    designSnapshotHash: row.design_snapshot_hash ?? undefined,
    suspendedAt: row.suspended_at?.toISOString() ?? null,
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

type BrandKitColor = { name: string; hex: string };
type BrandKitFont = { label: string; family: string };
type BrandKitAsset = { name: string; url: string };

function normalizeBrandKitJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mapBrandKitDto(row: CertificateBrandKitRow) {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    colors: normalizeBrandKitJsonArray<BrandKitColor>(row.colors_json),
    fonts: normalizeBrandKitJsonArray<BrandKitFont>(row.fonts_json),
    assets: normalizeBrandKitJsonArray<BrandKitAsset>(row.assets_json),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listCertificateBrandKits(tx: TenantTx, ctx: ServiceCtx) {
  const rows = await certificateRepository.listBrandKits(tx, ctx.tenantId);
  return { data: rows.map(mapBrandKitDto) };
}

export async function createCertificateBrandKit(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateCertificateBrandKitBody,
) {
  const created = await certificateRepository.insertBrandKit(tx, {
    tenantId: ctx.tenantId,
    name: input.name,
    logoUrl: input.logoUrl ?? null,
    colors: input.colors ?? [],
    fonts: input.fonts ?? [],
    assets: input.assets ?? [],
  });
  return { data: mapBrandKitDto(created) };
}

export async function updateCertificateBrandKit(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: UpdateCertificateBrandKitBody,
) {
  const existing = await certificateRepository.findBrandKitById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw certificateBrandKitNotFound();
  }

  const updated = await certificateRepository.updateBrandKit(tx, {
    id: input.id,
    name: input.name ?? null,
    logoUrl: input.logoUrl ?? null,
    logoProvided: input.logoUrl !== undefined,
    colors: input.colors,
    fonts: input.fonts,
    assets: input.assets,
  });
  if (!updated) {
    throw certificateBrandKitNotFound();
  }
  return { data: mapBrandKitDto(updated) };
}

export async function deleteCertificateBrandKit(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: DeleteCertificateBrandKitBody,
) {
  const existing = await certificateRepository.findBrandKitById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw certificateBrandKitNotFound();
  }

  const deleted = await certificateRepository.softDeleteBrandKit(tx, input.id);
  if (!deleted) {
    throw certificateBrandKitNotFound();
  }
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

  certificateTemplateJsonUnionSchema.parse(template.template_json);

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

/**
 * Approve a template that is awaiting review, moving REVIEW → PUBLISHED.
 * This completes the DRAFT → REVIEW → PUBLISHED workflow started by
 * `publishCertificateTemplate` when the tenant workflow requires review.
 */
export async function approveCertificateTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  templateId: string,
  input: PublishCertificateTemplateBody,
) {
  const template = await certificateRepository.findTemplateById(tx, templateId);
  if (!template || template.tenant_id !== ctx.tenantId) {
    throw certificateTemplateNotFound();
  }

  if (template.status !== "REVIEW") {
    throw certificateTemplateNotApprovable();
  }

  certificateTemplateJsonUnionSchema.parse(template.template_json);

  const workflow = await certificateRepository.findWorkflowDefinitionByKey(
    tx,
    "certificate_template.publish",
  );
  if (!workflow) {
    throw certificateWorkflowNotConfigured();
  }

  const transition = await certificateRepository.insertWorkflowTransition(tx, {
    tenantId: ctx.tenantId,
    workflowDefinitionId: workflow.id,
    targetType: "certificate_template",
    targetId: templateId,
    fromState: "REVIEW",
    toState: "PUBLISHED",
    actorMembershipId: ctx.actorMembershipId,
    reason: input.reason ?? null,
    metadata: { action: "approve" },
  });

  await certificateRepository.updateTemplateStatus(tx, templateId, "PUBLISHED");

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
      after: { status: "PUBLISHED", workflowTransitionId: transition.id },
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
      action: "approve",
      fromState: "REVIEW",
      toState: "PUBLISHED",
    },
    idempotencyKey: `${ctx.requestId}:workflow.transitioned:${transition.id}`,
  });

  const updated = await certificateRepository.findTemplateById(tx, templateId);
  if (!updated) {
    throw certificateTemplateNotFound();
  }

  return { data: mapTemplateDto(updated) };
}

export type CertificateDownload = {
  filename: string;
  contentType: string;
  body: string | Buffer;
  /** True when served from a stored render (r2); false for a generated HTML preview. */
  fromStorage: boolean;
};

/** What to serve for a certificate download, decided in the tenant transaction. */
export type CertificateDownloadPlan = {
  baseName: string;
  /** Stored PDF to serve when present. */
  r2ObjectKey: string | null;
  /** HTML fallback; null when there is no usable design. */
  html: {
    design: CertificateDesignDocument;
    data: Record<string, string>;
    verificationUrl: string;
  } | null;
};

/**
 * Database half of a certificate download: authorization and everything read
 * from the database. Object storage and rendering happen afterwards, in
 * {@link materializeCertificateDownload}, so no pooled connection is held
 * across them (audit H3).
 */
export async function planCertificateDownload(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<CertificateDownloadPlan> {
  const admin = await isAdminBypass(tx, ctx);
  const certificate = await certificateRepository.findCertificateById(tx, certificateId);
  if (!certificate || certificate.tenant_id !== ctx.tenantId) {
    throw certificateNotFound();
  }
  if (!admin && certificate.membership_id !== ctx.actorMembershipId) {
    throw certificateNotFound();
  }

  const safeCredential = certificate.credential_id.replace(/[^a-zA-Z0-9_-]/g, "");
  const snapshot =
    certificate.design_snapshot_json ??
    (await certificateRepository.findTemplateById(tx, certificate.template_id))?.template_json;
  const parsed = certificateDesignDocumentSchema.safeParse(snapshot);
  let html: CertificateDownloadPlan["html"] = null;
  if (parsed.success) {
    const data = sampleDataFromVariables(parsed.data);
    if (certificate.recipient_name) data["recipient_name"] = certificate.recipient_name;
    if (certificate.course_title) data["course_title"] = certificate.course_title;
    const verificationUrl = buildVerificationPath(certificate.credential_id);
    data["credential_id"] = certificate.credential_id;
    data["verification_url"] = verificationUrl;
    html = { design: parsed.data, data, verificationUrl };
  }

  return {
    baseName: `certificate-${safeCredential || certificate.id}`,
    r2ObjectKey: certificate.r2_object_key,
    html,
  };
}

/**
 * Storage and rendering half: prefers the stored PDF, falls back to an HTML
 * render of the design, and throws 409 when neither is available.
 */
export async function materializeCertificateDownload(
  plan: CertificateDownloadPlan,
): Promise<CertificateDownload> {
  if (plan.r2ObjectKey) {
    const { loadCertificatePdfArtifact } = await import("./certificate-pdf-store");
    const pdf = await loadCertificatePdfArtifact(plan.r2ObjectKey);
    if (pdf) {
      return {
        filename: `${plan.baseName}.pdf`,
        contentType: "application/pdf",
        body: pdf,
        fromStorage: true,
      };
    }
  }

  if (!plan.html) {
    throw certificateDownloadNotReady();
  }

  const html = await designDocumentToHtmlAsync(plan.html.design, plan.html.data, {
    watermark: false,
    verificationUrl: plan.html.verificationUrl,
  });

  return {
    filename: `${plan.baseName}.html`,
    contentType: "text/html; charset=utf-8",
    body: html,
    fromStorage: false,
  };
}

/**
 * Resolve a downloadable representation of an issued certificate.
 *
 * For callers that already hold no connection besides `tx`, or none at all in
 * tests. Routes plan inside the transaction and materialize after it.
 */
export async function getCertificateDownload(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<CertificateDownload> {
  return materializeCertificateDownload(await planCertificateDownload(tx, ctx, certificateId));
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

export async function getCertificate(tx: TenantTx, ctx: ServiceCtx, certificateId: string) {
  const row = await certificateRepository.findCertificateById(tx, certificateId);
  if (!row || row.tenant_id !== ctx.tenantId) throw certificateNotFound();
  const template = await certificateRepository.findTemplateById(tx, row.template_id);
  return {
    data: mapCertificateDto({
      ...row,
      template_name: template?.name ?? "Certificate",
      recipient_label: row.recipient_name,
    }),
  };
}

export async function getCertificateAnalytics(tx: TenantTx, ctx: ServiceCtx) {
  const counts = { issued: 0, revoked: 0, expired: 0, suspended: 0 };
  for (const row of await certificateRepository.analyticsCounts(tx, ctx.tenantId)) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] = Number(row.count);
    }
  }
  return { data: counts };
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
  const prior = await certificateRepository.findCertificateByIssuanceIdempotencyKey(
    tx,
    ctx.tenantId,
    idempotencyKey,
  );
  if (prior) {
    const priorTemplate = await certificateRepository.findTemplateById(tx, prior.template_id);
    return {
      data: mapCertificateDto({
        ...prior,
        template_name: priorTemplate?.name ?? "Certificate",
        recipient_label: prior.recipient_name,
      }),
    };
  }

  const template = await certificateRepository.findTemplateById(tx, input.templateId);
  if (!template || template.tenant_id !== ctx.tenantId || template.status !== "PUBLISHED") {
    throw certificateIssueConflict("Certificate template must be published.");
  }

  const active = await certificateRepository.membershipIsActive(tx, input.recipientMembershipId);
  if (!active) {
    throw invalidTargetMembership();
  }
  const recipientName = await certificateRepository.membershipDisplayName(
    tx,
    input.recipientMembershipId,
  );
  const courseTitle =
    input.source.type === "course"
      ? await certificateRepository.courseTitle(tx, input.source.id)
      : null;

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
  const validityDays = input.validityDays ?? readSnapshotValidityDays(template.template_json);
  const expiresAt = resolveCertificateExpiry({
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
    ...(validityDays != null ? { validityDays } : {}),
  });
  const designSnapshotHash = hashCertificateDesignSnapshot(template.template_json);

  const certificate = await certificateRepository.insertCertificateWithId(tx, {
    id: certificateId,
    tenantId: ctx.tenantId,
    templateId: input.templateId,
    membershipId: input.recipientMembershipId,
    credentialId,
    metadataJson,
    recipientName,
    courseTitle,
    designSnapshotJson: template.template_json,
    designSnapshotHash,
    expiresAt,
  });

  // Tier 2: build + (optionally) sign an Open Badge 3.0 / VC and persist it so
  // the public open-badge route can serve verifiable JSON. Assign a status list
  // index for revocation bitstring publishing. Failures here must not block
  // issuance, so they are best-effort.
  try {
    const brandingForVc = await readRuntimeBrandingProjection(tx);
    const openBadge = signCredentialEd25519(
      buildOpenBadgeCredential({
        issuerDid: resolveIssuerDid(),
        issuerName: brandingForVc.issuerName ?? brandingForVc.publicName ?? "Issuer",
        recipientName,
        credentialId,
        courseTitle: courseTitle ?? template.name,
        issuedAt: certificate.issued_at.toISOString(),
        ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
        verificationUrl: resolvePublicVerificationUrl(credentialId),
      }),
    );
    await certificateRepository.storeVcJson(tx, {
      certificateId: certificate.id,
      vcJson: openBadge,
    });
    await certificateRepository.assignStatusListIndex(tx, {
      tenantId: ctx.tenantId,
      certificateId: certificate.id,
    });
    try {
      await anchorCertificateHash(tx, ctx, certificate.id);
    } catch {
      // Local/on-chain anchor is best-effort (CERTIFICATE_BLOCKCHAIN_ANCHOR + adapter).
    }
  } catch {
    // VC/status-list enrichment is non-critical for issuance success.
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

export async function bulkIssueCertificates(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CertificateBulkIssueBody,
  idempotencyKey: string,
) {
  const issued = [];
  const failed: Array<{ recipientMembershipId: string; error: string }> = [];

  for (const [index, recipient] of input.recipients.entries()) {
    try {
      const result = await issueCertificate(
        tx,
        ctx,
        {
          templateId: input.templateId,
          recipientMembershipId: recipient.recipientMembershipId,
          source: recipient.source,
          ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
          ...(input.validityDays != null ? { validityDays: input.validityDays } : {}),
        },
        `${idempotencyKey}:${String(index)}:${recipient.recipientMembershipId}`,
      );
      issued.push(result.data);
    } catch (error) {
      failed.push({
        recipientMembershipId: recipient.recipientMembershipId,
        error: error instanceof Error ? error.message : "Certificate issuance failed.",
      });
    }
  }

  return { data: { issued, failed } };
}

function lifecycleMetadata(
  existing: CertificateRow,
  action: string,
  ctx: ServiceCtx,
  input: CertificateLifecycleActionBody,
) {
  const prior =
    existing.metadata_json && typeof existing.metadata_json === "object"
      ? (existing.metadata_json as Record<string, unknown>)
      : {};
  return {
    ...prior,
    [action]: {
      reason: input.reason ?? null,
      actorMembershipId: ctx.actorMembershipId,
      occurredAt: new Date().toISOString(),
    },
  };
}

async function writeLifecycleAudit(
  tx: TenantTx,
  ctx: ServiceCtx,
  existing: CertificateRow,
  status: "suspended" | "expired",
  reason?: string,
) {
  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: `credential.${status}`,
      target: { type: "certificate", id: existing.id },
      before: { status: existing.status, credentialId: existing.credential_id },
      after: { status, credentialId: existing.credential_id },
      reason: reason ?? null,
      metadata: {},
    },
  );
}

export async function suspendCertificate(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
  input: CertificateLifecycleActionBody,
) {
  const existing = await certificateRepository.findCertificateById(tx, certificateId);
  if (!existing || existing.tenant_id !== ctx.tenantId) throw certificateNotFound();
  if (existing.status !== "issued") {
    throw certificateIssueConflict("Only issued certificates can be suspended.");
  }
  const updated = await certificateRepository.suspendCertificate(tx, {
    certificateId,
    metadataJson: lifecycleMetadata(existing, "suspension", ctx, input),
  });
  if (!updated || updated.status !== "suspended") {
    throw certificateIssueConflict("Certificate could not be suspended.");
  }
  await writeLifecycleAudit(tx, ctx, existing, "suspended", input.reason);
  if (updated.status_list_index != null) {
    try {
      await setCertificateStatusBit({
        tx,
        tenantId: ctx.tenantId,
        statusListIndex: updated.status_list_index,
        revoked: true,
      });
    } catch {
      // Status-list bit flip is best-effort; suspension still succeeds.
    }
  }
  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: CERTIFICATE_SUSPENDED_EVENT,
    aggregateType: "certificate",
    aggregateId: certificateId,
    payload: {
      certificateId,
      credentialId: existing.credential_id,
      suspendedAt: updated.suspended_at?.toISOString() ?? new Date().toISOString(),
    },
    idempotencyKey: `${ctx.requestId}:${CERTIFICATE_SUSPENDED_EVENT}:${certificateId}`,
  });
  return getCertificate(tx, ctx, certificateId);
}

export async function expireCertificate(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
  input: CertificateLifecycleActionBody,
) {
  const existing = await certificateRepository.findCertificateById(tx, certificateId);
  if (!existing || existing.tenant_id !== ctx.tenantId) throw certificateNotFound();
  if (existing.status !== "issued" && existing.status !== "suspended") {
    throw certificateIssueConflict("Only issued or suspended certificates can be expired.");
  }
  const updated = await certificateRepository.expireCertificate(tx, {
    certificateId,
    metadataJson: lifecycleMetadata(existing, "expiration", ctx, input),
  });
  if (!updated || updated.status !== "expired") {
    throw certificateIssueConflict("Certificate could not be expired.");
  }
  await writeLifecycleAudit(tx, ctx, existing, "expired", input.reason);
  if (updated.status_list_index != null) {
    try {
      await setCertificateStatusBit({
        tx,
        tenantId: ctx.tenantId,
        statusListIndex: updated.status_list_index,
        revoked: true,
      });
    } catch {
      // Status-list bit flip is best-effort; expiration still succeeds.
    }
  }
  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: CERTIFICATE_EXPIRED_EVENT,
    aggregateType: "certificate",
    aggregateId: certificateId,
    payload: {
      certificateId,
      credentialId: existing.credential_id,
      expiredAt: new Date().toISOString(),
    },
    idempotencyKey: `${ctx.requestId}:${CERTIFICATE_EXPIRED_EVENT}:${certificateId}`,
  });
  return getCertificate(tx, ctx, certificateId);
}

export async function reissueCertificate(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
  input: CertificateLifecycleActionBody,
  idempotencyKey: string,
) {
  const existing = await certificateRepository.findCertificateById(tx, certificateId);
  if (!existing || existing.tenant_id !== ctx.tenantId) throw certificateNotFound();
  const metadata =
    existing.metadata_json && typeof existing.metadata_json === "object"
      ? (existing.metadata_json as Record<string, unknown>)
      : {};
  const source = certificateIssueSourceSchema.safeParse(metadata["source"]);
  if (!source.success) {
    throw certificateIssueConflict("Certificate source is unavailable for re-issue.");
  }
  return issueCertificate(
    tx,
    ctx,
    {
      templateId: existing.template_id,
      recipientMembershipId: existing.membership_id,
      source: source.data,
      ...(existing.expires_at != null && existing.issued_at < existing.expires_at
        ? {
            validityDays: Math.max(
              1,
              Math.ceil(
                (existing.expires_at.getTime() - existing.issued_at.getTime()) /
                  (24 * 60 * 60 * 1000),
              ),
            ),
          }
        : {}),
    },
    `${idempotencyKey}:reissue:${certificateId}`,
  );
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

  if (revoked.status_list_index != null) {
    try {
      await setCertificateStatusBit({
        tx,
        tenantId: ctx.tenantId,
        statusListIndex: revoked.status_list_index,
        revoked: true,
      });
    } catch {
      // Status-list bit flip is best-effort; revocation still succeeds.
    }
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
      certificateId: certificate.id,
      status: certificate.status,
      issuedAt: certificate.issued_at.toISOString(),
      verifiedAt: verifiedAt.toISOString(),
      issuer: {
        displayName: branding.issuerName ?? branding.publicName,
        logoUrl: "/brand/avatar-gradient.svg",
      },
      recipientName: certificate.recipient_name ?? undefined,
      courseTitle: certificate.course_title ?? undefined,
      expiresAt: certificate.expires_at?.toISOString(),
      serialNumber: certificate.serial_number ?? undefined,
      // The rendered PDF/PNG is only linkable once the async render job has
      // uploaded it; expose a stable public download path when present.
      downloadUrl: certificate.r2_object_key
        ? `/api/v1/public/credentials/${certificate.credential_id}/download`
        : undefined,
    },
  };
}

/**
 * Public, unauthenticated download of an issued credential's rendered
 * certificate, keyed by `credentialId`. Serves the design-snapshot HTML so a
 * verifier who followed the `downloadUrl` from the verify surface gets the
 * document without needing a session. Revoked/expired/suspended credentials
 * still resolve (the verify page communicates status separately).
 */
export async function getPublicCredentialDownload(args: {
  tx: TenantTx;
  tenantId: string;
  requestId: string;
  credentialId: string;
}): Promise<CertificateDownload> {
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

  const safeCredential = certificate.credential_id.replace(/[^a-zA-Z0-9_-]/g, "");

  if (certificate.r2_object_key) {
    const { loadCertificatePdfArtifact } = await import("./certificate-pdf-store");
    const pdf = await loadCertificatePdfArtifact(certificate.r2_object_key);
    if (pdf) {
      return {
        filename: `certificate-${safeCredential || certificate.id}.pdf`,
        contentType: "application/pdf",
        body: pdf,
        fromStorage: true,
      };
    }
  }

  const snapshot =
    certificate.design_snapshot_json ??
    (await certificateRepository.findTemplateById(args.tx, certificate.template_id))?.template_json;

  const parsed = certificateDesignDocumentSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw certificateDownloadNotReady();
  }

  const data = sampleDataFromVariables(parsed.data);
  if (certificate.recipient_name) data["recipient_name"] = certificate.recipient_name;
  if (certificate.course_title) data["course_title"] = certificate.course_title;
  data["credential_id"] = certificate.credential_id;
  data["verification_url"] = buildVerificationPath(certificate.credential_id);

  const html = await designDocumentToHtmlAsync(parsed.data, data, {
    watermark: false,
    verificationUrl: data["verification_url"],
  });

  return {
    filename: `certificate-${safeCredential || certificate.id}.html`,
    contentType: "text/html; charset=utf-8",
    body: html,
    fromStorage: false,
  };
}
