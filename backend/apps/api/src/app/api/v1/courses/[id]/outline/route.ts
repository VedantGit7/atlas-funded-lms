import { createTenantRoute } from "@atlas/api";
import { courseIdParamsSchema } from "../../../../../../server/courses/schemas";
import { getLearnerCourseOutline } from "../../../../../../server/courses/course-outline.service";
import { learnerCourseOutlineResponseSchema } from "../../../../../../server/courses/course-outline.schemas";
import { getRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: getRouteMetadata,
  params: courseIdParamsSchema,
  output: learnerCourseOutlineResponseSchema,
  handler: async ({ tx, ctx, params, resource }) => {
    const { id } = courseIdParamsSchema.parse(params);
    return await getLearnerCourseOutline(tx, ctx, id, resource);
  },
});
