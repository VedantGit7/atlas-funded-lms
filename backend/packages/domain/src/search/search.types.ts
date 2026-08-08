import type { TenantTx } from "@atlas/db";

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  idempotencyKey?: string;
};

export type SearchSourceType = "course" | "post" | "certificate";

export type SearchIndexRow = {
  id: string;
  tenant_id: string;
  source_context: string;
  source_type: SearchSourceType;
  source_id: string;
  title: string;
  body: string | null;
  visibility: string;
  access_json: Record<string, unknown> | null;
  vector_ref: string | null;
  updated_at: Date;
};

export type SearchIndexProjection = {
  sourceContext: string;
  sourceType: SearchSourceType;
  sourceId: string;
  title: string;
  body: string | null;
  visibility: "TENANT" | "PRIVATE" | "UNLISTED" | "PUBLIC";
  accessJson: Record<string, unknown> | null;
};

export type SearchResultDto = {
  type: SearchSourceType;
  title: string;
  snippet: string;
  actionPath: string;
};

export type SearchAccessContext = {
  tx: TenantTx;
  ctx: ServiceCtx;
  entry: SearchIndexRow;
};

export type SearchReindexCursor = {
  sourceType: SearchSourceType;
  sourceId: string;
};

export type Tx = TenantTx;
