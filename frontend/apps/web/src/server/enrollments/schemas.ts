// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { z } from "zod";
import { pageInfoSchema } from "@atlas/membership/schemas/shared";

export const enrollmentCreateBodySchema = z
  .object({
    courseId: z.uuid(),
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
    id: z.uuid(),
    courseId: z.uuid(),
    status: z.literal("active"),
    enrolledAt: z.iso.datetime(),
    created: z.boolean(),
  }),
});

export const enrollmentListQuerySchema = z
  .object({
    courseId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export type EnrollmentListQuery = z.output<typeof enrollmentListQuerySchema>;

export const enrollmentListItemSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  membershipId: z.uuid(),
  displayName: z.string().nullable(),
  status: z.string(),
  enrolledAt: z.iso.datetime(),
});

export const enrollmentListResponseSchema = z.object({
  data: z.object({
    items: z.array(enrollmentListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});
