import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadCertificateCatalogResourceRef,
  loadCertificateIssueResourceRef,
  loadCertificateResourceRef,
  loadCertificateTemplateCatalogResourceRef,
  loadCertificateTemplateResourceRef,
  loadCertificateTemplateResourceRefFromBody,
} from "./certificate.resource-loaders";
import type { CertificateIssueBody } from "./certificate.contract";

export const listCertificateTemplatesMetadata = {
  permission: "certificate_template.read",
  entitlement: "certification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadCertificateTemplateCatalogResourceRef,
} satisfies RouteMetadata;

export const mutateCertificateTemplatesMetadata = {
  permission: "certificate_template.manage",
  entitlement: "certification.enable",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadCertificateTemplateCatalogResourceRef,
} satisfies RouteMetadata;

export const updateCertificateTemplateMetadata = {
  permission: "certificate_template.manage",
  entitlement: "certification.enable",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadCertificateTemplateResourceRefFromBody({
      tx,
      ctx,
      input: input as { id: string },
    }),
} satisfies RouteMetadata;

export const deleteCertificateTemplateMetadata = {
  permission: "certificate_template.manage",
  entitlement: "certification.enable",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadCertificateTemplateResourceRefFromBody({
      tx,
      ctx,
      input: input as { id: string },
    }),
} satisfies RouteMetadata;

export const publishCertificateTemplateMetadata = {
  permission: "certificate_template.publish",
  entitlement: "certification.enable",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadCertificateTemplateResourceRef({
      tx,
      ctx,
      templateId: params["id"] ?? "",
    }),
} satisfies RouteMetadata;

export const listCertificatesMetadata = {
  permission: "certificate.read",
  entitlement: "certification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadCertificateCatalogResourceRef,
} satisfies RouteMetadata;

export const issueCertificateMetadata = {
  permission: "certificate.issue",
  entitlement: "certification.enable",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadCertificateIssueResourceRef({
      tx,
      ctx,
      input: input as CertificateIssueBody,
    }),
} satisfies RouteMetadata;

export const revokeCertificateMetadata = {
  permission: "certificate.revoke",
  entitlement: "certification.enable",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadCertificateResourceRef({
      tx,
      ctx,
      certificateId: params["id"] ?? "",
    }),
} satisfies RouteMetadata;
