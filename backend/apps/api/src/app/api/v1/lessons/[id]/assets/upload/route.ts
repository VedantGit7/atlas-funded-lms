import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { SignedUploadResponseSchema } from "@atlas/storage/schemas/asset-reference";
import { createLessonAssetUploadService } from "../../../../../../../server/lessons/lesson-asset-upload.service";
import { lessonAssetUploadBodySchema } from "../../../../../../../server/lessons/lesson-schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { postUploadRouteMetadata } from "./route.metadata";

type LessonAssetUploadBody = z.output<typeof lessonAssetUploadBodySchema>;
type SignedUploadResponse = z.output<typeof SignedUploadResponseSchema>;

export const POST = createTenantRoute<
  LessonAssetUploadBody,
  SignedUploadResponse,
  typeof uuidParamSchema
>({
  metadata: postUploadRouteMetadata,
  params: uuidParamSchema,
  body: lessonAssetUploadBodySchema,
  output: SignedUploadResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await createLessonAssetUploadService(tx, ctx, lessonId, input);
  },
});
