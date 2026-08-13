import { z } from "zod";
import { mutationBodySchema, uuidParamSchema } from "@atlas/membership/schemas/shared";

export const dimensionKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase alphanumeric with underscores.");

export const scoringProfileKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase alphanumeric with underscores.");

export const entityStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const competencyDimensionSchema = z.object({
  id: z.uuid(),
  key: dimensionKeySchema,
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const scoringProfileSchema = z.object({
  id: z.uuid(),
  key: scoringProfileKeySchema,
  name: z.string(),
  status: entityStatusSchema,
  activeConfigVersionId: z.uuid().nullable(),
  activeVersion: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const competencyBandSchema = z.object({
  id: z.uuid(),
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(200),
  minScore: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100),
  sortOrder: z.number().int().min(0).max(1000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const bandInputSchema = z
  .object({
    key: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(200),
    minScore: z.number().min(0).max(100),
    maxScore: z.number().min(0).max(100),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .strict();

export type BandInput = z.infer<typeof bandInputSchema>;

export function validateBandInputs(bands: BandInput[]): void {
  const keys = new Set<string>();
  const sortOrders = new Set<number>();

  for (const band of bands) {
    if (keys.has(band.key)) {
      throw new Error("Duplicate band key in request.");
    }
    keys.add(band.key);

    if (sortOrders.has(band.sortOrder)) {
      throw new Error("Duplicate band sort order in request.");
    }
    sortOrders.add(band.sortOrder);

    if (band.minScore > band.maxScore) {
      throw new Error("Band minScore must be less than or equal to maxScore.");
    }
  }

  const sorted = [...bands].sort((left, right) => left.minScore - right.minScore);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous && current && current.minScore <= previous.maxScore) {
      throw new Error("Band score ranges must not overlap.");
    }
  }
}

export const replaceBandsBodySchema = mutationBodySchema({
  bands: z.array(bandInputSchema).min(1).max(50),
}).superRefine((value, ctx) => {
  try {
    validateBandInputs(value.bands);
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Invalid band configuration.",
      path: ["bands"],
    });
  }
});

export const createDimensionBodySchema = mutationBodySchema({
  key: dimensionKeySchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
});

export const updateDimensionBodySchema = mutationBodySchema({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
}).refine((value) => value.name != null || value.description !== undefined, {
  message: "At least one field must be provided.",
});

export const createScoringProfileBodySchema = mutationBodySchema({
  key: scoringProfileKeySchema,
  name: z.string().trim().min(1).max(200),
  status: entityStatusSchema.default("ACTIVE"),
});

export const updateScoringProfileBodySchema = mutationBodySchema({
  name: z.string().trim().min(1).max(200).optional(),
  status: entityStatusSchema.optional(),
}).refine((value) => value.name != null || value.status != null, {
  message: "At least one field must be provided.",
});

export const publishScoringConfigBodySchema = mutationBodySchema({
  comment: z.string().trim().max(1000).optional(),
});

export const competencyDimensionListResponseSchema = z.object({
  data: z.array(competencyDimensionSchema),
});

export const competencyDimensionDetailResponseSchema = z.object({
  data: competencyDimensionSchema,
});

export const deleteDimensionResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export const scoringProfileListResponseSchema = z.object({
  data: z.array(scoringProfileSchema),
});

export const scoringProfileDetailResponseSchema = z.object({
  data: scoringProfileSchema,
});

export const competencyBandListResponseSchema = z.object({
  data: z.array(competencyBandSchema),
});

export const publishScoringConfigResponseSchema = z.object({
  data: z.object({
    profileId: z.uuid(),
    configVersionId: z.uuid(),
    version: z.number().int(),
    activatedAt: z.iso.datetime(),
    activeConfigVersionId: z.uuid(),
  }),
});

export const competencyDimensionIdParamsSchema = uuidParamSchema;
export const scoringProfileIdParamsSchema = uuidParamSchema;
export const scoringConfigPublishParamsSchema = uuidParamSchema;

export type CreateDimensionBody = z.infer<typeof createDimensionBodySchema>;
export type UpdateDimensionBody = z.infer<typeof updateDimensionBodySchema>;
export type CreateScoringProfileBody = z.input<typeof createScoringProfileBodySchema>;
export type UpdateScoringProfileBody = z.infer<typeof updateScoringProfileBodySchema>;
export type ReplaceBandsBody = z.infer<typeof replaceBandsBodySchema>;
export type PublishScoringConfigBody = z.infer<typeof publishScoringConfigBodySchema>;
