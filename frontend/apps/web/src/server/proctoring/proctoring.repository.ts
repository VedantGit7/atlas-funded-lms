import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type ProctoringSessionRow = {
  id: string;
  tenant_id: string;
  attempt_id: string;
  membership_id: string;
  policy_id: string | null;
  status: string;
  level: number;
  started_at: Date;
  ended_at: Date | null;
  summary_json: unknown;
  consent_json: unknown;
};

export type ProctoringEventRow = {
  id: string;
  tenant_id: string;
  proctoring_session_id: string;
  event_type: string;
  severity: string;
  metadata_json: unknown;
  occurred_at: Date;
  idempotency_key: string | null;
};

export type ProctoringReportRow = {
  id: string;
  tenant_id: string;
  proctoring_session_id: string;
  risk_score: unknown;
  report_json: unknown;
  generated_at: Date;
};

export type IdentityVerificationRow = {
  id: string;
  tenant_id: string;
  proctoring_session_id: string;
  membership_id: string;
  status: string;
  method: string;
  score: unknown;
  metadata_json: unknown;
  verified_at: Date | null;
  created_at: Date;
};

export const proctoringRepository = {
  async findSessionByAttemptId(
    tx: TenantTx,
    args: { tenantId: string; attemptId: string },
  ): Promise<ProctoringSessionRow | null> {
    const rows = await tx.$queryRaw<ProctoringSessionRow[]>`
      select
        id::text,
        tenant_id::text,
        attempt_id::text,
        membership_id::text,
        policy_id::text,
        status,
        level,
        started_at,
        ended_at,
        summary_json,
        consent_json
      from proctoring_sessions
      where tenant_id = ${args.tenantId}::uuid
        and attempt_id = ${args.attemptId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertSession(
    tx: TenantTx,
    args: {
      tenantId: string;
      attemptId: string;
      membershipId: string;
      policyId?: string | null;
      level: number;
      summaryJson?: Record<string, unknown> | null;
      consentJson?: Record<string, unknown> | null;
    },
  ): Promise<ProctoringSessionRow> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into proctoring_sessions (
        id,
        tenant_id,
        attempt_id,
        membership_id,
        policy_id,
        status,
        level,
        started_at,
        summary_json,
        consent_json
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.attemptId}::uuid,
        ${args.membershipId}::uuid,
        ${args.policyId ?? null}::uuid,
        'active',
        ${args.level},
        now(),
        ${args.summaryJson ? JSON.stringify(args.summaryJson) : null}::jsonb,
        ${args.consentJson ? JSON.stringify(args.consentJson) : null}::jsonb
      )
    `;

    const created = await this.findSessionByAttemptId(tx, {
      tenantId: args.tenantId,
      attemptId: args.attemptId,
    });
    if (!created) {
      throw new Error("Failed to create proctoring session");
    }
    return created;
  },

  async updateSessionSummary(
    tx: TenantTx,
    args: {
      sessionId: string;
      summaryJson: Record<string, unknown>;
      consentJson?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    if (args.consentJson !== undefined) {
      await tx.$executeRaw`
        update proctoring_sessions
        set
          summary_json = ${JSON.stringify(args.summaryJson)}::jsonb,
          consent_json = ${args.consentJson ? JSON.stringify(args.consentJson) : null}::jsonb
        where id = ${args.sessionId}::uuid
      `;
      return;
    }

    await tx.$executeRaw`
      update proctoring_sessions
      set summary_json = ${JSON.stringify(args.summaryJson)}::jsonb
      where id = ${args.sessionId}::uuid
    `;
  },

  async endSession(
    tx: TenantTx,
    args: { sessionId: string; summaryJson?: Record<string, unknown> | null },
  ): Promise<void> {
    if (args.summaryJson) {
      await tx.$executeRaw`
        update proctoring_sessions
        set
          status = 'ended',
          ended_at = coalesce(ended_at, now()),
          summary_json = ${JSON.stringify(args.summaryJson)}::jsonb
        where id = ${args.sessionId}::uuid
      `;
      return;
    }

    await tx.$executeRaw`
      update proctoring_sessions
      set
        status = 'ended',
        ended_at = coalesce(ended_at, now())
      where id = ${args.sessionId}::uuid
    `;
  },

  async insertEvent(
    tx: TenantTx,
    args: {
      tenantId: string;
      sessionId: string;
      eventType: string;
      severity: string;
      metadataJson?: Record<string, unknown> | null;
      occurredAt: string;
      idempotencyKey: string;
    },
  ): Promise<boolean> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      insert into proctoring_events (
        id,
        tenant_id,
        proctoring_session_id,
        event_type,
        severity,
        metadata_json,
        occurred_at,
        idempotency_key
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.sessionId}::uuid,
        ${args.eventType},
        ${args.severity}::"Severity",
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        ${args.occurredAt}::timestamptz,
        ${args.idempotencyKey}
      )
      on conflict (tenant_id, idempotency_key) do nothing
      returning id::text
    `;
    return rows.length > 0;
  },

  async listEventsForSession(
    tx: TenantTx,
    args: { tenantId: string; sessionId: string },
  ): Promise<ProctoringEventRow[]> {
    return tx.$queryRaw<ProctoringEventRow[]>`
      select
        id::text,
        tenant_id::text,
        proctoring_session_id::text,
        event_type,
        severity::text,
        metadata_json,
        occurred_at,
        idempotency_key
      from proctoring_events
      where tenant_id = ${args.tenantId}::uuid
        and proctoring_session_id = ${args.sessionId}::uuid
      order by occurred_at asc, id asc
    `;
  },

  async upsertReport(
    tx: TenantTx,
    args: {
      tenantId: string;
      sessionId: string;
      riskScore: number;
      reportJson: Record<string, unknown>;
    },
  ): Promise<ProctoringReportRow> {
    const existing = await this.findReportBySessionId(tx, {
      tenantId: args.tenantId,
      sessionId: args.sessionId,
    });

    if (existing) {
      await tx.$executeRaw`
        update proctoring_reports
        set
          risk_score = ${args.riskScore},
          report_json = ${JSON.stringify(args.reportJson)}::jsonb,
          generated_at = now()
        where id = ${existing.id}::uuid
      `;
      const updated = await this.findReportBySessionId(tx, {
        tenantId: args.tenantId,
        sessionId: args.sessionId,
      });
      if (!updated) {
        throw new Error("Failed to update proctoring report");
      }
      return updated;
    }

    const id = randomUUID();
    await tx.$executeRaw`
      insert into proctoring_reports (
        id,
        tenant_id,
        proctoring_session_id,
        risk_score,
        report_json,
        generated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.sessionId}::uuid,
        ${args.riskScore},
        ${JSON.stringify(args.reportJson)}::jsonb,
        now()
      )
    `;

    const created = await this.findReportBySessionId(tx, {
      tenantId: args.tenantId,
      sessionId: args.sessionId,
    });
    if (!created) {
      throw new Error("Failed to create proctoring report");
    }
    return created;
  },

  async findReportBySessionId(
    tx: TenantTx,
    args: { tenantId: string; sessionId: string },
  ): Promise<ProctoringReportRow | null> {
    const rows = await tx.$queryRaw<ProctoringReportRow[]>`
      select
        id::text,
        tenant_id::text,
        proctoring_session_id::text,
        risk_score,
        report_json,
        generated_at
      from proctoring_reports
      where tenant_id = ${args.tenantId}::uuid
        and proctoring_session_id = ${args.sessionId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findIdentityBySessionId(
    tx: TenantTx,
    args: { tenantId: string; sessionId: string },
  ): Promise<IdentityVerificationRow | null> {
    const rows = await tx.$queryRaw<IdentityVerificationRow[]>`
      select
        id::text,
        tenant_id::text,
        proctoring_session_id::text,
        membership_id::text,
        status,
        method,
        score,
        metadata_json,
        verified_at,
        created_at
      from identity_verifications
      where tenant_id = ${args.tenantId}::uuid
        and proctoring_session_id = ${args.sessionId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsertIdentityVerification(
    tx: TenantTx,
    args: {
      tenantId: string;
      sessionId: string;
      membershipId: string;
      status: string;
      method: string;
      score?: number | null;
      metadataJson?: Record<string, unknown> | null;
      verifiedAt?: string | null;
    },
  ): Promise<IdentityVerificationRow> {
    const existing = await this.findIdentityBySessionId(tx, {
      tenantId: args.tenantId,
      sessionId: args.sessionId,
    });

    if (existing) {
      await tx.$executeRaw`
        update identity_verifications
        set
          status = ${args.status},
          method = ${args.method},
          score = ${args.score ?? null},
          metadata_json = ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
          verified_at = ${args.verifiedAt ?? null}::timestamptz
        where id = ${existing.id}::uuid
      `;
      const updated = await this.findIdentityBySessionId(tx, {
        tenantId: args.tenantId,
        sessionId: args.sessionId,
      });
      if (!updated) {
        throw new Error("Failed to update identity verification");
      }
      return updated;
    }

    const id = randomUUID();
    await tx.$executeRaw`
      insert into identity_verifications (
        id,
        tenant_id,
        proctoring_session_id,
        membership_id,
        status,
        method,
        score,
        metadata_json,
        verified_at,
        created_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.sessionId}::uuid,
        ${args.membershipId}::uuid,
        ${args.status},
        ${args.method},
        ${args.score ?? null},
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        ${args.verifiedAt ?? null}::timestamptz,
        now()
      )
    `;

    const created = await this.findIdentityBySessionId(tx, {
      tenantId: args.tenantId,
      sessionId: args.sessionId,
    });
    if (!created) {
      throw new Error("Failed to create identity verification");
    }
    return created;
  },
};
