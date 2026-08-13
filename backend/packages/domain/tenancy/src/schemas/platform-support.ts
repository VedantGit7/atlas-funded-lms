import { z } from "zod";

export const OpenSupportSessionRequestSchema = z.object({
  tenantId: z.uuid(),
  reason: z.string().min(10).max(1000),
});

export const SupportSessionViewSchema = z.object({
  sessionId: z.uuid(),
  tenantId: z.uuid(),
  tenantSlug: z.string(),
  tenantDisplayName: z.string(),
  openedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  status: z.enum(["ACTIVE", "EXPIRED"]),
});

export const OpenSupportSessionResponseSchema = z.object({
  data: SupportSessionViewSchema,
});

export const ActiveSupportSessionListSchema = z.object({
  data: z.array(SupportSessionViewSchema),
});

export type SupportSessionView = z.infer<typeof SupportSessionViewSchema>;
