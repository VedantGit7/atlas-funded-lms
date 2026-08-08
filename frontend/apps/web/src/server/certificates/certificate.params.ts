import { z } from "zod";

export const certificateTemplateParamsSchema = z.object({
  id: z.string().uuid(),
});

export const certificateParamsSchema = z.object({
  id: z.string().uuid(),
});

export const publicCredentialParamsSchema = z.object({
  credentialId: z.string().min(1).max(128),
});
