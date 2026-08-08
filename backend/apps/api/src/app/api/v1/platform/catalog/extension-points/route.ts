import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { z } from "zod";
import {
  CreatePlatformExtensionPointRequestSchema,
  PlatformExtensionPointCatalogEntrySchema,
  PlatformExtensionPointCatalogListResponseSchema,
  createPlatformExtensionPointCatalogEntry,
  listPlatformExtensionPointCatalog,
} from "@atlas/domain-config";
import { routeMetadata, postRouteMetadata } from "./route.metadata";

const ExtensionPointResponseSchema = z.object({
  data: PlatformExtensionPointCatalogEntrySchema,
});

export const GET = createPlatformRoute({
  metadata: routeMetadata,
  output: PlatformExtensionPointCatalogListResponseSchema,
  handler: async ({ tx }) => listPlatformExtensionPointCatalog(tx),
});

export const POST = createPlatformRoute({
  metadata: postRouteMetadata,
  body: CreatePlatformExtensionPointRequestSchema,
  output: ExtensionPointResponseSchema,
  handler: async ({ tx, body, ctx }) =>
    createPlatformExtensionPointCatalogEntry(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
      },
      {
        ...body,
        schemaJson: body.schemaJson ?? {},
      },
    ),
});
