import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  tenantLearnerEmailVerificationResponseSchema,
  updateTenantLearnerEmailVerificationBodySchema,
} from "../../../../../server/tenant-settings/tenant-settings.contract";
import {
  readTenantLearnerEmailVerification,
  updateTenantLearnerEmailVerification,
} from "../../../../../server/tenant-settings/tenant-settings.service";
import { routeMetadata } from "./route.metadata";

type Response = z.output<typeof tenantLearnerEmailVerificationResponseSchema>;
type Body = z.output<typeof updateTenantLearnerEmailVerificationBodySchema>;

export const GET = createTenantRoute<Record<string, never>, Response>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  output: tenantLearnerEmailVerificationResponseSchema,
  handler: async ({ tx }) => {
    const data = await readTenantLearnerEmailVerification(tx);
    return { data };
  },
});

export const PUT = createTenantRoute<Body, Response>({
  metadata: routeMetadata.PUT,
  body: updateTenantLearnerEmailVerificationBodySchema,
  output: tenantLearnerEmailVerificationResponseSchema,
  handler: async ({ tx, input }) => {
    const data = await updateTenantLearnerEmailVerification(tx, input.verificationDays);
    return { data };
  },
});
