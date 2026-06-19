import { createTenantRoute } from "@atlas/api";
import { extensionsService } from "../../../../server/extensions/extensions.service";
import { extensionPointListResponseSchema } from "../../../../features/extensions/extensions-response-schemas";
import { getExtensionPointsRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: getExtensionPointsRouteMetadata,
  output: extensionPointListResponseSchema,
  handler: async ({ tx }) => extensionsService.listExtensionPoints(tx),
});
