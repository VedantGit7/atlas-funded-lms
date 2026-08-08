import { describe, expect, it } from "vitest";
import {
  communityPostCreatedPayloadSchema,
  createPostBodySchema,
  createReactionBodySchema,
  extractMentionMembershipIds,
  structuredBodySchema,
} from "../../../backend/apps/api/src/server/community/community.dto";

describe("community structured body validation", () => {
  it("accepts safe structured paragraphs", () => {
    const body = structuredBodySchema.parse({
      version: 1,
      blocks: [{ type: "paragraph", children: [{ type: "text", text: "Hello community" }] }],
    });

    expect(body.blocks).toHaveLength(1);
  });

  it("rejects unsafe markup in text nodes", () => {
    expect(() =>
      structuredBodySchema.parse({
        version: 1,
        blocks: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "<script>alert(1)</script>" }],
          },
        ],
      }),
    ).toThrow();
  });

  it("de-duplicates mention membership ids", () => {
    const body = structuredBodySchema.parse({
      version: 1,
      blocks: [
        {
          type: "paragraph",
          children: [
            { type: "mention", membershipId: "018f0000-0000-7000-8000-000000000001" },
            { type: "mention", membershipId: "018f0000-0000-7000-8000-000000000001" },
            { type: "mention", membershipId: "018f0000-0000-7000-8000-000000000002" },
          ],
        },
      ],
    });

    expect(extractMentionMembershipIds(body)).toEqual([
      "018f0000-0000-7000-8000-000000000001",
      "018f0000-0000-7000-8000-000000000002",
    ]);
  });
});

describe("community reaction validation", () => {
  it("allows post and comment targets only", () => {
    expect(
      createReactionBodySchema.safeParse({
        targetType: "post",
        targetId: "018f0000-0000-7000-8000-000000000001",
        reactionKey: "like",
      }).success,
    ).toBe(true);

    expect(
      createReactionBodySchema.safeParse({
        targetType: "space",
        targetId: "018f0000-0000-7000-8000-000000000001",
        reactionKey: "like",
      }).success,
    ).toBe(false);
  });
});

describe("community event payload validation", () => {
  it("validates community.post.created payload schema", () => {
    const payload = communityPostCreatedPayloadSchema.parse({
      postId: "018f0000-0000-7000-8000-000000000001",
      spaceId: "018f0000-0000-7000-8000-000000000002",
      authorMembershipId: "018f0000-0000-7000-8000-000000000003",
      mentionMembershipIds: ["018f0000-0000-7000-8000-000000000004"],
    });

    expect(payload.mentionMembershipIds).toHaveLength(1);
  });
});

describe("community zod strict rejection", () => {
  it("rejects client tenant_id in post body", () => {
    expect(() =>
      createPostBodySchema.parse({
        bodyJson: {
          version: 1,
          blocks: [{ type: "paragraph", children: [{ type: "text", text: "Hello" }] }],
        },
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
