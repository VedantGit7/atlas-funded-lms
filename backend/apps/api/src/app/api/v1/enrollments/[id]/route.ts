import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { cancelEnrollmentById } from "../../../../../server/enrollments/enrollments.service";
import { enrollmentCancelResponseSchema } from "../../../../../server/enrollments/schemas";
import { deleteEnrollmentRouteMetadata } from "./route.metadata";

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof enrollmentCancelResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteEnrollmentRouteMetadata,
  params: uuidParamSchema,
  output: enrollmentCancelResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const enrollmentId = params["id"];
    if (!enrollmentId) throw new Error("Missing enrollment id");
    return cancelEnrollmentById(tx, ctx, enrollmentId);
  },
});
