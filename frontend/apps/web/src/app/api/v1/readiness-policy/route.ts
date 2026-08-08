import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  getReadinessPolicy,
  updateReadinessPolicy,
} from "../../../../server/readiness/readiness-policy.service";
import {
  readinessPolicyResponseSchema,
  updateReadinessPolicyBodySchema,
} from "../../../../server/readiness/readiness.schemas";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type UpdateReadinessPolicyBody = z.output<typeof updateReadinessPolicyBodySchema>;
type ReadinessPolicyResponse = z.output<typeof readinessPolicyResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, ReadinessPolicyResponse>({
  metadata: getRouteMetadata,
  output: readinessPolicyResponseSchema,
  handler: async ({ tx }) => getReadinessPolicy(tx),
});

export const PUT = createTenantRoute<UpdateReadinessPolicyBody, ReadinessPolicyResponse>({
  metadata: putRouteMetadata,
  body: updateReadinessPolicyBodySchema,
  output: readinessPolicyResponseSchema,
  handler: async ({ tx, ctx, input }) => updateReadinessPolicy(tx, ctx, input),
});
