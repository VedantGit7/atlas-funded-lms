import { z } from "zod";
import { ENTITY_STATUSES, rejectClientTenantFields } from "../shared/domain.dto";

export const createCustomFieldDefinitionBodySchema = rejectClientTenantFields
  .extend({
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1).max(256),
    fieldType: z.enum(["text", "number", "boolean", "select", "date"]),
    optionsJson: z.array(z.string()).optional(),
    status: z.enum(ENTITY_STATUSES).default("ACTIVE"),
  })
  .strict();

export const updateCustomFieldDefinitionBodySchema = rejectClientTenantFields
  .extend({
    label: z.string().min(1).max(256).optional(),
    status: z.enum(ENTITY_STATUSES).optional(),
    optionsJson: z.array(z.string()).optional(),
  })
  .strict();

export const setCustomFieldValueBodySchema = rejectClientTenantFields
  .extend({
    membershipId: z.uuid(),
    valueJson: z.unknown(),
  })
  .strict();

export const customFieldDefinitionDtoSchema = z
  .object({
    id: z.uuid(),
    key: z.string(),
    label: z.string(),
    fieldType: z.string(),
    status: z.enum(ENTITY_STATUSES),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const customFieldValueDtoSchema = z
  .object({
    definitionId: z.uuid(),
    membershipId: z.uuid(),
    valueJson: z.unknown(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const customFieldDefinitionResponseSchema = z.object({
  data: customFieldDefinitionDtoSchema,
});

export const customFieldDefinitionListResponseSchema = z.object({
  data: z.object({ items: z.array(customFieldDefinitionDtoSchema) }),
});

export const customFieldValueResponseSchema = z.object({
  data: customFieldValueDtoSchema,
});

export const customFieldValueListResponseSchema = z.object({
  data: z.object({ items: z.array(customFieldValueDtoSchema) }),
});
