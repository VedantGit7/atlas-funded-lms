import { z } from "zod";
import { membershipStatusSchema } from "../schemas";
import { mutationBodySchema, pageInfoSchema } from "./shared";

export const memberProfileViewSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable().optional(),
});

export const memberRoleViewSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
});

export const memberListItemSchema = z.object({
  id: z.string().uuid(),
  status: membershipStatusSchema,
  invitedEmail: z.string().email().nullable().optional(),
  profile: memberProfileViewSchema.nullable(),
  roles: z.array(memberRoleViewSchema).optional(),
});

export const memberListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    status: membershipStatusSchema.optional(),
  })
  .strict();

export const memberDetailViewSchema = z.object({
  id: z.string().uuid(),
  status: membershipStatusSchema,
  invitedEmail: z.string().email().nullable(),
  joinedAt: z.string().datetime().nullable(),
  suspendedAt: z.string().datetime().nullable(),
  removedAt: z.string().datetime().nullable(),
  profile: memberProfileViewSchema.nullable(),
  roles: z.array(memberRoleViewSchema),
});

export const membersListResponseSchema = z.object({
  data: z.object({
    items: z.array(memberListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const memberDetailResponseSchema = z.object({
  data: memberDetailViewSchema,
});

export const inviteMemberBodySchema = mutationBodySchema({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const inviteMemberResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: z.literal("INVITED"),
    invitedEmail: z.string().email(),
    inviteExpiresAt: z.string().datetime(),
  }),
});

export const suspendMemberResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: z.literal("SUSPENDED"),
    suspendedAt: z.string().datetime(),
  }),
});

export const removeMemberResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: z.literal("REMOVED"),
    removedAt: z.string().datetime(),
  }),
});

export const memberProfileResponseSchema = z.object({
  data: memberProfileViewSchema,
});

export const updateMemberProfileBodySchema = mutationBodySchema({
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type MemberListQuery = z.infer<typeof memberListQuerySchema>;
export type MembersListResponse = z.infer<typeof membersListResponseSchema>;
export type MemberDetailResponse = z.infer<typeof memberDetailResponseSchema>;
export type InviteMemberBody = z.infer<typeof inviteMemberBodySchema>;
export type UpdateMemberProfileBody = z.infer<typeof updateMemberProfileBodySchema>;
