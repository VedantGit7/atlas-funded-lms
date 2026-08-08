import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { z } from "zod";
import {
  CreatePlatformPermissionRequestSchema,
  PlatformPermissionCatalogEntrySchema,
  PlatformPermissionCatalogListResponseSchema,
  createPlatformPermissionCatalogEntry,
  listPlatformPermissionCatalog,
} from "@atlas/domain-config";
import { routeMetadata, postRouteMetadata } from "./route.metadata";

const PermissionResponseSchema = z.object({
  data: PlatformPermissionCatalogEntrySchema,
});

export const GET = createPlatformRoute({
  metadata: routeMetadata,
  output: PlatformPermissionCatalogListResponseSchema,
  handler: async ({ tx }) => listPlatformPermissionCatalog(tx),
});

export const POST = createPlatformRoute({
  metadata: postRouteMetadata,
  body: CreatePlatformPermissionRequestSchema,
  output: PermissionResponseSchema,
  handler: async ({ tx, body, ctx }) =>
    createPlatformPermissionCatalogEntry(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
      },
      body,
    ),
});
