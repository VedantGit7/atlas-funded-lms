import { z } from "zod";
import { communityPostCreatedPayloadSchema } from "./community.events";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    membership_id: z.never().optional(),
    membershipId: z.never().optional(),
    author_membership_id: z.never().optional(),
    authorMembershipId: z.never().optional(),
    space_id: z.never().optional(),
    spaceId: z.never().optional(),
  })
  .passthrough();

const htmlTagPattern = /<[^>]*>/g;
const scriptPattern = /javascript:/i;

function rejectUnsafeMarkup(value: string): boolean {
  return !htmlTagPattern.test(value) && !scriptPattern.test(value);
}

export const structuredTextNodeSchema = z
  .object({
    type: z.literal("text"),
    text: z
      .string()
      .min(1)
      .max(10000)
      .refine(rejectUnsafeMarkup, "Text must not contain HTML or unsafe markup"),
  })
  .strict();

export const structuredMentionNodeSchema = z
  .object({
    type: z.literal("mention"),
    membershipId: z.string().uuid(),
  })
  .strict();

export const structuredVerifyLinkNodeSchema = z
  .object({
    type: z.literal("verify_link"),
    credentialId: z
      .string()
      .min(8)
      .max(128)
      .regex(/^cred_[a-z0-9]+$/i),
  })
  .strict();

export const structuredParagraphSchema = z
  .object({
    type: z.literal("paragraph"),
    children: z
      .array(
        z.discriminatedUnion("type", [
          structuredTextNodeSchema,
          structuredMentionNodeSchema,
          structuredVerifyLinkNodeSchema,
        ]),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const structuredBodySchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(structuredParagraphSchema).min(1).max(50),
  })
  .strict();

export type StructuredBody = z.output<typeof structuredBodySchema>;

export function extractMentionMembershipIds(body: StructuredBody): string[] {
  const ids = new Set<string>();

  for (const block of body.blocks) {
    for (const child of block.children) {
      if (child.type === "mention") {
        ids.add(child.membershipId);
      }
    }
  }

  return [...ids];
}

export const visibilitySchema = z.enum(["PRIVATE", "TENANT", "PUBLIC", "UNLISTED"]);

export const createSpaceBodySchema = z
  .object({
    slug: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1).max(120),
    visibility: visibilitySchema.default("TENANT"),
    configJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const updateSpaceBodySchema = z
  .object({
    id: z.string().uuid(),
    slug: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    name: z.string().min(1).max(120).optional(),
    visibility: visibilitySchema.optional(),
    configJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const deleteSpaceBodySchema = z
  .object({
    id: z.string().uuid(),
    confirm: z.literal(true),
  })
  .strict()
  .and(rejectClientTenantFields);

export const createPostBodySchema = z
  .object({
    title: z.string().max(200).optional(),
    bodyJson: structuredBodySchema,
  })
  .strict()
  .and(rejectClientTenantFields);

export const createCommentBodySchema = z
  .object({
    bodyJson: structuredBodySchema,
  })
  .strict()
  .and(rejectClientTenantFields);

export const updateCommentBodySchema = z
  .object({
    bodyJson: structuredBodySchema,
  })
  .strict()
  .and(rejectClientTenantFields);

export const reactionTargetTypeSchema = z.enum(["post", "comment"]);

export const createReactionBodySchema = z
  .object({
    targetType: reactionTargetTypeSchema,
    targetId: z.string().uuid(),
    reactionKey: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[a-z0-9_+-]+$/),
  })
  .strict()
  .and(rejectClientTenantFields);

export const deleteReactionBodySchema = createReactionBodySchema;

export const spaceDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  visibility: visibilitySchema,
  isMember: z.boolean(),
  postCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const spaceListResponseSchema = z.object({
  data: z.object({
    items: z.array(spaceDtoSchema),
  }),
});

export const spaceDetailResponseSchema = z.object({
  data: spaceDtoSchema,
});

export const postDtoSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  authorMembershipId: z.string().uuid(),
  title: z.string().nullable(),
  bodyJson: structuredBodySchema,
  status: z.string(),
  reactionCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  commentCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const postListResponseSchema = z.object({
  data: z.object({
    items: z.array(postDtoSchema),
  }),
});

export const postDetailResponseSchema = z.object({
  data: postDtoSchema,
});

export const commentDtoSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  authorMembershipId: z.string().uuid(),
  bodyJson: structuredBodySchema,
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const commentListResponseSchema = z.object({
  data: z.object({
    items: z.array(commentDtoSchema),
  }),
});

export const commentDetailResponseSchema = z.object({
  data: commentDtoSchema,
});

export const deleteCommentResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});

export const joinSpaceResponseSchema = z.object({
  data: z.object({
    spaceId: z.string().uuid(),
    membershipId: z.string().uuid(),
    joined: z.boolean(),
  }),
});

export const deleteSpaceResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});

export const reactionResponseSchema = z.object({
  data: z.object({
    targetType: reactionTargetTypeSchema,
    targetId: z.string().uuid(),
    reactionKey: z.string(),
    created: z.boolean(),
    removed: z.boolean().optional(),
  }),
});

export const spaceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const postIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const commentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export { communityPostCreatedPayloadSchema };
