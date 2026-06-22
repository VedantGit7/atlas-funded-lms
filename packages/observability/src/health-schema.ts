import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("atlas-lms"),
  status: z.literal("healthy"),
  requestId: z.string().regex(/^req_[a-f0-9-]{36}$/i),
  environment: z.string().min(1).optional(),
  release: z.string().min(1).optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
