export type ModerationStatus = "OPEN" | "REVIEWING" | "ACTIONED" | "REJECTED" | "CLOSED";

export type ModerationCaseRow = {
  id: string;
  tenant_id: string;
  target_type: string;
  target_id: string;
  status: ModerationStatus;
  reason_key: string | null;
  opened_by_membership_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ModerationDecisionRow = {
  id: string;
  tenant_id: string;
  moderation_case_id: string;
  decided_by_membership_id: string | null;
  decision_key: string;
  decision_json: unknown;
  occurred_at: Date;
};

export type AppealRow = {
  id: string;
  tenant_id: string;
  moderation_case_id: string;
  submitted_by_membership_id: string;
  status: string;
  body: string;
  created_at: Date;
  updated_at: Date;
};

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};

export type SafeTargetProjection = {
  targetType: "post" | "comment";
  targetId: string;
  authorMembershipId: string;
  previewText: string;
  title: string | null;
  deleted: boolean;
};
