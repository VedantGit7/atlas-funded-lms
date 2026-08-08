import { z } from "zod";

export const VideoProviderSchema = z.enum(["youtube", "vimeo", "bunny"]);

export const ProviderVideoRefSchema = z.object({
  provider: VideoProviderSchema,
  url: z.string().url(),
  externalId: z.string().min(1).max(240).nullable().optional(),
  title: z.string().max(240).nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
});

export type ProviderVideoRef = z.infer<typeof ProviderVideoRefSchema>;
