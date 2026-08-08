import { createTenantRoute } from "@atlas/api";
import { listLinkedIdentities } from "@atlas/auth";
import { IdentitiesListResponseSchema } from "@atlas/domain-identity";
import { securityReadMetadata } from "../route.metadata";

export const GET = createTenantRoute({
  metadata: securityReadMetadata,
  output: IdentitiesListResponseSchema,
  handler: async () => {
    const result = await listLinkedIdentities();
    return { data: { identities: result.identities } };
  },
});
