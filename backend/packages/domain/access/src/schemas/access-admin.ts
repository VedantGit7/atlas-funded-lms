import { z } from "zod";
import { isPlatformPermission, isWildcardPermission } from "@atlas/access";
import { mutationBodySchema, pageInfoSchema } from "@atlas/membership/schemas/shared";

const tenantPermissionKeySchema = z
  .string()
  .min(1)
  .refine((key) => !isPlatformPermission(key), "Platform permissions are not allowed")
  .refine((key) => !isWildcardPermission(key), "Wildcard permissions are not allowed");

export const rolePermissionViewSchema = z.object({
  key: z.string(),
  description: z.string().nullable().optional(),
});

export const roleViewSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
  permissions: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const roleListResponseSchema = z.object({
  data: z.object({
    items: z.array(roleViewSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const roleListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
  })
  .strict();

export const createRoleBodySchema = mutationBodySchema({
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Role key must be lowercase snake_case"),
  name: z.string().trim().min(1).max(120),
  permissions: z.array(tenantPermissionKeySchema).min(1),
});

export const updateRoleBodySchema = mutationBodySchema({
  name: z.string().trim().min(1).max(120).optional(),
  permissions: z.array(tenantPermissionKeySchema).min(1).optional(),
});

export const roleDetailResponseSchema = z.object({
  data: roleViewSchema,
});

export const assignRoleBodySchema = mutationBodySchema({
  roleId: z.uuid(),
});

export const permissionOverrideViewSchema = z.object({
  id: z.uuid(),
  membershipId: z.uuid(),
  permissionKey: z.string(),
  effect: z.enum(["ALLOW", "DENY"]),
  reason: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const permissionOverrideListQuerySchema = z
  .object({
    membershipId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
  })
  .strict();

export const permissionOverrideListResponseSchema = z.object({
  data: z.object({
    items: z.array(permissionOverrideViewSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const createPermissionOverrideBodySchema = mutationBodySchema({
  membershipId: z.uuid(),
  permissionKey: tenantPermissionKeySchema,
  effect: z.enum(["ALLOW", "DENY"]),
  reason: z.string().trim().max(500).nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
});

export const permissionOverrideResponseSchema = z.object({
  data: permissionOverrideViewSchema,
});

export const deletePermissionOverrideResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export type RoleListResponse = z.infer<typeof roleListResponseSchema>;
export type RoleDetailResponse = z.infer<typeof roleDetailResponseSchema>;
export type PermissionOverrideListResponse = z.infer<typeof permissionOverrideListResponseSchema>;
export type CreateRoleBody = z.infer<typeof createRoleBodySchema>;
export type UpdateRoleBody = z.infer<typeof updateRoleBodySchema>;
export type AssignRoleBody = z.infer<typeof assignRoleBodySchema>;
export type CreatePermissionOverrideBody = z.infer<typeof createPermissionOverrideBodySchema>;
