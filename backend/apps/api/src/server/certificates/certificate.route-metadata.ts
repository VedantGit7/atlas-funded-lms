import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadCertificateCatalogResourceRef,
  loadCertificateIssueResourceRef,
  loadCertificateResourceRef,
  loadCertificateTemplateCatalogResourceRef,
  loadCertificateTemplateResourceRef,
  loadCertificateTemplateResourceRefFromBody,
} from "./certificate.resource-loaders";
import type { CertificateBulkIssueBody, CertificateIssueBody } from "./certificate.contract";

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

export const renderCertificatePreviewMetadata = {
  permission: "certificate_template.read",
  entitlement: "certification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadCertificateTemplateCatalogResourceRef,
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

export const bulkIssueCertificateMetadata = {
  ...issueCertificateMetadata,
  resourceLoader: async ({ tx, ctx, input }) => {
    const bulk = input as CertificateBulkIssueBody;
    const first = bulk.recipients[0];
    return loadCertificateIssueResourceRef({
      tx,
      ctx,
      input: {
        templateId: bulk.templateId,
        recipientMembershipId: first?.recipientMembershipId ?? ctx.actorMembershipId,
        source: first?.source ?? {
          type: "course",
          id: "00000000-0000-0000-0000-000000000000",
        },
      },
    });
  },
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

export const certificateLifecycleMetadata = revokeCertificateMetadata;

export const certificateWalletPassMetadata = {
  permission: "certificate.read",
  entitlement: "certification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadCertificateResourceRef({
      tx,
      ctx,
      certificateId: params["id"] ?? "",
    }),
} satisfies RouteMetadata;

export const downloadAppleWalletPassMetadata = {
  ...certificateWalletPassMetadata,
  rateLimit: "authenticatedTenantRead",
} satisfies RouteMetadata;

export const reissueCertificateMetadata = {
  ...revokeCertificateMetadata,
  permission: "certificate.issue",
} satisfies RouteMetadata;

export const certificateAnalyticsMetadata = listCertificatesMetadata;

export const getCertificateMetadata = {
  ...listCertificatesMetadata,
  resourceLoader: async ({ tx, ctx, params }) =>
    loadCertificateResourceRef({
      tx,
      ctx,
      certificateId: params["id"] ?? "",
    }),
} satisfies RouteMetadata;

export const approveCertificateTemplateMetadata = {
  ...publishCertificateTemplateMetadata,
} satisfies RouteMetadata;

export const downloadCertificateMetadata = {
  ...getCertificateMetadata,
} satisfies RouteMetadata;

export const listCertificateBrandKitsMetadata = {
  permission: "certificate_template.read",
  entitlement: "certification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadCertificateTemplateCatalogResourceRef,
} satisfies RouteMetadata;

export const mutateCertificateBrandKitsMetadata = {
  permission: "certificate_template.manage",
  entitlement: "certification.enable",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadCertificateTemplateCatalogResourceRef,
} satisfies RouteMetadata;
