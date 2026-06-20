import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { DiagnosticSessionMetadata, DiagnosticSessionRow } from "./diagnostic.types";

export function parseDiagnosticSessionMetadata(metadataJson: unknown): DiagnosticSessionMetadata {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return {};
  }

  // Metadata JSON is validated at write boundaries; narrow unknown JSON here.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Prisma JSON boundary
  return metadataJson as DiagnosticSessionMetadata;
}

export const diagnosticRepository = {
  async findPublishedDiagnosticAssessment(
    tx: TenantTx,
    tenantId: string,
  ): Promise<{ id: string; title: string; config_json: unknown } | null> {
    const row = await tx.assessment.findFirst({
      where: {
        tenant_id: tenantId,
        assessment_type: "diagnostic",
        status: "PUBLISHED",
        deleted_at: null,
      },
      orderBy: { updated_at: "desc" },
      select: {
        id: true,
        title: true,
        config_json: true,
      },
    });

    return row;
  },

  async insertAnonymousSession(
    tx: TenantTx,
    args: {
      tenantId: string;
      anonymousId: string;
      assessmentId: string;
      ipHash: string;
      userAgentHash: string;
      mergeJson: Record<string, unknown>;
      metadataJson: DiagnosticSessionMetadata;
    },
  ): Promise<DiagnosticSessionRow> {
    const id = randomUUID();

    await tx.$executeRaw`
      insert into diagnostic_sessions (
        id,
        tenant_id,
        anonymous_id,
        assessment_id,
        status,
        ip_hash,
        user_agent_hash,
        started_at,
        merge_json,
        metadata_json
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.anonymousId},
        ${args.assessmentId}::uuid,
        'started',
        ${args.ipHash},
        ${args.userAgentHash},
        now(),
        ${JSON.stringify(args.mergeJson)}::jsonb,
        ${JSON.stringify(args.metadataJson)}::jsonb
      )
    `;

    const session = await this.findById(tx, id);
    if (!session) {
      throw new Error("Failed to create diagnostic session.");
    }

    return session;
  },

  async insertMembershipSession(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId: string;
      assessmentId: string;
      attemptId: string;
      metadataJson: DiagnosticSessionMetadata;
    },
  ): Promise<DiagnosticSessionRow> {
    const id = randomUUID();

    await tx.$executeRaw`
      insert into diagnostic_sessions (
        id,
        tenant_id,
        membership_id,
        assessment_id,
        attempt_id,
        status,
        started_at,
        metadata_json
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.membershipId}::uuid,
        ${args.assessmentId}::uuid,
        ${args.attemptId}::uuid,
        'started',
        now(),
        ${JSON.stringify(args.metadataJson)}::jsonb
      )
    `;

    const session = await this.findById(tx, id);
    if (!session) {
      throw new Error("Failed to create diagnostic session.");
    }

    return session;
  },

  async findById(tx: TenantTx, sessionId: string): Promise<DiagnosticSessionRow | null> {
    const rows = await tx.$queryRaw<DiagnosticSessionRow[]>`
      select
        id::text as id,
        tenant_id::text as tenant_id,
        anonymous_id,
        membership_id::text as membership_id,
        assessment_id::text as assessment_id,
        attempt_id::text as attempt_id,
        status,
        ip_hash,
        user_agent_hash,
        started_at,
        completed_at,
        merge_json,
        metadata_json
      from diagnostic_sessions
      where id = ${sessionId}::uuid
      limit 1
    `;

    return rows[0] ?? null;
  },

  async findByAnonymousId(
    tx: TenantTx,
    tenantId: string,
    anonymousId: string,
  ): Promise<DiagnosticSessionRow | null> {
    const rows = await tx.$queryRaw<DiagnosticSessionRow[]>`
      select
        id::text as id,
        tenant_id::text as tenant_id,
        anonymous_id,
        membership_id::text as membership_id,
        assessment_id::text as assessment_id,
        attempt_id::text as attempt_id,
        status,
        ip_hash,
        user_agent_hash,
        started_at,
        completed_at,
        merge_json,
        metadata_json
      from diagnostic_sessions
      where tenant_id = ${tenantId}::uuid
        and anonymous_id = ${anonymousId}
      order by started_at desc
      limit 1
    `;

    return rows[0] ?? null;
  },

  async updateSession(
    tx: TenantTx,
    sessionId: string,
    args: {
      status?: string;
      completedAt?: Date | null;
      mergeJson?: Record<string, unknown>;
      metadataJson?: DiagnosticSessionMetadata;
      membershipId?: string;
      attemptId?: string;
    },
  ): Promise<void> {
    const current = await this.findById(tx, sessionId);
    if (!current) return;

    const mergeJson =
      args.mergeJson != null
        ? args.mergeJson
        : current.merge_json && typeof current.merge_json === "object"
          ? (current.merge_json as Record<string, unknown>)
          : null;

    const metadataJson =
      args.metadataJson != null
        ? args.metadataJson
        : parseDiagnosticSessionMetadata(current.metadata_json);

    await tx.$executeRaw`
      update diagnostic_sessions
      set
        status = coalesce(${args.status ?? null}, status),
        completed_at = coalesce(${args.completedAt ?? null}::timestamptz, completed_at),
        merge_json = coalesce(${mergeJson != null ? JSON.stringify(mergeJson) : null}::jsonb, merge_json),
        metadata_json = ${JSON.stringify(metadataJson)}::jsonb,
        membership_id = coalesce(${args.membershipId ?? null}::uuid, membership_id),
        attempt_id = coalesce(${args.attemptId ?? null}::uuid, attempt_id)
      where id = ${sessionId}::uuid
    `;
  },
};
