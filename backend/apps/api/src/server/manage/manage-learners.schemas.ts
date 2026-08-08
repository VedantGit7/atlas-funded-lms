import { z } from "zod";

export const manageLearnerArchiveResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    archivedAt: z.string().datetime().nullable(),
  }),
});
