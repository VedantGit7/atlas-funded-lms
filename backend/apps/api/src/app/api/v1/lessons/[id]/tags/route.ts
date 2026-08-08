import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  createTagAndAttachToLesson,
  detachTagFromLessonForStudio,
  listLessonTags,
  replaceTagsOnLesson,
} from "../../../../../../server/tags/tags.service";
import {
  createTagBodySchema,
  lessonTagsResponseSchema,
  replaceLessonTagsBodySchema,
  tagDetailSchema,
} from "../../../../../../server/tags/tag-schemas";
import {
  deleteRouteMetadata,
  getRouteMetadata,
  postRouteMetadata,
  putRouteMetadata,
} from "./route.metadata";

type ReplaceLessonTagsBody = z.output<typeof replaceLessonTagsBodySchema>;
type CreateTagBody = z.output<typeof createTagBodySchema>;

const createLessonTagResponseSchema = z.object({
  data: z.object({
    tag: tagDetailSchema,
    lessonTags: lessonTagsResponseSchema.shape.data,
  }),
});

const detachLessonTagQuerySchema = z
  .object({
    tagId: z.string().uuid(),
  })
  .strict();

export const GET = createTenantRoute<
  { view?: "studio" },
  z.output<typeof lessonTagsResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  input: z.object({ view: z.literal("studio").optional() }).strict(),
  output: lessonTagsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await listLessonTags(tx, ctx, lessonId, { studio: input.view === "studio" });
  },
});

export const PUT = createTenantRoute<
  ReplaceLessonTagsBody,
  z.output<typeof lessonTagsResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: replaceLessonTagsBodySchema,
  output: lessonTagsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await replaceTagsOnLesson(tx, ctx, lessonId, input);
  },
});

export const POST = createTenantRoute<
  CreateTagBody,
  z.output<typeof createLessonTagResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: createTagBodySchema,
  output: createLessonTagResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    const result = await createTagAndAttachToLesson(tx, ctx, lessonId, input);
    return {
      data: {
        tag: result.tag,
        lessonTags: result.lessonTags.data,
      },
    };
  },
});

export const DELETE = createTenantRoute<
  z.output<typeof detachLessonTagQuerySchema>,
  z.output<typeof lessonTagsResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteRouteMetadata,
  params: uuidParamSchema,
  input: detachLessonTagQuerySchema,
  output: lessonTagsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await detachTagFromLessonForStudio(tx, ctx, lessonId, input.tagId);
  },
});
