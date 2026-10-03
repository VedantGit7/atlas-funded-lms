import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { WorkflowGraph } from "./marketing-workflow.graph";

export type MarketingWorkflowRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  allow_resubscribe: boolean;
  use_case_key: string | null;
  graph_json: unknown;
  created_by_membership_id: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type MarketingWorkflowRunRow = {
  id: string;
  workflow_id: string;
  membership_id: string | null;
  status: string;
  trigger_event_type: string;
  trigger_payload_json: unknown;
  current_node_id: string | null;
  wait_until: Date | null;
  idempotency_key: string;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

export type MarketingWorkflowRunListRow = MarketingWorkflowRunRow & {
  learner_name: string | null;
  learner_email: string | null;
};

export const marketingWorkflowRepository = {
  async list(tx: TenantTx, args: { q?: string; status?: string; limit: number }) {
    const q = args.q?.trim() ?? "";
    const status = args.status && args.status !== "ALL" ? args.status : null;
    return tx.$queryRaw<MarketingWorkflowRow[]>`
      select
        id::text, title, description, status, allow_resubscribe, use_case_key,
        graph_json, created_by_membership_id::text, published_at, created_at, updated_at
      from marketing_workflows
      where (${status}::text is null or status = ${status})
        and (${q} = '' or title ilike '%' || ${q} || '%' or coalesce(description, '') ilike '%' || ${q} || '%')
      order by created_at desc
      limit ${args.limit}
    `;
  },

  async countByStatus(tx: TenantTx) {
    const rows = await tx.$queryRaw<Array<{ status: string; count: bigint }>>`
      select status, count(*)::bigint as count
      from marketing_workflows
      group by status
    `;
    const result = { publishedCount: 0, draftCount: 0, unpublishedCount: 0 };
    for (const row of rows) {
      const count = Number(row.count);
      if (row.status === "PUBLISHED") result.publishedCount = count;
      else if (row.status === "DRAFT") result.draftCount = count;
      else if (row.status === "UNPUBLISHED") result.unpublishedCount = count;
    }
    return result;
  },

  async countActiveRuns(tx: TenantTx) {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from marketing_workflow_runs
      where status in ('RUNNING', 'WAITING')
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countActiveRunsByWorkflowIds(tx: TenantTx, workflowIds: string[]) {
    if (workflowIds.length === 0) return new Map<string, number>();
    const rows = await tx.$queryRaw<Array<{ workflow_id: string; count: bigint }>>`
      select workflow_id::text, count(*)::bigint as count
      from marketing_workflow_runs
      where status in ('RUNNING', 'WAITING')
        and workflow_id = any(${workflowIds}::uuid[])
      group by workflow_id
    `;
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.workflow_id, Number(row.count));
    }
    return map;
  },

  async findById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<MarketingWorkflowRow[]>`
      select
        id::text, title, description, status, allow_resubscribe, use_case_key,
        graph_json, created_by_membership_id::text, published_at, created_at, updated_at
      from marketing_workflows
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listPublished(tx: TenantTx) {
    return tx.$queryRaw<MarketingWorkflowRow[]>`
      select
        id::text, title, description, status, allow_resubscribe, use_case_key,
        graph_json, created_by_membership_id::text, published_at, created_at, updated_at
      from marketing_workflows
      where status = 'PUBLISHED'
      order by published_at desc nulls last
    `;
  },

  async insert(
    tx: TenantTx,
    args: {
      title: string;
      description: string | null;
      allowResubscribe: boolean;
      graph: WorkflowGraph;
      createdByMembershipId: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_workflows (
        id, tenant_id, title, description, status, allow_resubscribe, graph_json,
        created_by_membership_id, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.title},
        ${args.description},
        'DRAFT',
        ${args.allowResubscribe},
        ${JSON.stringify(args.graph)}::jsonb,
        ${args.createdByMembershipId}::uuid,
        now(),
        now()
      )
    `;
    return id;
  },

  async updateBasics(
    tx: TenantTx,
    args: { id: string; title: string; description: string | null; allowResubscribe: boolean },
  ) {
    await tx.$executeRaw`
      update marketing_workflows
      set title = ${args.title},
          description = ${args.description},
          allow_resubscribe = ${args.allowResubscribe},
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async updateGraph(
    tx: TenantTx,
    args: { id: string; graph: WorkflowGraph; useCaseKey?: string | null },
  ) {
    await tx.$executeRaw`
      update marketing_workflows
      set graph_json = ${JSON.stringify(args.graph)}::jsonb,
          use_case_key = ${args.useCaseKey ?? null},
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async setStatus(tx: TenantTx, id: string, status: string) {
    await tx.$executeRaw`
      update marketing_workflows
      set status = ${status},
          published_at = case when ${status} = 'PUBLISHED' then now() else published_at end,
          updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async deleteById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from marketing_workflows where id = ${id}::uuid returning id::text
    `;
    return rows.length > 0;
  },

  async clone(tx: TenantTx, source: MarketingWorkflowRow, createdByMembershipId: string) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_workflows (
        id, tenant_id, title, description, status, allow_resubscribe, use_case_key, graph_json,
        created_by_membership_id, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${`${source.title} (copy)`},
        ${source.description},
        'DRAFT',
        ${source.allow_resubscribe},
        ${source.use_case_key},
        ${JSON.stringify(source.graph_json)}::jsonb,
        ${createdByMembershipId}::uuid,
        now(),
        now()
      )
    `;
    return id;
  },

  async findRunByIdempotency(tx: TenantTx, idempotencyKey: string) {
    const rows = await tx.$queryRaw<MarketingWorkflowRunRow[]>`
      select
        id::text, workflow_id::text, membership_id::text, status, trigger_event_type,
        trigger_payload_json, current_node_id, wait_until, idempotency_key, error_message,
        created_at, updated_at, completed_at
      from marketing_workflow_runs
      where idempotency_key = ${idempotencyKey}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertRun(
    tx: TenantTx,
    args: {
      workflowId: string;
      membershipId: string | null;
      triggerEventType: string;
      triggerPayload: unknown;
      currentNodeId: string | null;
      idempotencyKey: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_workflow_runs (
        id, tenant_id, workflow_id, membership_id, status, trigger_event_type,
        trigger_payload_json, current_node_id, idempotency_key, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.workflowId}::uuid,
        ${args.membershipId}::uuid,
        'RUNNING',
        ${args.triggerEventType},
        ${JSON.stringify(args.triggerPayload)}::jsonb,
        ${args.currentNodeId},
        ${args.idempotencyKey},
        now(),
        now()
      )
    `;
    return id;
  },

  async findRun(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<MarketingWorkflowRunRow[]>`
      select
        id::text, workflow_id::text, membership_id::text, status, trigger_event_type,
        trigger_payload_json, current_node_id, wait_until, idempotency_key, error_message,
        created_at, updated_at, completed_at
      from marketing_workflow_runs
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listRuns(tx: TenantTx, workflowId: string, limit = 50) {
    return tx.$queryRaw<MarketingWorkflowRunListRow[]>`
      select
        r.id::text,
        r.workflow_id::text,
        r.membership_id::text,
        r.status,
        r.trigger_event_type,
        r.trigger_payload_json,
        r.current_node_id,
        r.wait_until,
        r.idempotency_key,
        r.error_message,
        r.created_at,
        r.updated_at,
        r.completed_at,
        coalesce(mp.display_name, ap.email) as learner_name,
        ap.email as learner_email
      from marketing_workflow_runs r
      left join memberships m on m.id = r.membership_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      where r.workflow_id = ${workflowId}::uuid
      order by r.created_at desc
      limit ${limit}
    `;
  },

  async updateRun(
    tx: TenantTx,
    args: {
      id: string;
      status: string;
      currentNodeId: string | null;
      waitUntil: Date | null;
      errorMessage?: string | null;
      completed?: boolean;
    },
  ) {
    await tx.$executeRaw`
      update marketing_workflow_runs
      set status = ${args.status},
          current_node_id = ${args.currentNodeId},
          wait_until = ${args.waitUntil},
          error_message = ${args.errorMessage ?? null},
          completed_at = case when ${args.completed ?? false} then now() else completed_at end,
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async listDueWaiting(tx: TenantTx, limit = 20) {
    return tx.$queryRaw<MarketingWorkflowRunRow[]>`
      select
        id::text, workflow_id::text, membership_id::text, status, trigger_event_type,
        trigger_payload_json, current_node_id, wait_until, idempotency_key, error_message,
        created_at, updated_at, completed_at
      from marketing_workflow_runs
      where status = 'WAITING'
        and wait_until is not null
        and wait_until <= now()
      order by wait_until asc
      limit ${limit}
    `;
  },

  async hasEmailReceipt(tx: TenantTx, runId: string, nodeId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text from marketing_workflow_run_logs
      where tenant_id = app.current_tenant_id()
        and run_id = ${runId}::uuid and node_id = ${nodeId} and status = 'SENT'
      limit 1
    `;
    return rows.length > 0;
  },

  async insertLog(
    tx: TenantTx,
    args: {
      runId: string;
      nodeId: string | null;
      nodeType: string | null;
      status: string;
      message: string | null;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_workflow_run_logs (
        id, tenant_id, run_id, node_id, node_type, status, message, created_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.runId}::uuid,
        ${args.nodeId},
        ${args.nodeType},
        ${args.status},
        ${args.message},
        now()
      )
    `;
  },

  async listLogs(tx: TenantTx, runId: string) {
    return tx.$queryRaw<
      Array<{
        id: string;
        node_id: string | null;
        node_type: string | null;
        status: string;
        message: string | null;
        created_at: Date;
      }>
    >`
      select id::text, node_id, node_type, status, message, created_at
      from marketing_workflow_run_logs
      where run_id = ${runId}::uuid
      order by created_at asc
      limit 200
    `;
  },

  async resolveMembershipEmail(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ email: string | null; display_name: string | null }>>`
      select ap.email, mp.display_name
      from memberships m
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      where m.id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async countActiveRunsForMembership(tx: TenantTx, workflowId: string, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from marketing_workflow_runs
      where workflow_id = ${workflowId}::uuid
        and membership_id = ${membershipId}::uuid
        and status in ('RUNNING', 'WAITING')
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async hasCompletedRun(tx: TenantTx, workflowId: string, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from marketing_workflow_runs
      where workflow_id = ${workflowId}::uuid
        and membership_id = ${membershipId}::uuid
        and status = 'COMPLETED'
      limit 1
    `;
    return rows.length > 0;
  },
};
