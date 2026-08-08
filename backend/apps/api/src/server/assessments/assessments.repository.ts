import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { AssessmentConfig } from "../assessments/schemas";

type AssessmentRow = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  assessment_type: string;
  status: string;
  config_json: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type AssessmentItemRow = {
  id: string;
  tenant_id: string;
  assessment_id: string;
  item_id: string;
  position: number;
  points: unknown;
  config_json: unknown;
  created_at: Date;
};

function takePlusOne(limit: number) {
  return Math.min(limit + 1, 101);
}

async function listAssessmentsQuery(
  tx: TenantTx,
  args: {
    limit: number;
    cursor?: string;
    assessmentType?: string;
    status?: string;
    q?: string;
    ownerMembershipId?: string;
    publishedOnly?: boolean;
  },
): Promise<AssessmentRow[]> {
  const limit = takePlusOne(args.limit);

  const rows = await tx.assessment.findMany({
    where: {
      deleted_at: null,
      ...(args.publishedOnly ? { status: "PUBLISHED" } : {}),
      ...(args.status ? { status: args.status as never } : {}),
      ...(args.assessmentType ? { assessment_type: args.assessmentType } : {}),
      ...(args.q ? { title: { contains: args.q, mode: "insensitive" } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      tenant_id: true,
      slug: true,
      title: true,
      assessment_type: true,
      status: true,
      config_json: true,
      created_at: true,
      updated_at: true,
      deleted_at: true,
    },
  });

  const filtered = args.ownerMembershipId
    ? rows.filter((row) => readCreatedByMembershipId(row.config_json) === args.ownerMembershipId)
    : rows;

  return filtered.map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    slug: row.slug,
    title: row.title,
    assessment_type: row.assessment_type,
    status: row.status,
    config_json: row.config_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }));
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function readCreatedByMembershipId(configJson: unknown): string | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return null;
  }

  const value = (configJson as Record<string, unknown>)["createdByMembershipId"];
  return typeof value === "string" ? value : null;
}

export function readDescription(configJson: unknown): string | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return null;
  }

  const value = (configJson as Record<string, unknown>)["description"];
  return typeof value === "string" ? value : null;
}

export function buildAssessmentConfigJson(args: {
  createdByMembershipId: string;
  description?: string | null;
  config: AssessmentConfig;
}): Record<string, unknown> {
  return {
    createdByMembershipId: args.createdByMembershipId,
    ...(args.description != null ? { description: args.description } : {}),
    ...args.config,
  };
}

export function extractAssessmentConfig(configJson: unknown): AssessmentConfig {
  const base =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};

  return {
    attemptsAllowed: typeof base["attemptsAllowed"] === "number" ? base["attemptsAllowed"] : 1,
    timeLimitSeconds:
      typeof base["timeLimitSeconds"] === "number" ? base["timeLimitSeconds"] : undefined,
    passMarkPercent: typeof base["passMarkPercent"] === "number" ? base["passMarkPercent"] : 70,
    shuffleItems: base["shuffleItems"] === true,
    shuffleOptions: base["shuffleOptions"] === true,
    secureMode: base["secureMode"] === true,
    l1ProctoringEnabled: base["l1ProctoringEnabled"] === true,
    showAnswersPolicy:
      base["showAnswersPolicy"] === "never" ||
      base["showAnswersPolicy"] === "after_submit" ||
      base["showAnswersPolicy"] === "after_pass" ||
      base["showAnswersPolicy"] === "after_graded"
        ? base["showAnswersPolicy"]
        : "after_submit",
  };
}

export function readItemRequired(configJson: unknown): boolean {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return true;
  }

  return (configJson as Record<string, unknown>)["required"] !== false;
}

export const assessmentsRepository = {
  async findById(tx: TenantTx, assessmentId: string): Promise<AssessmentRow | null> {
    const rows = await tx.$queryRaw<AssessmentRow[]>`
      select
        id::text,
        tenant_id::text,
        slug,
        title,
        assessment_type,
        status::text,
        config_json,
        created_at,
        updated_at,
        deleted_at
      from assessments
      where id = ${assessmentId}::uuid
        and deleted_at is null
      limit 1
    `;

    return rows[0] ?? null;
  },

  async slugExists(tx: TenantTx, slug: string, excludeId?: string): Promise<boolean> {
    if (excludeId) {
      const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
        select exists(
          select 1
          from assessments
          where slug = ${slug}
            and deleted_at is null
            and id <> ${excludeId}::uuid
        ) as exists
      `;
      return rows[0]?.exists === true;
    }

    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      select exists(
        select 1
        from assessments
        where slug = ${slug}
          and deleted_at is null
      ) as exists
    `;

    return rows[0]?.exists === true;
  },

  async insertAssessment(
    tx: TenantTx,
    args: {
      tenantId: string;
      title: string;
      assessmentType: string;
      configJson: Record<string, unknown>;
      slug?: string;
    },
  ): Promise<AssessmentRow> {
    const id = randomUUID();
    const slug = args.slug ?? (slugifyTitle(args.title) || `assessment-${id.slice(0, 8)}`);

    await tx.$executeRaw`
      insert into assessments (
        id,
        tenant_id,
        slug,
        title,
        assessment_type,
        status,
        config_json,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${slug},
        ${args.title},
        ${args.assessmentType},
        'DRAFT',
        ${JSON.stringify(args.configJson)}::jsonb,
        now(),
        now()
      )
    `;

    const created = await this.findById(tx, id);
    if (!created) {
      throw new Error("Failed to create assessment");
    }

    return created;
  },

  async updateAssessment(
    tx: TenantTx,
    args: {
      assessmentId: string;
      title?: string;
      assessmentType?: string;
      configJson?: Record<string, unknown>;
    },
  ): Promise<AssessmentRow | null> {
    const current = await this.findById(tx, args.assessmentId);
    if (!current) {
      return null;
    }

    await tx.$executeRaw`
      update assessments
      set
        title = ${args.title ?? current.title},
        assessment_type = ${args.assessmentType ?? current.assessment_type},
        config_json = ${JSON.stringify(args.configJson ?? current.config_json)}::jsonb,
        updated_at = now()
      where id = ${args.assessmentId}::uuid
        and deleted_at is null
    `;

    return this.findById(tx, args.assessmentId);
  },

  async softDelete(tx: TenantTx, assessmentId: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      update assessments
      set deleted_at = now(), updated_at = now()
      where id = ${assessmentId}::uuid
        and deleted_at is null
    `;

    return result > 0;
  },

  async updateStatus(tx: TenantTx, assessmentId: string, status: string): Promise<void> {
    await tx.$executeRaw`
      update assessments
      set status = ${status}::"PublishStatus", updated_at = now()
      where id = ${assessmentId}::uuid
        and deleted_at is null
    `;
  },

  async listAssessments(tx: TenantTx, args: Parameters<typeof listAssessmentsQuery>[1]) {
    return listAssessmentsQuery(tx, args);
  },

  async listAssessmentItems(tx: TenantTx, assessmentId: string): Promise<AssessmentItemRow[]> {
    return tx.$queryRaw<AssessmentItemRow[]>`
      select
        id::text,
        tenant_id::text,
        assessment_id::text,
        item_id::text,
        position,
        points,
        config_json,
        created_at
      from assessment_items
      where assessment_id = ${assessmentId}::uuid
      order by position asc
    `;
  },

  async countAssessmentItems(tx: TenantTx, assessmentId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from assessment_items
      where assessment_id = ${assessmentId}::uuid
    `;

    return Number(rows[0]?.count ?? 0);
  },

  async replaceAssessmentItems(
    tx: TenantTx,
    args: {
      tenantId: string;
      assessmentId: string;
      items: Array<{
        itemId: string;
        position: number;
        points: number;
        required: boolean;
      }>;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      delete from assessment_items
      where assessment_id = ${args.assessmentId}::uuid
    `;

    for (const item of args.items) {
      await tx.$executeRaw`
        insert into assessment_items (
          id,
          tenant_id,
          assessment_id,
          item_id,
          position,
          points,
          config_json,
          created_at
        )
        values (
          ${randomUUID()}::uuid,
          ${args.tenantId}::uuid,
          ${args.assessmentId}::uuid,
          ${item.itemId}::uuid,
          ${item.position},
          ${item.points},
          ${JSON.stringify({ required: item.required })}::jsonb,
          now()
        )
      `;
    }
  },

  async findWorkflowDefinitionByKey(tx: TenantTx, key: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from workflow_definitions
      where key = ${key}
        and status = 'ACTIVE'
      limit 1
    `;

    return rows[0] ?? null;
  },

  async insertWorkflowTransition(
    tx: TenantTx,
    args: {
      tenantId: string;
      workflowDefinitionId: string;
      targetType: string;
      targetId: string;
      fromState: string;
      toState: string;
      actorMembershipId: string;
      reason: string | null;
      metadata: Record<string, unknown>;
    },
  ) {
    const id = randomUUID();

    await tx.$executeRaw`
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
  },

  async itemExistsInTenant(tx: TenantTx, itemId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      select exists(
        select 1 from items where id = ${itemId}::uuid and deleted_at is null
      ) as exists
    `;

    return rows[0]?.exists === true;
  },
};
