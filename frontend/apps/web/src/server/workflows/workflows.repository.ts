// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

type Tx = TenantTx;

export type PendingWorkflowRow = {
  id: string;
  workflowDefinitionId: string;
  targetType: string;
  targetId: string;
  fromState: string;
  toState: string;
  actorMembershipId: string;
  reason: string | null;
  occurredAt: Date;
  courseTitle: string;
  courseStatus: string;
  courseCreatedByMembershipId: string;
};

export type WorkflowTransitionRow = {
  id: string;
  workflowDefinitionId: string;
  targetType: string;
  targetId: string;
  fromState: string;
  toState: string;
  actorMembershipId: string;
  reason: string | null;
  metadataJson: Record<string, unknown> | null;
  occurredAt: Date;
};

export type WorkflowHistoryRow = {
  id: string;
  fromState: string;
  toState: string;
  actorMembershipId: string;
  reason: string | null;
  metadataJson: Record<string, unknown> | null;
  occurredAt: Date;
};

export async function findActiveWorkflowDefinitionByKey(args: {
  tx: Tx;
  key: string;
}): Promise<{ id: string; definitionJson: Record<string, unknown> } | null> {
  const rows = await args.tx.$queryRaw<
    Array<{ id: string; definition_json: Record<string, unknown> }>
  >`
    select id::text, definition_json
    from workflow_definitions
    where key = ${args.key}
      and status = 'ACTIVE'
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return { id: row.id, definitionJson: row.definition_json };
}

export async function appendWorkflowTransition(args: {
  tx: Tx;
  tenantId: string;
  workflowDefinitionId: string;
  targetType: string;
  targetId: string;
  fromState: string;
  toState: string;
  actorMembershipId: string;
  reason: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const transitionId = randomUUID();

  await args.tx.$executeRaw`
    insert into workflow_transitions (
      id,
      tenant_id,
      workflow_definition_id,
      target_type,
      target_id,
      from_state,
      to_state,
      actor_membership_id,
      reason,
      metadata_json,
      occurred_at
    )
    values (
      ${transitionId}::uuid,
      ${args.tenantId}::uuid,
      ${args.workflowDefinitionId}::uuid,
      ${args.targetType},
      ${args.targetId}::uuid,
      ${args.fromState},
      ${args.toState},
      ${args.actorMembershipId}::uuid,
      ${args.reason},
      ${args.metadata == null ? null : JSON.stringify(args.metadata)}::jsonb,
      now()
    )
  `;

  return { id: transitionId };
}

export async function findWorkflowTransitionById(args: {
  tx: Tx;
  transitionId: string;
}): Promise<WorkflowTransitionRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      workflow_definition_id: string;
      target_type: string;
      target_id: string;
      from_state: string;
      to_state: string;
      actor_membership_id: string;
      reason: string | null;
      metadata_json: Record<string, unknown> | null;
      occurred_at: Date;
    }>
  >`
    select
      id::text,
      workflow_definition_id::text,
      target_type,
      target_id::text,
      from_state,
      to_state,
      actor_membership_id::text,
      reason,
      metadata_json,
      occurred_at
    from workflow_transitions
    where id = ${args.transitionId}::uuid
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    workflowDefinitionId: row.workflow_definition_id,
    targetType: row.target_type,
    targetId: row.target_id,
    fromState: row.from_state,
    toState: row.to_state,
    actorMembershipId: row.actor_membership_id,
    reason: row.reason,
    metadataJson: row.metadata_json,
    occurredAt: row.occurred_at,
  };
}

export async function hasLaterTransitionForTarget(args: {
  tx: Tx;
  targetType: string;
  targetId: string;
  pendingTransitionId: string;
}): Promise<boolean> {
  const count = await countLaterTransitionsForTarget(args);
  return count > 0;
}

export async function countLaterTransitionsForTarget(args: {
  tx: Tx;
  targetType: string;
  targetId: string;
  pendingTransitionId: string;
}): Promise<number> {
  // The comparison timestamp is read back inside SQL rather than passed in from
  // the caller. `occurred_at` is a timestamptz with microsecond precision, but a
  // JavaScript Date only carries milliseconds — round-tripping the pending row's
  // own timestamp truncated it, so `occurred_at > <truncated>` matched the
  // pending row itself whenever its microsecond remainder was non-zero. That
  // made every workflow action fail with a spurious "already acted on" conflict
  // roughly 999 times in 1000, depending only on clock luck.
  const rows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from workflow_transitions
    where target_type = ${args.targetType}
      and target_id = ${args.targetId}::uuid
      and id <> ${args.pendingTransitionId}::uuid
      and occurred_at > (
        select occurred_at
        from workflow_transitions
        where id = ${args.pendingTransitionId}::uuid
      )
  `;

  return Number(rows[0]?.count ?? 0n);
}

export async function findCourseForWorkflow(args: { tx: Tx; courseId: string }): Promise<{
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdByMembershipId: string;
} | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      title: string;
      description: string | null;
      status: string;
      created_by_membership_id: string;
    }>
  >`
    select
      id::text,
      title,
      description,
      status,
      created_by_membership_id::text
    from courses
    where id = ${args.courseId}::uuid
      and deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdByMembershipId: row.created_by_membership_id,
  };
}

export async function updateCourseStatusForWorkflow(args: {
  tx: Tx;
  courseId: string;
  status: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    update courses
    set status = ${args.status},
        updated_at = now()
    where id = ${args.courseId}::uuid
      and deleted_at is null
  `;
}

export async function listPendingCourseWorkflowItems(args: {
  tx: Tx;
  limit: number;
  cursor?: string;
}): Promise<{ items: PendingWorkflowRow[]; hasMore: boolean }> {
  const cursorOccurredAt = args.cursor ? decodeCursor(args.cursor) : null;

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      workflow_definition_id: string;
      target_type: string;
      target_id: string;
      from_state: string;
      to_state: string;
      actor_membership_id: string;
      reason: string | null;
      occurred_at: Date;
      course_title: string;
      course_status: string;
      course_created_by_membership_id: string;
    }>
  >`
    with latest_transitions as (
      select distinct on (wt.target_id)
        wt.id,
        wt.workflow_definition_id,
        wt.target_type,
        wt.target_id,
        wt.from_state,
        wt.to_state,
        wt.actor_membership_id,
        wt.reason,
        wt.occurred_at
      from workflow_transitions wt
      inner join courses c
        on c.id = wt.target_id
        and c.deleted_at is null
      where wt.target_type = 'course'
        and c.status = 'REVIEW'
      order by wt.target_id, wt.occurred_at desc
    )
    select
      lt.id::text,
      lt.workflow_definition_id::text,
      lt.target_type,
      lt.target_id::text,
      lt.from_state,
      lt.to_state,
      lt.actor_membership_id::text,
      lt.reason,
      lt.occurred_at,
      c.title as course_title,
      c.status as course_status,
      c.created_by_membership_id::text as course_created_by_membership_id
    from latest_transitions lt
    inner join courses c on c.id = lt.target_id
    where lt.to_state = 'REVIEW'
      and c.status = 'REVIEW'
      and (${cursorOccurredAt}::timestamptz is null or lt.occurred_at < ${cursorOccurredAt})
    order by lt.occurred_at desc
    limit ${args.limit + 1}
  `;

  const hasMore = rows.length > args.limit;
  const pageRows = hasMore ? rows.slice(0, args.limit) : rows;

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      workflowDefinitionId: row.workflow_definition_id,
      targetType: row.target_type,
      targetId: row.target_id,
      fromState: row.from_state,
      toState: row.to_state,
      actorMembershipId: row.actor_membership_id,
      reason: row.reason,
      occurredAt: row.occurred_at,
      courseTitle: row.course_title,
      courseStatus: row.course_status,
      courseCreatedByMembershipId: row.course_created_by_membership_id,
    })),
    hasMore,
  };
}

export async function listWorkflowHistoryForTarget(args: {
  tx: Tx;
  targetType: string;
  targetId: string;
}): Promise<WorkflowHistoryRow[]> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      from_state: string;
      to_state: string;
      actor_membership_id: string;
      reason: string | null;
      metadata_json: Record<string, unknown> | null;
      occurred_at: Date;
    }>
  >`
    select
      id::text,
      from_state,
      to_state,
      actor_membership_id::text,
      reason,
      metadata_json,
      occurred_at
    from workflow_transitions
    where target_type = ${args.targetType}
      and target_id = ${args.targetId}::uuid
    order by occurred_at asc
  `;

  return rows.map((row) => ({
    id: row.id,
    fromState: row.from_state,
    toState: row.to_state,
    actorMembershipId: row.actor_membership_id,
    reason: row.reason,
    metadataJson: row.metadata_json,
    occurredAt: row.occurred_at,
  }));
}

function decodeCursor(cursor: string): Date {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const occurredAt = new Date(decoded);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("Invalid workflow list cursor.");
  }
  return occurredAt;
}

export function encodeWorkflowCursor(occurredAt: Date): string {
  return Buffer.from(occurredAt.toISOString(), "utf8").toString("base64url");
}

export type WorkflowDefinitionRow = {
  id: string;
  key: string;
  name: string;
  definition_json: Record<string, unknown>;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  updated_at: Date;
};

export async function listWorkflowDefinitions(tx: Tx): Promise<WorkflowDefinitionRow[]> {
  return tx.$queryRaw<WorkflowDefinitionRow[]>`
    select
      id::text,
      key,
      name,
      definition_json,
      status,
      updated_at
    from workflow_definitions
    order by key asc
  `;
}

export async function createWorkflowDefinition(args: {
  tx: Tx;
  key: string;
  name: string;
  definitionJson: Record<string, unknown>;
}): Promise<WorkflowDefinitionRow> {
  const rows = await args.tx.$queryRaw<WorkflowDefinitionRow[]>`
    insert into workflow_definitions (
      id,
      tenant_id,
      key,
      name,
      definition_json,
      status,
      created_at,
      updated_at
    )
    values (
      ${randomUUID()}::uuid,
      app.current_tenant_id(),
      ${args.key},
      ${args.name},
      ${JSON.stringify(args.definitionJson)}::jsonb,
      'ACTIVE',
      now(),
      now()
    )
    returning id::text, key, name, definition_json, status, updated_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("WORKFLOW_DEFINITION_CREATE_FAILED");
  }

  return row;
}

export async function updateWorkflowDefinition(args: {
  tx: Tx;
  id: string;
  name?: string;
  definitionJson?: Record<string, unknown>;
  status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
}): Promise<WorkflowDefinitionRow | null> {
  const currentRows = await args.tx.$queryRaw<WorkflowDefinitionRow[]>`
    select id::text, key, name, definition_json, status, updated_at
    from workflow_definitions
    where id = ${args.id}::uuid
    limit 1
  `;

  const current = currentRows[0];
  if (!current) {
    return null;
  }

  const rows = await args.tx.$queryRaw<WorkflowDefinitionRow[]>`
    update workflow_definitions
    set
      name = ${args.name ?? current.name},
      definition_json = ${JSON.stringify(args.definitionJson ?? current.definition_json)}::jsonb,
      status = ${args.status ?? current.status},
      updated_at = now()
    where id = ${args.id}::uuid
    returning id::text, key, name, definition_json, status, updated_at
  `;

  return rows[0] ?? null;
}
