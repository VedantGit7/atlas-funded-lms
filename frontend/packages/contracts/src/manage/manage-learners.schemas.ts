import { z } from "zod";

export const manageLearnerArchiveResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    archivedAt: z.iso.datetime().nullable(),
  }),
});
