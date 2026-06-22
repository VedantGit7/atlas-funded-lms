import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { z } from "zod";
import {
  CreatePlatformItemTypeRequestSchema,
  PlatformItemTypeCatalogEntrySchema,
  PlatformItemTypeCatalogListResponseSchema,
  createPlatformItemTypeCatalogEntry,
  listPlatformItemTypeCatalog,
} from "@atlas/domain-config";
import { routeMetadata, postRouteMetadata } from "./route.metadata";

const ItemTypeResponseSchema = z.object({
  data: PlatformItemTypeCatalogEntrySchema,
});

export const GET = createPlatformRoute({
  metadata: routeMetadata,
  output: PlatformItemTypeCatalogListResponseSchema,
  handler: async ({ tx }) => listPlatformItemTypeCatalog(tx),
});

export const POST = createPlatformRoute({
  metadata: postRouteMetadata,
  body: CreatePlatformItemTypeRequestSchema,
  output: ItemTypeResponseSchema,
  handler: async ({ tx, body, ctx }) =>
    createPlatformItemTypeCatalogEntry(
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
