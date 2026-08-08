import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateBrandKitDetailResponseSchema,
  certificateBrandKitListResponseSchema,
  createCertificateBrandKitBodySchema,
  deleteCertificateBrandKitBodySchema,
  deleteCertificateBrandKitResponseSchema,
  updateCertificateBrandKitBodySchema,
} from "../../../../server/certificates/certificate.dto";
import {
  createCertificateBrandKit,
  deleteCertificateBrandKit,
  listCertificateBrandKits,
  updateCertificateBrandKit,
} from "../../../../server/certificates/certificate.service";
import {
  listCertificateBrandKitsMetadata,
  mutateCertificateBrandKitsMetadata,
} from "../../../../server/certificates/certificate.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof certificateBrandKitListResponseSchema>
>({
  metadata: listCertificateBrandKitsMetadata,
  output: certificateBrandKitListResponseSchema,
  handler: async ({ tx, ctx }) => listCertificateBrandKits(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createCertificateBrandKitBodySchema>,
  z.output<typeof certificateBrandKitDetailResponseSchema>
>({
  metadata: mutateCertificateBrandKitsMetadata,
  body: createCertificateBrandKitBodySchema,
  output: certificateBrandKitDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => createCertificateBrandKit(tx, ctx, input),
});

export const PUT = createTenantRoute<
  z.output<typeof updateCertificateBrandKitBodySchema>,
  z.output<typeof certificateBrandKitDetailResponseSchema>
>({
  metadata: mutateCertificateBrandKitsMetadata,
  body: updateCertificateBrandKitBodySchema,
  output: certificateBrandKitDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => updateCertificateBrandKit(tx, ctx, input),
});

export const DELETE = createTenantRoute<
  z.output<typeof deleteCertificateBrandKitBodySchema>,
  z.output<typeof deleteCertificateBrandKitResponseSchema>
>({
  metadata: mutateCertificateBrandKitsMetadata,
  body: deleteCertificateBrandKitBodySchema,
  output: deleteCertificateBrandKitResponseSchema,
  handler: async ({ tx, ctx, input }) => deleteCertificateBrandKit(tx, ctx, input),
});
