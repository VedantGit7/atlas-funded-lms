import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { certificateWalletPassResponseSchema } from "../../../../../../../server/certificates/certificate.dto";
import { certificateParamsSchema } from "../../../../../../../server/certificates/certificate.params";
import {
  completeAppleWalletPassIssue,
  planAppleWalletPassIssue,
  type AppleWalletIssuePlan,
} from "../../../../../../../server/certificates/certificate-wallet.service";
import { certificateWalletPassMetadata } from "../../../../../../../server/certificates/certificate.route-metadata";

/**
 * Issues (or reissues) the certificate's Apple Wallet pass. Signing and the
 * object-storage upload run after the request transaction commits (audit H3).
 */
export const POST = createTenantRoute<
  Record<string, never>,
  AppleWalletIssuePlan,
  typeof certificateParamsSchema
>({
  metadata: certificateWalletPassMetadata,
  params: certificateParamsSchema,
  output: certificateWalletPassResponseSchema,
  handler: async ({ tx, ctx, params }) => planAppleWalletPassIssue(tx, ctx, params.id),
  afterCommit: async ({
    result,
    ctx,
  }): Promise<z.output<typeof certificateWalletPassResponseSchema>> =>
    completeAppleWalletPassIssue(result, ctx),
});
