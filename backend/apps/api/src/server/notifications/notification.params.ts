import { z } from "zod";

export const notificationParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();
