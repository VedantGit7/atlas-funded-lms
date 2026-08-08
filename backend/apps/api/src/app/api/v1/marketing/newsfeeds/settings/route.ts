import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  newsfeedSettingsResponseSchema,
  updateNewsfeedSettingsBodySchema,
} from "../../../../../../server/marketing-newsfeed/marketing-newsfeed.schemas";
import {
  listMarketingNewsfeedMetadata,
  mutateMarketingNewsfeedMetadata,
} from "../../../../../../server/marketing-newsfeed/marketing-newsfeed.route-metadata";
import {
  getMarketingNewsfeedSettings,
  updateMarketingNewsfeedSettings,
} from "../../../../../../server/marketing-newsfeed/marketing-newsfeed.service";

export const GET = createTenantRoute<undefined, z.output<typeof newsfeedSettingsResponseSchema>>({
  metadata: listMarketingNewsfeedMetadata,
  output: newsfeedSettingsResponseSchema,
  handler: async ({ tx }) => getMarketingNewsfeedSettings(tx),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateNewsfeedSettingsBodySchema>,
  z.output<typeof newsfeedSettingsResponseSchema>
>({
  metadata: mutateMarketingNewsfeedMetadata,
  body: updateNewsfeedSettingsBodySchema,
  output: newsfeedSettingsResponseSchema,
  handler: async ({ tx, ctx, input }) => updateMarketingNewsfeedSettings(tx, ctx, input),
});
