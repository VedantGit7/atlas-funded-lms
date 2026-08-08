import { randomUUID } from "node:crypto";
import { decodeListCursor, encodeListCursor } from "@atlas/membership/schemas/shared";
import type { LearningPathListQuery, UpdateLearningPathBody } from "./learning-path.schemas";
import type {
  PathGateType,
  PathLifecycleStatus,
  PathStepType,
  PathType,
} from "./learning-path.types";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

type PathRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  path_type: string;
  metadata_json: Record<string, unknown> | null;
  status: string;
  created_by_membership_id: string | null;
  updated_at: Date;
  created_at: Date;
};

type StepRow = {
  id: string;
  step_type: string;
  ref_id: string | null;
  title: string;
  position: number;
};

type GateRow = {
  id: string;
  path_step_id: string;
  gate_type: string;
  config_json: Record<string, unknown>;
};

export type PathAuthProjection = {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  description: string | null;
  pathType: PathType;
  status: PathLifecycleStatus;
  createdByMembershipId: string | null;
  updatedAt: Date;
  createdAt: Date;
};

function mapPathRow(row: PathRow): PathAuthProjection {
  return {
    id: row.id,
    tenantId: "",
    slug: row.slug,
    title: row.title,
    description: row.description,
    pathType: row.path_type as PathType,
    status: row.status as PathLifecycleStatus,
    createdByMembershipId: row.created_by_membership_id,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function findPathAuthProjection(args: {
  tx: Tx;
  pathId: string;
}): Promise<PathAuthProjection | null> {
  const rows = await args.tx.$queryRaw<PathRow[]>`
    select
      lp.id::text,
      lp.slug,
      lp.title,
      lp.description,
      lp.path_type,
      lp.metadata_json,
      lp.status::text,
      lp.created_by_membership_id::text,
      lp.updated_at,
      lp.created_at
    from learning_paths lp
    where lp.id = ${args.pathId}::uuid
      and lp.deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return mapPathRow(row);
}

export async function pathSlugExists(args: { tx: Tx; slug: string; excludePathId?: string }) {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select lp.id::text
    from learning_paths lp
    where lp.deleted_at is null
      and lp.slug = ${args.slug}
      and (${args.excludePathId ?? null}::uuid is null or lp.id <> ${args.excludePathId ?? null}::uuid)
    limit 1
  `;

  return rows.length > 0;
}

export async function insertPathDraft(args: {
  tx: Tx;
  tenantId: string;
  ownerMembershipId: string;
  slug: string;
  title: string;
  description: string | null;
  pathType: PathType;
  metadata: Record<string, unknown> | null;
}) {
  const id = randomUUID();

  await args.tx.$executeRaw`
    insert into learning_paths (
      id,
      tenant_id,
      slug,
      title,
      description,
      path_type,
      metadata_json,
      status,
      created_by_membership_id,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.slug},
      ${args.title},
      ${args.description},
      ${args.pathType},
      ${args.metadata ? JSON.stringify(args.metadata) : null}::jsonb,
      'DRAFT',
      ${args.ownerMembershipId}::uuid,
      now(),
      now()
    )
  `;

  return { id };
}

export async function listPublishedPathsPaginated(args: { tx: Tx; query: LearningPathListQuery }) {
  const limit = args.query.limit;
  const cursor = args.query.cursor ? decodeListCursor(args.query.cursor) : null;
  const q = args.query.q ? `%${args.query.q}%` : null;

  const rows = await args.tx.$queryRaw<PathRow[]>`
    select
      lp.id::text,
      lp.slug,
      lp.title,
      lp.description,
      lp.path_type,
      lp.metadata_json,
      lp.status::text,
      lp.created_by_membership_id::text,
      lp.updated_at,
      lp.created_at
    from learning_paths lp
    where lp.deleted_at is null
      and lp.status = 'PUBLISHED'
      and (${args.query.type ?? null}::text is null or lp.path_type = ${args.query.type ?? null})
      and (${q}::text is null or lp.title ilike ${q} or coalesce(lp.description, '') ilike ${q})
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (lp.updated_at, lp.id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.id ?? null}::uuid)
      )
    order by lp.updated_at desc, lp.id desc
    limit ${limit + 1}
  `;

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];

  return {
    items: items.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      pathType: row.path_type as PathType,
      status: row.status as PathLifecycleStatus,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    })),
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last ? encodeListCursor({ createdAt: last.updated_at, id: last.id }) : null,
    },
  };
}

export async function listStudioPathsPaginated(args: {
  tx: Tx;
  ownerMembershipId: string;
  query: LearningPathListQuery;
}) {
  const limit = args.query.limit;
  const cursor = args.query.cursor ? decodeListCursor(args.query.cursor) : null;
  const q = args.query.q ? `%${args.query.q}%` : null;

  const rows = await args.tx.$queryRaw<PathRow[]>`
    select
      lp.id::text,
      lp.slug,
      lp.title,
      lp.description,
      lp.path_type,
      lp.metadata_json,
      lp.status::text,
      lp.created_by_membership_id::text,
      lp.updated_at,
      lp.created_at
    from learning_paths lp
    where lp.deleted_at is null
      and lp.created_by_membership_id = ${args.ownerMembershipId}::uuid
      and (${args.query.status ?? null}::text is null or lp.status::text = ${args.query.status ?? null})
      and (${args.query.type ?? null}::text is null or lp.path_type = ${args.query.type ?? null})
      and (${q}::text is null or lp.title ilike ${q} or coalesce(lp.description, '') ilike ${q})
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (lp.updated_at, lp.id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.id ?? null}::uuid)
      )
    order by lp.updated_at desc, lp.id desc
    limit ${limit + 1}
  `;

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];

  return {
    items: items.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      pathType: row.path_type as PathType,
      status: row.status as PathLifecycleStatus,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    })),
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last ? encodeListCursor({ createdAt: last.updated_at, id: last.id }) : null,
    },
  };
}

export async function listPathSteps(args: { tx: Tx; pathId: string }) {
  return args.tx.$queryRaw<StepRow[]>`
    select
      ps.id::text,
      ps.step_type,
      ps.ref_id::text,
      ps.title,
      ps.position
    from path_steps ps
    where ps.path_id = ${args.pathId}::uuid
    order by ps.position asc, ps.id asc
  `;
}

export async function listPathStepGates(args: { tx: Tx; stepIds: string[] }) {
  if (args.stepIds.length === 0) return [] as GateRow[];

  return args.tx.$queryRaw<GateRow[]>`
    select
      psg.id::text,
      psg.path_step_id::text,
      psg.gate_type,
      psg.config_json
    from path_step_gates psg
    where psg.path_step_id = any(${args.stepIds}::uuid[])
    order by psg.created_at asc, psg.id asc
  `;
}

export async function updatePathRecord(args: {
  tx: Tx;
  pathId: string;
  title?: string;
  slug?: string;
  description?: string | null;
  pathType?: PathType;
  metadata?: Record<string, unknown> | null;
}) {
  await args.tx.$executeRaw`
    update learning_paths
    set
      title = coalesce(${args.title ?? null}, title),
      slug = coalesce(${args.slug ?? null}, slug),
      description = coalesce(${args.description ?? null}, description),
      path_type = coalesce(${args.pathType ?? null}, path_type),
      metadata_json = coalesce(${args.metadata ? JSON.stringify(args.metadata) : null}::jsonb, metadata_json),
      updated_at = now()
    where id = ${args.pathId}::uuid
      and deleted_at is null
  `;
}

export async function replacePathSteps(args: {
  tx: Tx;
  tenantId: string;
  pathId: string;
  steps: NonNullable<UpdateLearningPathBody["steps"]>;
}) {
  await args.tx.$executeRaw`
    delete from path_step_gates
    where path_step_id in (
      select id from path_steps where path_id = ${args.pathId}::uuid
    )
  `;

  await args.tx.$executeRaw`
    delete from path_steps
    where path_id = ${args.pathId}::uuid
  `;

  for (const step of args.steps) {
    const stepId = step.id ?? randomUUID();

    await args.tx.$executeRaw`
      insert into path_steps (
        id,
        tenant_id,
        path_id,
        step_type,
        ref_id,
        title,
        position,
        created_at,
        updated_at
      )
      values (
        ${stepId}::uuid,
        ${args.tenantId}::uuid,
        ${args.pathId}::uuid,
        ${step.stepType},
        ${step.refId ?? null}::uuid,
        ${step.title},
        ${step.position},
        now(),
        now()
      )
    `;

    for (const gate of step.gates) {
      const gateId = gate.id ?? randomUUID();
      await args.tx.$executeRaw`
        insert into path_step_gates (
          id,
          tenant_id,
          path_step_id,
          gate_type,
          config_json,
          created_at,
          updated_at
        )
        values (
          ${gateId}::uuid,
          ${args.tenantId}::uuid,
          ${stepId}::uuid,
          ${gate.gateType},
          ${JSON.stringify(gate.config)}::jsonb,
          now(),
          now()
        )
      `;
    }
  }
}

export async function softDeletePath(args: { tx: Tx; pathId: string }) {
  await args.tx.$executeRaw`
    update learning_paths
    set deleted_at = now(), updated_at = now(), status = 'ARCHIVED'
    where id = ${args.pathId}::uuid
      and deleted_at is null
  `;
}

export async function updatePathStatus(args: {
  tx: Tx;
  pathId: string;
  status: PathLifecycleStatus;
}) {
  await args.tx.$executeRaw`
    update learning_paths
    set status = ${args.status}::"PublishStatus", updated_at = now()
    where id = ${args.pathId}::uuid
      and deleted_at is null
  `;
}

export async function findWorkflowDefinitionByKey(args: { tx: Tx; key: string }) {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from workflow_definitions
    where key = ${args.key}
      and status = 'ACTIVE'
    limit 1
  `;

  return rows[0] ?? null;
}

export async function insertWorkflowTransition(args: {
  tx: Tx;
  tenantId: string;
  workflowDefinitionId: string;
  targetType: string;
  targetId: string;
  fromState: string;
  toState: string;
  actorMembershipId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
}) {
  const id = randomUUID();

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
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.workflowDefinitionId}::uuid,
      ${args.targetType},
      ${args.targetId}::uuid,
      ${args.fromState},
      ${args.toState},
      ${args.actorMembershipId}::uuid,
      ${args.reason},
      ${JSON.stringify(args.metadata)}::jsonb,
      now()
    )
  `;

  return { id };
}

export async function findPathEnrollment(args: { tx: Tx; pathId: string; membershipId: string }) {
  const rows = await args.tx.$queryRaw<Array<{ id: string; enrolled_at: Date; status: string }>>`
    select id::text, enrolled_at, status
    from path_enrollments
    where path_id = ${args.pathId}::uuid
      and membership_id = ${args.membershipId}::uuid
    limit 1
  `;

  return rows[0] ?? null;
}

export async function insertPathEnrollment(args: {
  tx: Tx;
  tenantId: string;
  pathId: string;
  membershipId: string;
}) {
  const id = randomUUID();

  try {
    await args.tx.$executeRaw`
      insert into path_enrollments (
        id,
        tenant_id,
        path_id,
        membership_id,
        status,
        enrolled_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.pathId}::uuid,
        ${args.membershipId}::uuid,
        'active',
        now()
      )
    `;

    return { id, enrolledAt: new Date(), created: true as const };
  } catch {
    const existing = await findPathEnrollment({
      tx: args.tx,
      pathId: args.pathId,
      membershipId: args.membershipId,
    });

    if (!existing) throw new Error("Failed to enroll in path");

    return {
      id: existing.id,
      enrolledAt: existing.enrolled_at,
      created: false as const,
    };
  }
}

export async function listPathStepProgress(args: {
  tx: Tx;
  membershipId: string;
  stepIds: string[];
}) {
  if (args.stepIds.length === 0) return [];

  return args.tx.$queryRaw<
    Array<{ path_step_id: string; status: string; completed_at: Date | null }>
  >`
    select path_step_id::text, status, completed_at
    from path_step_progress
    where membership_id = ${args.membershipId}::uuid
      and path_step_id = any(${args.stepIds}::uuid[])
  `;
}

export async function upsertPathStepProgress(args: {
  tx: Tx;
  tenantId: string;
  stepId: string;
  membershipId: string;
  status: string;
  completedAt?: Date | null;
}) {
  const id = randomUUID();

  await args.tx.$executeRaw`
    insert into path_step_progress (
      id,
      tenant_id,
      path_step_id,
      membership_id,
      status,
      completed_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.stepId}::uuid,
      ${args.membershipId}::uuid,
      ${args.status},
      ${args.completedAt ?? null},
      now()
    )
    on conflict (tenant_id, path_step_id, membership_id)
    do update set
      status = excluded.status,
      completed_at = coalesce(excluded.completed_at, path_step_progress.completed_at),
      updated_at = now()
  `;
}

export async function courseExistsPublished(args: { tx: Tx; courseId: string }) {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from courses
    where id = ${args.courseId}::uuid
      and deleted_at is null
      and status = 'PUBLISHED'
    limit 1
  `;

  return rows.length > 0;
}

export async function assessmentExistsPublished(args: { tx: Tx; assessmentId: string }) {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from assessments
    where id = ${args.assessmentId}::uuid
      and deleted_at is null
      and status = 'PUBLISHED'
    limit 1
  `;

  return rows.length > 0;
}

export async function pathExistsPublished(args: { tx: Tx; pathId: string }) {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from learning_paths
    where id = ${args.pathId}::uuid
      and deleted_at is null
      and status = 'PUBLISHED'
    limit 1
  `;

  return rows.length > 0;
}

export async function findPassedAssessmentAttempt(args: {
  tx: Tx;
  membershipId: string;
  assessmentId: string;
}) {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select a.id::text
    from attempts a
    inner join assessments ass on ass.id = a.assessment_id
    where a.membership_id = ${args.membershipId}::uuid
      and a.assessment_id = ${args.assessmentId}::uuid
      and a.status = 'GRADED'
      and a.score_pct is not null
      and a.score_pct >= coalesce((ass.config_json->>'passMarkPercent')::numeric, 70)
    limit 1
  `;

  return rows.length > 0;
}

export async function findCompositeReadinessBand(args: {
  tx: Tx;
  membershipId: string;
  scoringProfileId?: string | null;
  compositeKey?: string | null;
}) {
  const rows = await args.tx.$queryRaw<Array<{ band_key: string }>>`
    select band_key
    from composite_readiness_state
    where membership_id = ${args.membershipId}::uuid
      and (${args.scoringProfileId ?? null}::uuid is null or scoring_profile_id = ${args.scoringProfileId ?? null}::uuid)
      and (${args.compositeKey ?? null}::text is null or composite_key = ${args.compositeKey ?? null})
    order by calculated_at desc
    limit 1
  `;

  return rows[0]?.band_key ?? null;
}

export async function findCompetencyBandRank(args: {
  tx: Tx;
  bandKey: string;
  scoringProfileId?: string | null;
}) {
  const rows = await args.tx.$queryRaw<Array<{ rank: number }>>`
    select sort_order as rank
    from competency_bands
    where key = ${args.bandKey}
      and (${args.scoringProfileId ?? null}::uuid is null or scoring_profile_id = ${args.scoringProfileId ?? null}::uuid)
    limit 1
  `;

  return rows[0]?.rank ?? null;
}

export async function countPathSteps(args: { tx: Tx; pathId: string }) {
  const rows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from path_steps
    where path_id = ${args.pathId}::uuid
  `;

  return Number(rows[0]?.count ?? 0);
}

export function buildStepsWithGates(
  steps: StepRow[],
  gates: GateRow[],
): Array<StepRow & { gates: GateRow[] }> {
  const gatesByStep = new Map<string, GateRow[]>();

  for (const gate of gates) {
    const list = gatesByStep.get(gate.path_step_id) ?? [];
    list.push(gate);
    gatesByStep.set(gate.path_step_id, list);
  }

  return steps.map((step) => ({
    ...step,
    gates: gatesByStep.get(step.id) ?? [],
  }));
}

export function mapStepType(value: string): PathStepType {
  if (value === "course" || value === "assessment" || value === "path") {
    return value;
  }

  throw new Error(`Unsupported step type: ${value}`);
}

export function mapGateType(value: string): PathGateType {
  const allowed: PathGateType[] = [
    "open",
    "previous_step_completed",
    "assessment_passed",
    "competency_band",
    "manual",
    "time_based",
  ];

  if ((allowed as string[]).includes(value)) {
    return value as PathGateType;
  }

  throw new Error(`Unsupported gate type: ${value}`);
}
