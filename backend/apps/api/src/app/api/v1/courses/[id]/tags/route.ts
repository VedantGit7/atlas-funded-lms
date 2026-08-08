import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  createTagAndAttachToCourse,
  detachTagFromCourseForStudio,
  listCourseTags,
  replaceTagsOnCourse,
} from "../../../../../../server/tags/tags.service";
import {
  courseTagsResponseSchema,
  createTagBodySchema,
  replaceCourseTagsBodySchema,
  tagDetailSchema,
} from "../../../../../../server/tags/tag-schemas";
import {
  deleteRouteMetadata,
  getRouteMetadata,
  postRouteMetadata,
  putRouteMetadata,
} from "./route.metadata";

type ReplaceCourseTagsBody = z.output<typeof replaceCourseTagsBodySchema>;
type CreateTagBody = z.output<typeof createTagBodySchema>;

const createCourseTagResponseSchema = z.object({
  data: z.object({
    tag: tagDetailSchema,
    courseTags: courseTagsResponseSchema.shape.data,
  }),
});

const detachCourseTagQuerySchema = z
  .object({
    tagId: z.string().uuid(),
  })
  .strict();

export const GET = createTenantRoute<
  { view?: "studio" },
  z.output<typeof courseTagsResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  input: z.object({ view: z.literal("studio").optional() }).strict(),
  output: courseTagsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await listCourseTags(tx, ctx, courseId, { studio: input.view === "studio" });
  },
});

export const PUT = createTenantRoute<
  ReplaceCourseTagsBody,
  z.output<typeof courseTagsResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: replaceCourseTagsBodySchema,
  output: courseTagsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await replaceTagsOnCourse(tx, ctx, courseId, input);
  },
});

export const POST = createTenantRoute<
  CreateTagBody,
  z.output<typeof createCourseTagResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: createTagBodySchema,
  output: createCourseTagResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    const result = await createTagAndAttachToCourse(tx, ctx, courseId, input);
    return {
      data: {
        tag: result.tag,
        courseTags: result.courseTags.data,
      },
    };
  },
});

export const DELETE = createTenantRoute<
  z.output<typeof detachCourseTagQuerySchema>,
  z.output<typeof courseTagsResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteRouteMetadata,
  params: uuidParamSchema,
  input: detachCourseTagQuerySchema,
  output: courseTagsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await detachTagFromCourseForStudio(tx, ctx, courseId, input.tagId);
  },
});
