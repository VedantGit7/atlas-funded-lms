import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { UpdateItemBodySchema } from "@atlas/api-server/item-registry/schemas";
import { itemRegistryService } from "../../../../../server/item-registry/item-registry.service";
import {
  itemDeleteResponseSchema,
  itemDetailResponseSchema,
} from "@atlas/api-server/item-registry/item-registry-response-schemas";
import {
  deleteItemRouteMetadata,
  getItemRouteMetadata,
  putItemRouteMetadata,
} from "./route.metadata";

type UpdateItemBody = z.output<typeof UpdateItemBodySchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof itemDetailResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getItemRouteMetadata,
  params: uuidParamSchema,
  output: itemDetailResponseSchema,
  handler: async ({ tx, params }) => {
    const itemId = params["id"];
    if (!itemId) throw new Error("Missing item id");
    return itemRegistryService.getItem(tx, itemId);
  },
});

export const PUT = createTenantRoute<
  UpdateItemBody,
  z.output<typeof itemDetailResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putItemRouteMetadata,
  params: uuidParamSchema,
  body: UpdateItemBodySchema,
  output: itemDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const itemId = params["id"];
    if (!itemId) throw new Error("Missing item id");
    return itemRegistryService.updateItem(tx, ctx, itemId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof itemDeleteResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteItemRouteMetadata,
  params: uuidParamSchema,
  output: itemDeleteResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const itemId = params["id"];
    if (!itemId) throw new Error("Missing item id");
    return itemRegistryService.deleteItem(tx, ctx, itemId);
  },
});
