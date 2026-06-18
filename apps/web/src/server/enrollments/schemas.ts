import { z } from "zod";

export const enrollmentCreateBodySchema = z
  .object({
    courseId: z.string().uuid(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    userId: z.never().optional(),
    memberId: z.never().optional(),
    membershipId: z.never().optional(),
    status: z.never().optional(),
    source: z.never().optional(),
    role: z.never().optional(),
  })
  .strict();

export const enrollmentResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    courseId: z.string().uuid(),
    status: z.literal("active"),
    enrolledAt: z.string().datetime(),
    created: z.boolean(),
  }),
});
