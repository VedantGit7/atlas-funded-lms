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
  accountEmail: z.string().email().nullable().optional(),
  joinedAt: z.string().datetime().nullable().optional(),
  lastActiveAt: z.string().datetime().nullable().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
  profile: memberProfileViewSchema.nullable(),
  roles: z.array(memberRoleViewSchema).optional(),
});

export const memberListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    status: membershipStatusSchema.optional(),
    search: z.string().trim().min(1).max(200).optional(),
    role: z.string().trim().min(1).max(100).optional(),
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
    totalCount: z.number().int().nonnegative(),
  }),
});

export const memberStatsResponseSchema = z.object({
  data: z.object({
    totalMembers: z.number().int().nonnegative(),
    activeMembers: z.number().int().nonnegative(),
    pendingInvites: z.number().int().nonnegative(),
    suspendedMembers: z.number().int().nonnegative(),
    activeNow: z.number().int().nonnegative(),
    courseCompletionRate: z.number().min(0).max(1).nullable(),
  }),
});

export const memberDetailResponseSchema = z.object({
  data: memberDetailViewSchema,
});

/**
 * Number of days an invitation link remains valid after it is sent.
 * Mirrored in the frontend contracts package so the invite UI can show the
 * real expiry window without duplicating a magic number.
 */
export const INVITE_EXPIRY_DAYS = 7;

export const inviteMemberBodySchema = mutationBodySchema({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(1).max(120).optional(),
  roleId: z.string().uuid().optional(),
});

export const inviteMemberResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: z.literal("INVITED"),
    invitedEmail: z.string().email(),
    inviteExpiresAt: z.string().datetime(),
  }),
});

export const resendInviteResponseSchema = z.object({
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

export const profileVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);

export const memberProfileDetailViewSchema = memberProfileViewSchema.extend({
  timezone: z.string().nullable(),
  profileVisibility: profileVisibilitySchema,
});

export const memberProfileResponseSchema = z.object({
  data: memberProfileDetailViewSchema,
});

export const updateMemberProfileBodySchema = mutationBodySchema({
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().trim().min(1).max(100).nullable().optional(),
  profileVisibility: profileVisibilitySchema.optional(),
});

export type MemberListQuery = z.infer<typeof memberListQuerySchema>;
export type MembersListResponse = z.infer<typeof membersListResponseSchema>;
export type MemberStatsResponse = z.infer<typeof memberStatsResponseSchema>;
export type MemberDetailResponse = z.infer<typeof memberDetailResponseSchema>;
export type InviteMemberBody = z.infer<typeof inviteMemberBodySchema>;
export type ResendInviteResponse = z.infer<typeof resendInviteResponseSchema>;
export type UpdateMemberProfileBody = z.infer<typeof updateMemberProfileBodySchema>;
