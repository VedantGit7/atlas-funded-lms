import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { assignSystemRoleToMembership } from "@atlas/access";
import {
  createAppeal,
  createModerationCase,
  decideModerationCase,
  listModerationCases,
  reviewAppeal,
} from "../../../apps/web/src/server/moderation/moderation.service";
import { createPost } from "../../../apps/web/src/server/community/community.service";
import {
  authoringTenantTx,
  createCommunityFixture,
  learnerCtx,
} from "../../fixtures/community-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seedModeratorMembership(
  fixture: Awaited<ReturnType<typeof createCommunityFixture>>,
) {
  const moderatorMembershipId = randomUUID();
  const moderatorPrincipalId = randomUUID();

  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into auth_principals (
        id, supabase_user_id, email, email_normalized, global_status, created_at, updated_at
      )
      values (
        ${moderatorPrincipalId}::uuid,
        ${randomUUID()}::uuid,
        ${`moderator-${moderatorMembershipId.slice(0, 8)}@example.test`},
        ${`moderator-${moderatorMembershipId.slice(0, 8)}@example.test`},
        'active',
        now(),
        now()
      )
    `;

    await tx.$executeRaw`
      insert into memberships (
        id, tenant_id, auth_principal_id, status, joined_at, created_at, updated_at
      )
      values (
        ${moderatorMembershipId}::uuid,
        ${fixture.tenantId}::uuid,
        ${moderatorPrincipalId}::uuid,
        'ACTIVE',
        now(),
        now(),
        now()
      )
    `;

    await assignSystemRoleToMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: moderatorMembershipId,
      roleKey: "moderator",
      assignedByMembershipId: fixture.adminMembershipId,
    });

    await tx.$executeRaw`
      insert into group_memberships (id, tenant_id, space_id, membership_id, role_key, joined_at)
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        ${fixture.tenantSpaceId}::uuid,
        ${moderatorMembershipId}::uuid,
        'moderator',
        now()
      )
      on conflict (tenant_id, space_id, membership_id) do update
      set role_key = excluded.role_key
    `;
  });

  return moderatorMembershipId;
}

function moderatorCtx(
  fixture: Awaited<ReturnType<typeof createCommunityFixture>>,
  moderatorMembershipId: string,
  requestId: string,
) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: moderatorMembershipId,
    requestId,
    idempotencyKey: `${requestId}-key`,
  };
}

describeWithDb("moderation integration", () => {
  it("runs case lifecycle, appeal lifecycle, audit, and outbox atomically", async () => {
    const fixture = await createCommunityFixture();
    const learner = learnerCtx(fixture, "req_mod_learner");
    const moderatorMembershipId = await seedModeratorMembership(fixture);
    const moderator = moderatorCtx(fixture, moderatorMembershipId, "req_mod_moderator");

    const post = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createPost(tx, { ...learner, idempotencyKey: "mod-post" }, fixture.tenantSpaceId, {
          title: "Report me",
          bodyJson: {
            version: 1,
            blocks: [{ type: "paragraph", children: [{ type: "text", text: "Needs review" }] }],
          },
        }),
    );

    const opened = await withTenantTx(
      authoringTenantTx(fixture, moderatorMembershipId),
      async (tx) =>
        createModerationCase(
          tx,
          { ...moderator, idempotencyKey: "open-case-key" },
          {
            targetType: "post",
            targetId: post.data.id,
            reasonKey: "policy",
          },
        ),
    );

    expect(opened.data.status).toBe("OPEN");

    const auditOpen = await withTenantTx(
      authoringTenantTx(fixture, moderatorMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries
        where target_id = ${opened.data.id}
        order by occurred_at desc
        limit 1
      `,
    );
    expect(auditOpen[0]?.action).toBe("moderation.case_opened");

    const outboxOpen = await withTenantTx(
      authoringTenantTx(fixture, moderatorMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type from outbox_events
        where aggregate_id = ${opened.data.id}
        limit 1
      `,
    );
    expect(outboxOpen[0]?.event_type).toBe("moderation.reported");

    await withTenantTx(authoringTenantTx(fixture, moderatorMembershipId), async (tx) =>
      decideModerationCase(
        tx,
        { ...moderator, idempotencyKey: "begin-review-key" },
        opened.data.id,
        { decisionKey: "begin_review" },
      ),
    );

    const actioned = await withTenantTx(
      authoringTenantTx(fixture, moderatorMembershipId),
      async (tx) =>
        decideModerationCase(tx, { ...moderator, idempotencyKey: "actioned-key" }, opened.data.id, {
          decisionKey: "actioned",
          contentAction: "delete",
          reason: "Removed violating content",
        }),
    );
    expect(actioned.data.status).toBe("ACTIONED");

    const appeal = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createAppeal(
          tx,
          { ...learner, idempotencyKey: "appeal-key" },
          {
            moderationCaseId: opened.data.id,
            body: "Please reconsider",
          },
        ),
    );
    expect(appeal.data.status).toBe("open");

    const reviewed = await withTenantTx(
      authoringTenantTx(fixture, moderatorMembershipId),
      async (tx) =>
        reviewAppeal(tx, { ...moderator, idempotencyKey: "review-key" }, appeal.data.id, {
          outcome: "uphold",
          nextCaseStatus: "REJECTED",
          reason: "Restored author trust",
        }),
    );
    expect(reviewed.data.appealStatus).toBe("upheld");
    expect(reviewed.data.caseStatus).toBe("REJECTED");

    const decidedOutbox = await withTenantTx(
      authoringTenantTx(fixture, moderatorMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type from outbox_events
        where aggregate_id = ${opened.data.id}
          and event_type = 'moderation.decided'
      `,
    );
    expect(decidedOutbox.length).toBeGreaterThan(0);

    const list = await withTenantTx(authoringTenantTx(fixture, moderatorMembershipId), async (tx) =>
      listModerationCases(tx, moderator, { view: "cases", limit: 25 }),
    );
    expect(list.data.items.some((item) => item.id === opened.data.id)).toBe(true);
  });

  it("blocks self-review of appeals", async () => {
    const fixture = await createCommunityFixture();
    const learner = learnerCtx(fixture, "req_self_review");
    const moderatorMembershipId = await seedModeratorMembership(fixture);

    const post = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createPost(tx, { ...learner, idempotencyKey: "self-post" }, fixture.tenantSpaceId, {
          bodyJson: {
            version: 1,
            blocks: [{ type: "paragraph", children: [{ type: "text", text: "Appeal me" }] }],
          },
        }),
    );

    const opened = await withTenantTx(
      authoringTenantTx(fixture, moderatorMembershipId),
      async (tx) =>
        createModerationCase(tx, moderatorCtx(fixture, moderatorMembershipId, "open-case"), {
          targetType: "post",
          targetId: post.data.id,
        }),
    );

    await withTenantTx(authoringTenantTx(fixture, moderatorMembershipId), async (tx) => {
      await decideModerationCase(
        tx,
        moderatorCtx(fixture, moderatorMembershipId, "begin"),
        opened.data.id,
        { decisionKey: "begin_review" },
      );
      await decideModerationCase(
        tx,
        moderatorCtx(fixture, moderatorMembershipId, "action"),
        opened.data.id,
        { decisionKey: "actioned", contentAction: "delete" },
      );
    });

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      const appeal = await createAppeal(
        tx,
        { ...learner, idempotencyKey: "appeal-self" },
        {
          moderationCaseId: opened.data.id,
          body: "Unfair",
        },
      );

      await expect(
        reviewAppeal(tx, { ...learner, idempotencyKey: "self-review" }, appeal.data.id, {
          outcome: "reject",
        }),
      ).rejects.toThrow("You cannot review your own appeal.");
    });
  });
});
