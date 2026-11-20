import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { VALIDATED_ITEM_TYPES } from "@atlas/api-server/item-registry/item-definition.contract";
import { buildItemImportTemplate } from "@atlas/api-server/item-registry/item-import-template.service";
import { getItemImportTemplateRouteMetadata } from "./route.metadata";

const paramsSchema = z.object({
  typeKey: z.enum(VALIDATED_ITEM_TYPES),
});

const templateResponseSchema = z.object({
  data: z.object({
    filename: z.string(),
    contentType: z.string(),
    content: z.string(),
    contentEncoding: z.literal("base64"),
    templateVersion: z.string(),
  }),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Excel template for importing questions of one type. */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof templateResponseSchema>,
  typeof paramsSchema
>({
  metadata: getItemImportTemplateRouteMetadata,
  params: paramsSchema,
  output: templateResponseSchema,
  handler: async ({ tx, params }) => {
    const template = await buildItemImportTemplate(tx, params["typeKey"]);
    return { data: { ...template, contentEncoding: "base64" as const } };
  },
});
