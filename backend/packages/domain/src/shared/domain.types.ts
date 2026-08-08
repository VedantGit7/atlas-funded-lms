export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};

export type PageInfo = {
  nextCursor: string | null;
  hasNextPage: boolean;
};
