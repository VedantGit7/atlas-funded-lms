import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  joinAffiliateProgramBodySchema,
  myAffiliateResponseSchema,
  updateMyAffiliatePayoutBodySchema,
} from "../../../../../server/sales-affiliates/sales-affiliates.schemas";
import {
  learnerAffiliateReadMetadata,
  learnerAffiliateWriteMetadata,
} from "../../../../../server/sales-affiliates/sales-affiliates.route-metadata";
import {
  getMyAffiliate,
  joinAffiliateProgram,
  updateMyAffiliatePayoutDetails,
} from "../../../../../server/sales-affiliates/sales-affiliates.service";

export const GET = createTenantRoute<undefined, z.output<typeof myAffiliateResponseSchema>>({
  metadata: learnerAffiliateReadMetadata,
  output: myAffiliateResponseSchema,
  handler: async ({ tx, ctx }) => getMyAffiliate(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof joinAffiliateProgramBodySchema>,
  z.output<typeof myAffiliateResponseSchema>
>({
  metadata: learnerAffiliateWriteMetadata,
  body: joinAffiliateProgramBodySchema,
  output: myAffiliateResponseSchema,
  handler: async ({ tx, ctx, input }) => joinAffiliateProgram(tx, ctx, input),
});

export const PUT = createTenantRoute<
  z.output<typeof updateMyAffiliatePayoutBodySchema>,
  z.output<typeof myAffiliateResponseSchema>
>({
  metadata: learnerAffiliateWriteMetadata,
  body: updateMyAffiliatePayoutBodySchema,
  output: myAffiliateResponseSchema,
  handler: async ({ tx, ctx, input }) => updateMyAffiliatePayoutDetails(tx, ctx, input),
});
