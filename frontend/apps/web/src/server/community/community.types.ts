// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type Visibility = "PRIVATE" | "TENANT" | "PUBLIC" | "UNLISTED";

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};

export type CommunitySpaceRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  visibility: Visibility;
  config_json: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type GroupMembershipRow = {
  id: string;
  tenant_id: string;
  space_id: string;
  membership_id: string;
  role_key: string;
  joined_at: Date;
};

export type PostRow = {
  id: string;
  tenant_id: string;
  space_id: string;
  author_membership_id: string;
  title: string | null;
  body_json: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type CommentRow = {
  id: string;
  tenant_id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_membership_id: string;
  body_json: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ReactionRow = {
  id: string;
  tenant_id: string;
  membership_id: string;
  target_type: string;
  target_id: string;
  reaction_key: string;
  created_at: Date;
};

export type MentionRow = {
  id: string;
  tenant_id: string;
  mentioned_membership_id: string;
  source_type: string;
  source_id: string;
  created_at: Date;
};
