import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  AddBillingLocationRequestSchema,
  BillingLocationListResponseSchema,
  BillingLocationViewSchema,
  type AddBillingLocationRequest,
  type BillingLocationListResponse,
  type BillingLocationView,
} from "@atlas/domain-config/schemas/learner-billing";
import { z } from "zod";
import {
  addBillingLocation,
  listBillingLocations,
} from "@atlas/domain-config/services/learner-billing.service";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

const AddLocationResponseSchema = z.object({ data: BillingLocationViewSchema });

export const GET = createTenantRoute<Record<string, never>, BillingLocationListResponse>({
  metadata: getRouteMetadata,
  input: noBodySchema,
  output: BillingLocationListResponseSchema,
  handler: async ({ tx }) => listBillingLocations(tx),
});

export const POST = createTenantRoute<AddBillingLocationRequest, { data: BillingLocationView }>({
  metadata: postRouteMetadata,
  body: AddBillingLocationRequestSchema,
  output: AddLocationResponseSchema,
  handler: async ({ tx, input }) =>
    addBillingLocation(tx, {
      locationKey: input.locationKey,
      title: input.title,
      currency: input.currency,
      description: input.description ?? null,
    }),
});
