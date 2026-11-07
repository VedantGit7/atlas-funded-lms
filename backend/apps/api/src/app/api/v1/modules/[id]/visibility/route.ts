import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  contentVisibilityBodySchema,
  contentVisibilityResponseSchema,
} from "../../../../../../server/courses/course-authoring-schemas";
import { setModuleVisibility } from "../../../../../../server/courses/course-visibility.service";
import { putRouteMetadata } from "./route.metadata";

export const PUT = createTenantRoute<
  z.output<typeof contentVisibilityBodySchema>,
  z.output<typeof contentVisibilityResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: contentVisibilityBodySchema,
  output: contentVisibilityResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await setModuleVisibility(tx, ctx, moduleId, input);
  },
});
