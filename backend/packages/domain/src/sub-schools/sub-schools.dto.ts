import { z } from "zod";
import { ENTITY_STATUSES, rejectClientTenantFields } from "../shared/domain.dto";

const urlSlugSchema = z
  .string()
  .min(1, "URL is required.")
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URL must be lowercase letters, numbers, and hyphens.");

const mobileNumberSchema = z
  .string()
  .min(7, "Enter a valid mobile number.")
  .max(20)
  .regex(/^[+]?[\d\s()-]{7,20}$/, "Enter a valid mobile number.");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

export const createSubSchoolBodySchema = rejectClientTenantFields
  .extend({
    name: z.string().min(1, "Sub-school name is required.").max(60),
    key: urlSlugSchema,
    mobileNumber: mobileNumberSchema,
    email: z.email("Enter a valid email address.").max(320),
    password: passwordSchema,
    description: z.string().max(1000).optional(),
    status: z.enum(ENTITY_STATUSES).default("ACTIVE"),
  })
  .strict();

export const updateSubSchoolBodySchema = rejectClientTenantFields
  .extend({
    name: z.string().min(1).max(60).optional(),
    mobileNumber: mobileNumberSchema.optional(),
    email: z.email().max(320).optional(),
    password: passwordSchema.optional(),
    description: z.string().max(1000).nullable().optional(),
    status: z.enum(ENTITY_STATUSES).optional(),
  })
  .strict();

export const subSchoolParamsSchema = z.object({ id: z.uuid() }).strict();

export const subSchoolDtoSchema = z
  .object({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    mobileNumber: z.string().nullable(),
    email: z.string().nullable(),
    status: z.enum(ENTITY_STATUSES),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const subSchoolResponseSchema = z.object({ data: subSchoolDtoSchema });
export const subSchoolListResponseSchema = z.object({
  data: z.object({ items: z.array(subSchoolDtoSchema) }),
});
export const deleteSubSchoolResponseSchema = z.object({
  data: z.object({ deleted: z.boolean() }),
});
