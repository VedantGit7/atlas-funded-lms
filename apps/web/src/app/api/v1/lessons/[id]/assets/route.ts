import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  attachLessonAsset,
  listLessonAssetsForLesson,
  removeLessonAsset,
} from "../../../../../../server/lessons/lesson-assets.service";
import {
  createLessonAssetBodySchema,
  deleteLessonAssetQuerySchema,
  deleteLessonAssetResponseSchema,
  lessonAssetItemSchema,
  lessonAssetsResponseSchema,
  lessonDetailQuerySchema,
} from "../../../../../../server/lessons/lesson-schemas";
import { deleteRouteMetadata, getRouteMetadata, postRouteMetadata } from "./route.metadata";

type LessonDetailQuery = z.output<typeof lessonDetailQuerySchema>;
type CreateLessonAssetBody = z.output<typeof createLessonAssetBodySchema>;
type DeleteLessonAssetQuery = z.output<typeof deleteLessonAssetQuerySchema>;

const attachLessonAssetResponseSchema = z.object({
  data: lessonAssetItemSchema,
});

export const GET = createTenantRoute<
  LessonDetailQuery,
  z.output<typeof lessonAssetsResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  input: lessonDetailQuerySchema,
  output: lessonAssetsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await listLessonAssetsForLesson(tx, ctx, lessonId, input);
  },
});

export const POST = createTenantRoute<
  CreateLessonAssetBody,
  z.output<typeof attachLessonAssetResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: createLessonAssetBodySchema,
  output: attachLessonAssetResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await attachLessonAsset(tx, ctx, lessonId, input);
  },
});

export const DELETE = createTenantRoute<
  DeleteLessonAssetQuery,
  z.output<typeof deleteLessonAssetResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteRouteMetadata,
  params: uuidParamSchema,
  input: deleteLessonAssetQuerySchema,
  output: deleteLessonAssetResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await removeLessonAsset(tx, ctx, lessonId, input.assetId);
  },
});
