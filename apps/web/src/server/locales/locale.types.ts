export type LocaleResourceRow = {
  id: string;
  tenant_id: string;
  locale: string;
  key: string;
  value: string;
  updated_at: Date;
};

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type LocaleResourceDto = {
  locale: string;
  key: string;
  value: string;
  updatedAt: string;
};
