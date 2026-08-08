import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  marketingEmailAudienceEstimateQuerySchema,
  marketingEmailAudienceEstimateResponseSchema,
} from "./marketing-email.schemas";
import { marketingEmailRepository } from "./marketing-email.repository";

function validationError(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

/**
 * Kept in a shallow module (not marketing-email.service) so nested
 * email-campaigns/[id] routes do not recompile against the estimate schemas
 * under Turbopack and poison unrelated public routes like bootstrap.
 */
export async function estimateMarketingEmailAudience(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query = marketingEmailAudienceEstimateQuerySchema.parse(rawQuery ?? {});
  let audienceBatchId: string | null = null;
  if (query.audienceType === "GROUP") {
    audienceBatchId = query.audienceBatchId ?? null;
    if (!audienceBatchId || !(await marketingEmailRepository.batchExists(tx, audienceBatchId))) {
      throw validationError("Selected group was not found.");
    }
  }

  const preview = await marketingEmailRepository.previewRecipients(tx, {
    audienceType: query.audienceType,
    audienceBatchId,
    limit: 1,
  });

  return marketingEmailAudienceEstimateResponseSchema.parse({
    data: {
      audienceType: query.audienceType,
      audienceBatchId,
      totalCount: preview.totalCount,
    },
  });
}
