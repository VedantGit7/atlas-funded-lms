// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import type { CertificateIssueBody } from "./certificate.contract";
import { certificateNotFound, certificateTemplateNotFound } from "./certificate.errors";
import { certificateRepository } from "./certificate.repository";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadCertificateTemplateCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "certificate_template_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export async function loadCertificateTemplateResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  templateId: string;
}) {
  const template = await certificateRepository.findTemplateById(args.tx, args.templateId);

  if (!template || template.tenant_id !== args.ctx.tenantId) {
    throw certificateTemplateNotFound();
  }

  return createTenantResourceRef({
    type: "certificate_template",
    id: template.id,
    tenantId: args.ctx.tenantId,
  });
}

export async function loadCertificateTemplateResourceRefFromBody(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: { id: string };
}) {
  return loadCertificateTemplateResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    templateId: args.input.id,
  });
}

export function loadCertificateCatalogResourceRef(args: { ctx: LoaderCtx }) {
  // The certificate list is self-scoped for non-admins (the service forces
  // `membershipId = actor`), so the catalog surface asserts the `selfCertificate`
  // relationship required by `certificate.read`. Per-row ownership is still
  // enforced by the SQL query in the service.
  return Promise.resolve(
    createTenantResourceRef({
      type: "certificate_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
      relationships: { selfCertificate: args.ctx.actorMembershipId },
    }),
  );
}

export async function loadCertificateResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  certificateId: string;
}) {
  const certificate = await certificateRepository.findCertificateById(args.tx, args.certificateId);

  if (!certificate || certificate.tenant_id !== args.ctx.tenantId) {
    throw certificateNotFound();
  }

  const relationships: Record<string, boolean | string> = {};

  if (certificate.membership_id === args.ctx.actorMembershipId) {
    relationships["selfCertificate"] = args.ctx.actorMembershipId;
  }

  const source =
    certificate.metadata_json &&
    typeof certificate.metadata_json === "object" &&
    "source" in certificate.metadata_json
      ? (certificate.metadata_json as { source?: { type?: string; id?: string } }).source
      : null;

  if (source?.type === "course" && source.id) {
    const instructorId = await certificateRepository.courseInstructorMembershipId(
      args.tx,
      source.id,
    );
    if (instructorId === args.ctx.actorMembershipId) {
      relationships["instructorOfCourse"] = args.ctx.actorMembershipId;
    }
  }

  if (source?.type === "learning_path" && source.id) {
    const instructorId = await certificateRepository.pathInstructorMembershipId(args.tx, source.id);
    if (instructorId === args.ctx.actorMembershipId) {
      relationships["instructorOfPath"] = args.ctx.actorMembershipId;
    }
  }

  return createTenantResourceRef({
    type: "certificate",
    id: certificate.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: certificate.membership_id,
    relationships,
  });
}

export async function loadCertificateIssueResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: CertificateIssueBody;
}) {
  const relationships: Record<string, boolean | string> = {};

  if (args.input.source.type === "course") {
    const instructorId = await certificateRepository.courseInstructorMembershipId(
      args.tx,
      args.input.source.id,
    );
    if (instructorId === args.ctx.actorMembershipId) {
      relationships["instructorOfCourse"] = args.ctx.actorMembershipId;
    }
  }

  if (args.input.source.type === "learning_path") {
    const instructorId = await certificateRepository.pathInstructorMembershipId(
      args.tx,
      args.input.source.id,
    );
    if (instructorId === args.ctx.actorMembershipId) {
      relationships["instructorOfPath"] = args.ctx.actorMembershipId;
    }
  }

  if (args.input.source.type === "assessment") {
    const authorId = await certificateRepository.assessmentAuthorMembershipId(
      args.tx,
      args.input.source.id,
    );
    if (authorId === args.ctx.actorMembershipId) {
      relationships["instructorOfCourse"] = args.ctx.actorMembershipId;
    }
  }

  return createTenantResourceRef({
    type: "certificate_issue",
    id: args.input.templateId,
    tenantId: args.ctx.tenantId,
    relationships,
  });
}
