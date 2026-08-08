import { createUuidV7 } from "@atlas/core/id/uuid-v7";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function writeMembershipStatusAudit(args: {
  tx: Tx;
  tenantId: string;
  actorMembershipId: string;
  targetMembershipId: string;
  requestId: string;
  beforeStatus: string;
  afterStatus: string;
}): Promise<void> {
  const id = createUuidV7();

  await args.tx.$queryRaw`
    insert into audit_entries (
      id,
      tenant_id,
      actor_membership_id,
      action,
      target_type,
      target_id,
      request_id,
      before_json,
      after_json,
      metadata_json,
      entry_hash,
      occurred_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.actorMembershipId}::uuid,
      'identity.membership.status_changed',
      'membership',
      ${args.targetMembershipId}::uuid,
      ${args.requestId},
      ${JSON.stringify({ status: args.beforeStatus })}::jsonb,
      ${JSON.stringify({ status: args.afterStatus })}::jsonb,
      ${JSON.stringify({ requestId: args.requestId })}::jsonb,
      'pending-db-hash-chain',
      now()
    )
  `;
}
