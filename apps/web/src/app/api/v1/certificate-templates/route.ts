import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateTemplateDetailResponseSchema,
  certificateTemplateListResponseSchema,
  createCertificateTemplateBodySchema,
  deleteCertificateTemplateBodySchema,
  deleteCertificateTemplateResponseSchema,
  updateCertificateTemplateBodySchema,
} from "../../../../server/certificates/certificate.dto";
import {
  createCertificateTemplate,
  deleteCertificateTemplate,
  listCertificateTemplates,
  updateCertificateTemplate,
} from "../../../../server/certificates/certificate.service";
import {
  deleteCertificateTemplateMetadata,
  listCertificateTemplatesMetadata,
  mutateCertificateTemplatesMetadata,
  updateCertificateTemplateMetadata,
} from "../../../../server/certificates/certificate.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof certificateTemplateListResponseSchema>
>({
  metadata: listCertificateTemplatesMetadata,
  output: certificateTemplateListResponseSchema,
  handler: async ({ tx, ctx }) => listCertificateTemplates(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createCertificateTemplateBodySchema>,
  z.output<typeof certificateTemplateDetailResponseSchema>
>({
  metadata: mutateCertificateTemplatesMetadata,
  body: createCertificateTemplateBodySchema,
  output: certificateTemplateDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => createCertificateTemplate(tx, ctx, input),
});

export const PUT = createTenantRoute<
  z.output<typeof updateCertificateTemplateBodySchema>,
  z.output<typeof certificateTemplateDetailResponseSchema>
>({
  metadata: updateCertificateTemplateMetadata,
  body: updateCertificateTemplateBodySchema,
  output: certificateTemplateDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => updateCertificateTemplate(tx, ctx, input),
});

export const DELETE = createTenantRoute<
  z.output<typeof deleteCertificateTemplateBodySchema>,
  z.output<typeof deleteCertificateTemplateResponseSchema>
>({
  metadata: deleteCertificateTemplateMetadata,
  body: deleteCertificateTemplateBodySchema,
  output: deleteCertificateTemplateResponseSchema,
  handler: async ({ tx, ctx, input }) => deleteCertificateTemplate(tx, ctx, input),
});
