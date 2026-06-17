import type { AuditListQuery, AuditWriteInput } from "../schemas/audit";
import type { AuditDbTx } from "../transaction";
export type AuditActorContext = {
  tenantId: string | null;
  actorMembershipId: string | null;
  platformPrincipalId: string | null;
  requestId: string;
  ipHash?: string | null;
  userAgentHash?: string | null;
};
export type AuditEntryRow = {
  id: string;
  occurred_at: Date;
  action: string;
  target_type: string;
  target_id: string | null;
  actor_membership_id: string | null;
  actor_principal_id: string | null;
  request_id: string;
  reason: string | null;
  metadata_json: unknown;
};
export declare function insertAuditEntry(
  tx: AuditDbTx,
  ctx: AuditActorContext,
  input: AuditWriteInput,
): Promise<{
  id: string;
}>;
export declare function listTenantAuditEntries(
  tx: AuditDbTx,
  query: AuditListQuery,
): Promise<AuditEntryRow[]>;
export declare function listPlatformAuditEntries(
  tx: AuditDbTx,
  query: AuditListQuery,
): Promise<AuditEntryRow[]>;
