// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { z } from "zod";
import { pageInfoSchema } from "@atlas/membership/schemas/shared";

export const courseProgressListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export type CourseProgressListQuery = z.output<typeof courseProgressListQuerySchema>;

export const courseProgressItemSchema = z.object({
  membershipId: z.uuid(),
  displayName: z.string().nullable(),
  progressPct: z.number().int().min(0).max(100),
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
});

export const courseProgressListResponseSchema = z.object({
  data: z.object({
    items: z.array(courseProgressItemSchema),
    pageInfo: pageInfoSchema,
  }),
});
