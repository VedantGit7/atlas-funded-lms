import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { SignedUploadResponseSchema } from "@atlas/storage/schemas/asset-reference";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { createCourseCoverUploadService } from "../../../../../../../server/courses/course-cover.service";
import { courseCoverUploadBodySchema } from "../../../../../../../server/courses/course-cover.schemas";
import { postCoverRouteMetadata } from "./route.metadata";

type CourseCoverUploadBody = z.output<typeof courseCoverUploadBodySchema>;
type SignedUploadResponse = z.output<typeof SignedUploadResponseSchema>;

export const POST = createTenantRoute<
  CourseCoverUploadBody,
  SignedUploadResponse,
  typeof uuidParamSchema
>({
  metadata: postCoverRouteMetadata,
  params: uuidParamSchema,
  body: courseCoverUploadBodySchema,
  output: SignedUploadResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await createCourseCoverUploadService(tx, ctx, courseId, input);
  },
});
