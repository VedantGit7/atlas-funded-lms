import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  parseCourseCoverBlobRequest,
  storeCourseCoverBlobService,
  type CourseCoverBlobBody,
} from "../../../../../../../server/courses/course-cover.service";
import { courseCoverBlobResponseSchema } from "../../../../../../../server/courses/course-cover.schemas";
import { postCoverRouteMetadata } from "../upload/route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local development only: stores the image when there's no R2 to upload to. */
export const POST = createTenantRoute<
  CourseCoverBlobBody,
  z.output<typeof courseCoverBlobResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postCoverRouteMetadata,
  params: uuidParamSchema,
  readBody: parseCourseCoverBlobRequest,
  output: courseCoverBlobResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await storeCourseCoverBlobService(tx, ctx, courseId, input);
  },
});
