import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { AssetReferenceViewSchema } from "@atlas/storage/schemas/asset-reference";
import { confirmLessonAssetUploadService } from "../../../../../../../server/lessons/lesson-asset-upload.service";
import { lessonAssetConfirmBodySchema } from "../../../../../../../server/lessons/lesson-schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { postConfirmRouteMetadata } from "../upload/route.metadata";

type LessonAssetConfirmBody = z.output<typeof lessonAssetConfirmBodySchema>;

const confirmResponseSchema = z.object({
  data: AssetReferenceViewSchema,
});

export const POST = createTenantRoute<
  LessonAssetConfirmBody,
  z.output<typeof confirmResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postConfirmRouteMetadata,
  params: uuidParamSchema,
  body: lessonAssetConfirmBodySchema,
  output: confirmResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await confirmLessonAssetUploadService(tx, ctx, lessonId, input);
  },
});
