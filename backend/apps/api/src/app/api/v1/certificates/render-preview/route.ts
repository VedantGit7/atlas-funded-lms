import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateRenderPreviewBodySchema,
  certificateRenderPreviewResponseSchema,
} from "../../../../../server/certificates/certificate.dto";
import { renderCertificatePreview } from "../../../../../server/certificates/certificate-render.service";
import { renderCertificatePreviewMetadata } from "../../../../../server/certificates/certificate.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof certificateRenderPreviewBodySchema>,
  z.output<typeof certificateRenderPreviewResponseSchema>
>({
  metadata: renderCertificatePreviewMetadata,
  body: certificateRenderPreviewBodySchema,
  output: certificateRenderPreviewResponseSchema,
  handler: async ({ tx, ctx, input }) => renderCertificatePreview(tx, ctx, input),
});
