import type { TenantTx } from "@atlas/db";
import { randomUUID } from "node:crypto";
import type {
  CommentRow,
  CommunitySpaceRow,
  GroupMembershipRow,
  MentionRow,
  PostRow,
  ReactionRow,
  Visibility,
} from "./community.types";

function mapSpaceRow(row: Record<string, unknown>): CommunitySpaceRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    slug: String(row["slug"]),
    name: String(row["name"]),
    visibility: row["visibility"] as Visibility,
    config_json: row["config_json"],
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
    deleted_at: (row["deleted_at"] as Date | null) ?? null,
  };
}

function mapPostRow(row: Record<string, unknown>): PostRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    space_id: String(row["space_id"]),
    author_membership_id: String(row["author_membership_id"]),
    title: (row["title"] as string | null) ?? null,
    body_json: row["body_json"],
    status: String(row["status"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
    deleted_at: (row["deleted_at"] as Date | null) ?? null,
  };
}

function mapCommentRow(row: Record<string, unknown>): CommentRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    post_id: String(row["post_id"]),
    parent_comment_id: (row["parent_comment_id"] as string | null) ?? null,
    author_membership_id: String(row["author_membership_id"]),
    body_json: row["body_json"],
    status: String(row["status"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
    deleted_at: (row["deleted_at"] as Date | null) ?? null,
  };
}

export const communityRepository = {
  async listVisibleSpaces(
    tx: TenantTx,
    args: { actorMembershipId: string; includePostCounts: boolean },
  ): Promise<Array<CommunitySpaceRow & { is_member: boolean; post_count?: number }>> {
    if (args.includePostCounts) {
      const rows = await tx.$queryRaw<
        Array<Record<string, unknown> & { is_member: boolean; post_count: bigint }>
      >`
        select
          cs.*,
          exists (
            select 1
            from group_memberships gm
            where gm.space_id = cs.id
              and gm.membership_id = ${args.actorMembershipId}::uuid
          ) as is_member,
          (
            select count(*)::bigint
            from posts p
            where p.space_id = cs.id
              and p.deleted_at is null
          ) as post_count
        from community_spaces cs
        where cs.deleted_at is null
          and (
            cs.visibility in ('TENANT', 'PUBLIC')
            or exists (
              select 1
              from group_memberships gm
              where gm.space_id = cs.id
                and gm.membership_id = ${args.actorMembershipId}::uuid
            )
          )
        order by cs.name asc
      `;

      return rows.map((row) => ({
        ...mapSpaceRow(row),
        is_member: row.is_member,
        post_count: Number(row.post_count),
      }));
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown> & { is_member: boolean }>>`
      select
        cs.*,
        exists (
          select 1
          from group_memberships gm
          where gm.space_id = cs.id
            and gm.membership_id = ${args.actorMembershipId}::uuid
        ) as is_member
      from community_spaces cs
      where cs.deleted_at is null
        and (
          cs.visibility in ('TENANT', 'PUBLIC')
          or exists (
            select 1
            from group_memberships gm
            where gm.space_id = cs.id
              and gm.membership_id = ${args.actorMembershipId}::uuid
          )
        )
      order by cs.name asc
    `;

    return rows.map((row) => ({
      ...mapSpaceRow(row),
      is_member: row.is_member,
    }));
  },

  async listAllSpacesForManage(tx: TenantTx): Promise<CommunitySpaceRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from community_spaces
      where deleted_at is null
      order by name asc
    `;

    return rows.map(mapSpaceRow);
  },

  async findSpaceById(tx: TenantTx, spaceId: string): Promise<CommunitySpaceRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from community_spaces
      where id = ${spaceId}::uuid
        and deleted_at is null
      limit 1
    `;

    const row = rows[0];
    return row ? mapSpaceRow(row) : null;
  },

  async findSpaceBySlug(tx: TenantTx, slug: string): Promise<CommunitySpaceRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from community_spaces
      where slug = ${slug}
        and deleted_at is null
      limit 1
    `;

    const row = rows[0];
    return row ? mapSpaceRow(row) : null;
  },

  async findSpaceBySlugIncludingDeleted(
    tx: TenantTx,
    slug: string,
  ): Promise<CommunitySpaceRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from community_spaces
      where slug = ${slug}
      limit 1
    `;

    const row = rows[0];
    return row ? mapSpaceRow(row) : null;
  },

  async insertSpace(
    tx: TenantTx,
    args: {
      slug: string;
      name: string;
      visibility: Visibility;
      configJson?: Record<string, unknown>;
    },
  ): Promise<CommunitySpaceRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into community_spaces (
        id,
        tenant_id,
        slug,
        name,
        visibility,
        config_json,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.slug},
        ${args.name},
        ${args.visibility}::"Visibility",
        ${JSON.stringify(args.configJson ?? {})}::jsonb,
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) throw new Error("Failed to insert community space");
    return mapSpaceRow(row);
  },

  async updateSpace(
    tx: TenantTx,
    args: {
      spaceId: string;
      slug?: string;
      name?: string;
      visibility?: Visibility;
      configJson?: Record<string, unknown>;
    },
  ): Promise<CommunitySpaceRow | null> {
    const existing = await communityRepository.findSpaceById(tx, args.spaceId);
    if (!existing) return null;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update community_spaces
      set
        slug = ${args.slug ?? existing.slug},
        name = ${args.name ?? existing.name},
        visibility = ${args.visibility ?? existing.visibility}::"Visibility",
        config_json = ${JSON.stringify(args.configJson ?? existing.config_json ?? {})}::jsonb,
        updated_at = now()
      where id = ${args.spaceId}::uuid
        and deleted_at is null
      returning *
    `;

    const row = rows[0];
    return row ? mapSpaceRow(row) : null;
  },

  async softDeleteSpace(tx: TenantTx, spaceId: string): Promise<boolean> {
    const count = await tx.$executeRaw`
      update community_spaces
      set deleted_at = now(), updated_at = now()
      where id = ${spaceId}::uuid
        and deleted_at is null
    `;

    return count > 0;
  },

  async findGroupMembership(
    tx: TenantTx,
    spaceId: string,
    membershipId: string,
  ): Promise<GroupMembershipRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from group_memberships
      where space_id = ${spaceId}::uuid
        and membership_id = ${membershipId}::uuid
      limit 1
    `;

    const row = rows[0];
    if (!row) return null;

    return {
      id: String(row["id"]),
      tenant_id: String(row["tenant_id"]),
      space_id: String(row["space_id"]),
      membership_id: String(row["membership_id"]),
      role_key: String(row["role_key"]),
      joined_at: row["joined_at"] as Date,
    };
  },

  async insertGroupMembership(
    tx: TenantTx,
    args: { spaceId: string; membershipId: string; roleKey?: string },
  ): Promise<GroupMembershipRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into group_memberships (
        id,
        tenant_id,
        space_id,
        membership_id,
        role_key,
        joined_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.spaceId}::uuid,
        ${args.membershipId}::uuid,
        ${args.roleKey ?? "member"},
        now()
      )
      on conflict (tenant_id, space_id, membership_id) do update
        set role_key = excluded.role_key
      returning *
    `;

    const row = rows[0];
    if (!row) throw new Error("Failed to join space");
    return {
      id: String(row["id"]),
      tenant_id: String(row["tenant_id"]),
      space_id: String(row["space_id"]),
      membership_id: String(row["membership_id"]),
      role_key: String(row["role_key"]),
      joined_at: row["joined_at"] as Date,
    };
  },

  async isSpaceModerator(tx: TenantTx, spaceId: string, membershipId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ role_key: string }>>`
      select role_key
      from group_memberships
      where space_id = ${spaceId}::uuid
        and membership_id = ${membershipId}::uuid
      limit 1
    `;

    const roleKey = rows[0]?.role_key;
    return roleKey === "moderator" || roleKey === "admin";
  },

  async listPostsInSpace(tx: TenantTx, spaceId: string): Promise<PostRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from posts
      where space_id = ${spaceId}::uuid
        and deleted_at is null
        and status = 'published'
      order by created_at desc
    `;

    return rows.map(mapPostRow);
  },

  async findPostById(tx: TenantTx, postId: string): Promise<PostRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from posts
      where id = ${postId}::uuid
        and deleted_at is null
      limit 1
    `;

    const row = rows[0];
    return row ? mapPostRow(row) : null;
  },

  async findPostByIdIncludingDeleted(tx: TenantTx, postId: string): Promise<PostRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from posts
      where id = ${postId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapPostRow(row) : null;
  },

  async insertPost(
    tx: TenantTx,
    args: {
      spaceId: string;
      authorMembershipId: string;
      title?: string;
      bodyJson: unknown;
    },
  ): Promise<PostRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into posts (
        id,
        tenant_id,
        space_id,
        author_membership_id,
        title,
        body_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.spaceId}::uuid,
        ${args.authorMembershipId}::uuid,
        ${args.title ?? null},
        ${JSON.stringify(args.bodyJson)}::jsonb,
        'published',
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) throw new Error("Failed to create post");
    return mapPostRow(row);
  },

  async listCommentsForPost(tx: TenantTx, postId: string): Promise<CommentRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from comments
      where post_id = ${postId}::uuid
        and deleted_at is null
        and status = 'published'
      order by created_at asc
    `;

    return rows.map(mapCommentRow);
  },

  async findCommentById(tx: TenantTx, commentId: string): Promise<CommentRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from comments
      where id = ${commentId}::uuid
        and deleted_at is null
      limit 1
    `;

    const row = rows[0];
    return row ? mapCommentRow(row) : null;
  },

  async findCommentByIdIncludingDeleted(
    tx: TenantTx,
    commentId: string,
  ): Promise<CommentRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from comments
      where id = ${commentId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapCommentRow(row) : null;
  },

  async insertComment(
    tx: TenantTx,
    args: {
      postId: string;
      authorMembershipId: string;
      bodyJson: unknown;
    },
  ): Promise<CommentRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into comments (
        id,
        tenant_id,
        post_id,
        author_membership_id,
        body_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.postId}::uuid,
        ${args.authorMembershipId}::uuid,
        ${JSON.stringify(args.bodyJson)}::jsonb,
        'published',
        now(),
        now()
      )
      returning *
    `;

    const row = rows[0];
    if (!row) throw new Error("Failed to create comment");
    return mapCommentRow(row);
  },

  async updateCommentBody(
    tx: TenantTx,
    commentId: string,
    bodyJson: unknown,
  ): Promise<CommentRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update comments
      set body_json = ${JSON.stringify(bodyJson)}::jsonb, updated_at = now()
      where id = ${commentId}::uuid
        and deleted_at is null
      returning *
    `;

    const row = rows[0];
    return row ? mapCommentRow(row) : null;
  },

  async softDeleteComment(tx: TenantTx, commentId: string): Promise<boolean> {
    const count = await tx.$executeRaw`
      update comments
      set deleted_at = now(), updated_at = now(), status = 'deleted'
      where id = ${commentId}::uuid
        and deleted_at is null
    `;

    return count > 0;
  },

  async softDeletePost(tx: TenantTx, postId: string): Promise<boolean> {
    const count = await tx.$executeRaw`
      update posts
      set deleted_at = now(), updated_at = now(), status = 'deleted'
      where id = ${postId}::uuid
        and deleted_at is null
    `;

    return count > 0;
  },

  async insertMentions(
    tx: TenantTx,
    args: {
      sourceType: "post" | "comment";
      sourceId: string;
      membershipIds: string[];
    },
  ): Promise<MentionRow[]> {
    if (args.membershipIds.length === 0) return [];

    const results: MentionRow[] = [];

    for (const membershipId of args.membershipIds) {
      const id = randomUUID();
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        insert into mentions (
          id,
          tenant_id,
          mentioned_membership_id,
          source_type,
          source_id,
          created_at
        )
        values (
          ${id}::uuid,
          current_setting('app.tenant_id')::uuid,
          ${membershipId}::uuid,
          ${args.sourceType},
          ${args.sourceId}::uuid,
          now()
        )
        returning *
      `;

      const row = rows[0];
      if (row) {
        results.push({
          id: String(row["id"]),
          tenant_id: String(row["tenant_id"]),
          mentioned_membership_id: String(row["mentioned_membership_id"]),
          source_type: String(row["source_type"]),
          source_id: String(row["source_id"]),
          created_at: row["created_at"] as Date,
        });
      }
    }

    return results;
  },

  async upsertReaction(
    tx: TenantTx,
    args: {
      membershipId: string;
      targetType: "post" | "comment";
      targetId: string;
      reactionKey: string;
    },
  ): Promise<{ row: ReactionRow; created: boolean }> {
    const existing = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from reactions
      where membership_id = ${args.membershipId}::uuid
        and target_type = ${args.targetType}
        and target_id = ${args.targetId}::uuid
        and reaction_key = ${args.reactionKey}
      limit 1
    `;

    if (existing[0]) {
      const row = existing[0];
      return {
        created: false,
        row: {
          id: String(row["id"]),
          tenant_id: String(row["tenant_id"]),
          membership_id: String(row["membership_id"]),
          target_type: String(row["target_type"]),
          target_id: String(row["target_id"]),
          reaction_key: String(row["reaction_key"]),
          created_at: row["created_at"] as Date,
        },
      };
    }

    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into reactions (
        id,
        tenant_id,
        membership_id,
        target_type,
        target_id,
        reaction_key,
        created_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.membershipId}::uuid,
        ${args.targetType},
        ${args.targetId}::uuid,
        ${args.reactionKey},
        now()
      )
      on conflict (tenant_id, membership_id, target_type, target_id, reaction_key) do nothing
      returning *
    `;

    const inserted = rows[0];
    if (inserted) {
      return {
        created: true,
        row: {
          id: String(inserted["id"]),
          tenant_id: String(inserted["tenant_id"]),
          membership_id: String(inserted["membership_id"]),
          target_type: String(inserted["target_type"]),
          target_id: String(inserted["target_id"]),
          reaction_key: String(inserted["reaction_key"]),
          created_at: inserted["created_at"] as Date,
        },
      };
    }

    const replay = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from reactions
      where membership_id = ${args.membershipId}::uuid
        and target_type = ${args.targetType}
        and target_id = ${args.targetId}::uuid
        and reaction_key = ${args.reactionKey}
      limit 1
    `;

    const row = replay[0];
    if (!row) throw new Error("Failed to create reaction");

    return {
      created: false,
      row: {
        id: String(row["id"]),
        tenant_id: String(row["tenant_id"]),
        membership_id: String(row["membership_id"]),
        target_type: String(row["target_type"]),
        target_id: String(row["target_id"]),
        reaction_key: String(row["reaction_key"]),
        created_at: row["created_at"] as Date,
      },
    };
  },

  async deleteReaction(
    tx: TenantTx,
    args: {
      membershipId: string;
      targetType: "post" | "comment";
      targetId: string;
      reactionKey: string;
    },
  ): Promise<boolean> {
    const count = await tx.$executeRaw`
      delete from reactions
      where membership_id = ${args.membershipId}::uuid
        and target_type = ${args.targetType}
        and target_id = ${args.targetId}::uuid
        and reaction_key = ${args.reactionKey}
    `;

    return count > 0;
  },

  async countActiveMemberships(tx: TenantTx, membershipIds: string[]): Promise<string[]> {
    if (membershipIds.length === 0) return [];

    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from memberships
      where id = any(${membershipIds}::uuid[])
        and status = 'ACTIVE'
    `;

    return rows.map((row) => row.id);
  },

  async countCommentsForPost(tx: TenantTx, postId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from comments
      where post_id = ${postId}::uuid
        and deleted_at is null
        and status = 'published'
    `;

    return Number(rows[0]?.count ?? 0);
  },

  async reactionCountsForTarget(
    tx: TenantTx,
    targetType: "post" | "comment",
    targetId: string,
  ): Promise<Record<string, number>> {
    const rows = await tx.$queryRaw<Array<{ reaction_key: string; count: bigint }>>`
      select reaction_key, count(*)::bigint as count
      from reactions
      where target_type = ${targetType}
        and target_id = ${targetId}::uuid
      group by reaction_key
    `;

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.reaction_key] = Number(row.count);
    }
    return counts;
  },
};
