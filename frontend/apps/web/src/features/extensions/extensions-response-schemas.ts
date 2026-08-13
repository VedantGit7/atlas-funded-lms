import { z } from "zod";
import { EntityStatusSchema } from "./schemas";

export const extensionPointDtoSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  pointType: z.string(),
  schemaJson: z.unknown(),
  status: EntityStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const extensionPointListResponseSchema = z.object({
  data: z.array(extensionPointDtoSchema),
});

export const extensionRegistrationDtoSchema = z.object({
  id: z.uuid(),
  extensionPointKey: z.string(),
  registrationKey: z.string(),
  configJson: z.unknown(),
  status: EntityStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const extensionRegistrationListResponseSchema = z.object({
  data: z.array(extensionRegistrationDtoSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

export const extensionRegistrationDetailResponseSchema = z.object({
  data: extensionRegistrationDtoSchema,
});

export const extensionRegistrationDeleteResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});
