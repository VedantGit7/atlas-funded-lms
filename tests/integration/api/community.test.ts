import { describe, expect, it } from "vitest";
import { runProtectedTenantRoutePipeline } from "@atlas/api/create-tenant-route";
import { withTenantTx } from "@atlas/db";
import { listSpacePostsMetadata } from "../../../apps/web/src/server/community/community.route-metadata";
import {
  createComment,
  createPost,
  createReaction,
  createSpace,
  deleteComment,
  deleteReaction,
  deleteSpace,
  joinSpace,
  listCommentsForPost,
  listSpaces,
  resolveHallOfFameConfig,
  updateComment,
} from "../../../apps/web/src/server/community/community.service";
import { buildHallOfFameProjection } from "../../../apps/web/src/server/community/community.hall-of-fame-service";
import {
  adminCtx,
  authoringTenantTx,
  createCommunityFixture,
  learnerCtx,
} from "../../fixtures/community-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("community integration", () => {
  it("creates spaces, joins, posts, comments, reactions, and soft-deletes", async () => {
    const fixture = await createCommunityFixture();
    const learner = learnerCtx(fixture, "req_community_learner");
    const admin = adminCtx(fixture, "req_community_admin");
    const runId = crypto.randomUUID().slice(0, 8);

    const createdSpace = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createSpace(tx, admin, {
          slug: `created-${runId}`,
          name: "Created Space",
          visibility: "TENANT",
        }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      joinSpace(tx, learner, createdSpace.data.id),
    );

    const replayJoin = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => joinSpace(tx, learner, createdSpace.data.id),
    );
    expect(replayJoin.data.joined).toBe(true);

    const post = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createPost(tx, { ...learner, idempotencyKey: "community-post-1" }, createdSpace.data.id, {
          title: "Hello",
          bodyJson: {
            version: 1,
            blocks: [
              {
                type: "paragraph",
                children: [
                  { type: "text", text: "Welcome" },
                  { type: "mention", membershipId: fixture.adminMembershipId },
                ],
              },
            ],
          },
        }),
    );

    const outbox = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string; payload_json: unknown }>>`
          select event_type, payload_json
          from outbox_events
          where aggregate_id = ${post.data.id}
          limit 1
        `,
    );

    expect(outbox[0]?.event_type).toBe("community.post.created");

    const comment = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createComment(tx, learner, post.data.id, {
          bodyJson: {
            version: 1,
            blocks: [{ type: "paragraph", children: [{ type: "text", text: "Nice post" }] }],
          },
        }),
    );

    const updated = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        updateComment(tx, learner, comment.data.id, {
          bodyJson: {
            version: 1,
            blocks: [{ type: "paragraph", children: [{ type: "text", text: "Updated comment" }] }],
          },
        }),
    );

    expect(updated.data.bodyJson.blocks[0]?.children[0]).toEqual({
      type: "text",
      text: "Updated comment",
    });

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await createReaction(tx, learner, {
        targetType: "post",
        targetId: post.data.id,
        reactionKey: "like",
      });
      const replay = await createReaction(tx, learner, {
        targetType: "post",
        targetId: post.data.id,
        reactionKey: "like",
      });
      expect(replay.data.created).toBe(false);
    });

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      deleteReaction(tx, learner, {
        targetType: "post",
        targetId: post.data.id,
        reactionKey: "like",
      }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      deleteComment(tx, learner, comment.data.id),
    );

    const comments = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listCommentsForPost(tx, learner, post.data.id),
    );
    expect(comments.data.items).toHaveLength(0);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      deleteSpace(tx, admin, { id: createdSpace.data.id, confirm: true }),
    );

    const audit = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
          select action from audit_entries where action = 'community.space.deleted' order by occurred_at desc limit 1
        `,
    );
    expect(audit[0]?.action).toBe("community.space.deleted");
  });

  it("rejects duplicate active space slug", async () => {
    const fixture = await createCommunityFixture();
    const admin = adminCtx(fixture, "req_community_slug");
    const duplicateSlug = `dup-${crypto.randomUUID().slice(0, 8)}`;

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      createSpace(tx, admin, {
        slug: duplicateSlug,
        name: "First",
        visibility: "TENANT",
      }),
    );

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        createSpace(tx, admin, {
          slug: duplicateSlug,
          name: "Second",
          visibility: "TENANT",
        }),
      ),
    ).rejects.toThrow();
  });

  it("resolves hall of fame config from tenant_config only", async () => {
    const fixture = await createCommunityFixture();
    const learner = learnerCtx(fixture, "req_community_hof");

    const config = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => resolveHallOfFameConfig(tx),
    );

    expect(config.recognitionSpaceId).toBe(fixture.hallOfFameSpaceId);
    expect(config.leaderboardId).toBe(fixture.hallOfFameLeaderboardId);

    const projection = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => buildHallOfFameProjection(tx, learner),
    );

    expect(projection.gamificationAvailable).toBe(false);
    expect(projection.leaderboard).toBeNull();
  });

  it("does not write notification/search/analytics rows from post creation", async () => {
    const fixture = await createCommunityFixture();
    const learner = learnerCtx(fixture, "req_community_side_effects");

    const post = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createPost(
          tx,
          { ...learner, idempotencyKey: "community-post-side-effects" },
          fixture.tenantSpaceId,
          {
            bodyJson: {
              version: 1,
              blocks: [
                { type: "paragraph", children: [{ type: "text", text: "Side effect check" }] },
              ],
            },
          },
        ),
    );

    const sideEffects = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ notifications: number; search: number; analytics: number }>>`
          select
            (
              select count(*)::int
              from notification_dispatches
              where tenant_id = ${fixture.tenantId}::uuid
            ) as notifications,
            (
              select count(*)::int
              from search_index_entries
              where tenant_id = ${fixture.tenantId}::uuid
                and source_id = ${post.data.id}::uuid
            ) as search,
            (
              select count(*)::int
              from analytics_rollups
              where tenant_id = ${fixture.tenantId}::uuid
                and subject_id = ${post.data.id}
            ) as analytics
        `,
    );

    expect(sideEffects[0]?.notifications).toBe(0);
    expect(sideEffects[0]?.search).toBe(0);
    expect(sideEffects[0]?.analytics).toBe(0);
    expect(post.data.id).toBeTruthy();
  });

  it("lists posts only for authorized spaces", async () => {
    const fixture = await createCommunityFixture();
    const learner = learnerCtx(fixture, "req_community_private");

    const visible = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listSpaces(tx, learner),
    );

    expect(visible.data.items.some((space) => space.id === fixture.privateSpaceId)).toBe(false);

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
        runProtectedTenantRoutePipeline({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            requestId: learner.requestId,
            actorMembershipId: fixture.learnerMembershipId,
          },
          metadata: listSpacePostsMetadata,
          params: { id: fixture.privateSpaceId },
          input: {},
        }),
      ),
    ).rejects.toThrow();
  });
});
