import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  parseLessonAssetBlobRequest,
  storeLessonAssetBlobService,
} from "../../../../../../../server/lessons/lesson-asset-upload.service";
import {
  lessonAssetBlobResponseSchema,
  type LessonAssetBlobBody,
} from "../../../../../../../server/lessons/lesson-schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { postBlobRouteMetadata } from "../upload/route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createTenantRoute<
  LessonAssetBlobBody,
  z.output<typeof lessonAssetBlobResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postBlobRouteMetadata,
  params: uuidParamSchema,
  readBody: parseLessonAssetBlobRequest,
  output: lessonAssetBlobResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await storeLessonAssetBlobService(tx, ctx, lessonId, input);
  },
});
