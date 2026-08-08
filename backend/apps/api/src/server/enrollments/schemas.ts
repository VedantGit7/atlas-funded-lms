import { z } from "zod";
import { pageInfoSchema } from "@atlas/membership/schemas/shared";

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

export const enrollmentListQuerySchema = z
  .object({
    courseId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export type EnrollmentListQuery = z.output<typeof enrollmentListQuerySchema>;

export const enrollmentListItemSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  membershipId: z.string().uuid(),
  displayName: z.string().nullable(),
  status: z.string(),
  enrolledAt: z.string().datetime(),
});

export const enrollmentListResponseSchema = z.object({
  data: z.object({
    items: z.array(enrollmentListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const enrollmentCancelResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    courseId: z.string().uuid(),
    membershipId: z.string().uuid(),
    status: z.literal("cancelled"),
    cancelledAt: z.string().datetime(),
  }),
});
