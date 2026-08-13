import { z } from "zod";

export const releaseVerdictSchema = z.enum([
  "NOT_READY",
  "READY_FOR_STAGING",
  "READY_FOR_PRODUCTION_REVIEW",
]);

export type ReleaseVerdict = z.infer<typeof releaseVerdictSchema>;

export const gateSeveritySchema = z.enum(["P0", "P1", "P2"]);

export const gateKindSchema = z.enum(["automated", "manual"]);

export const gateStatusSchema = z.enum([
  "passed",
  "failed",
  "skipped",
  "manual_required",
  "not_applicable",
]);

export const releaseGateResultSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: gateKindSchema,
  severity: gateSeveritySchema,
  status: gateStatusSchema,
  command: z.string().optional(),
  message: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export type ReleaseGateResult = z.infer<typeof releaseGateResultSchema>;

export const releaseEvidenceSchema = z.object({
  schemaVersion: z.literal("1"),
  storyId: z.literal("ATL-STORY-045"),
  generatedAt: z.iso.datetime(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  environment: z.string().optional(),
  verdict: releaseVerdictSchema,
  productionApproved: z.literal(false),
  gates: z.array(releaseGateResultSchema),
  manualGatesRequired: z.array(z.string()),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  rollbackTarget: z.string().nullable().optional(),
});

export type ReleaseEvidence = z.infer<typeof releaseEvidenceSchema>;

export function parseReleaseEvidence(input: unknown): ReleaseEvidence {
  return releaseEvidenceSchema.parse(input);
}

export function safeParseReleaseEvidence(input: unknown) {
  return releaseEvidenceSchema.safeParse(input);
}
