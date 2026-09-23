import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type ReportDeliveryEffect = {
  effectKey: string;
  kind: "email" | "webhook" | "storage";
  destinationId: string | null;
  request: Record<string, unknown>;
  retryOnCrash: boolean;
};
type EffectRow = {
  effect_key: string;
  kind: ReportDeliveryEffect["kind"];
  destination_id: string | null;
  request_json: Record<string, unknown>;
  retry_on_crash: boolean;
  status: string;
  lease_until: Date | null;
  error_kind: string | null;
};
function effect(row: EffectRow): ReportDeliveryEffect {
  return {
    effectKey: row.effect_key,
    kind: row.kind,
    destinationId: row.destination_id,
    request: row.request_json,
    retryOnCrash: row.retry_on_crash,
  };
}
export const reportDeliveryEffectsRepository = {
  async list(tx: TenantTx, reportRunId: string): Promise<ReportDeliveryEffect[]> {
    const rows = await tx.$queryRaw<EffectRow[]>`
      select * from report_delivery_effects where report_run_id = ${reportRunId}::uuid order by ordinal
    `;
    return rows.map(effect);
  },
  async freeze(
    tx: TenantTx,
    reportRunId: string,
    effects: ReportDeliveryEffect[],
  ): Promise<ReportDeliveryEffect[]> {
    // Serializes first-plan creation, including concurrent events for the same run.
    await tx.$queryRaw`select id from report_runs where id = ${reportRunId}::uuid for update`;
    const existing = await this.list(tx, reportRunId);
    if (existing.length) return existing;
    for (const [ordinal, item] of effects.entries()) {
      await tx.$executeRaw`
        insert into report_delivery_effects
          (effect_key, tenant_id, report_run_id, ordinal, kind, destination_id, request_json, retry_on_crash, status)
        values (${item.effectKey}, nullif(current_setting('app.tenant_id',true),'')::uuid,
          ${reportRunId}::uuid, ${ordinal}, ${item.kind}, ${item.destinationId}::uuid,
          ${JSON.stringify(item.request)}::jsonb, ${item.retryOnCrash}, 'pending')
      `;
    }
    return effects;
  },
  async claim(
    tx: TenantTx,
    effectKey: string,
  ): Promise<{
    status: "claimed" | "succeeded" | "busy" | "permanent" | "reconciliation_required";
    effect?: ReportDeliveryEffect;
    leaseToken?: string;
  }> {
    const rows = await tx.$queryRaw<EffectRow[]>`
      select * from report_delivery_effects where effect_key = ${effectKey} for update
    `;
    const row = rows[0];
    if (!row) throw new Error("REPORT_EFFECT_MISSING");
    if (row.status === "succeeded") return { status: "succeeded" };
    if (row.status === "reconciliation_required") return { status: "reconciliation_required" };
    if (row.status === "failed" && row.error_kind === "permanent") return { status: "permanent" };
    if (row.status === "processing") {
      if (row.lease_until && row.lease_until.getTime() > Date.now()) return { status: "busy" };
      if (!row.retry_on_crash) {
        await tx.$executeRaw`
          update report_delivery_effects set status = 'reconciliation_required',
            error_kind = 'reconciliation_required', last_error = 'REPORT_EFFECT_ACCEPTANCE_UNKNOWN',
            lease_token = null, lease_until = null, updated_at = now() where effect_key = ${effectKey}
        `;
        return { status: "reconciliation_required" };
      }
    }
    const leaseToken = randomUUID();
    await tx.$executeRaw`
      update report_delivery_effects set status = 'processing', lease_token = ${leaseToken}::uuid,
        lease_until = now() + interval '2 minutes', attempts = attempts + 1, updated_at = now()
      where effect_key = ${effectKey}
    `;
    return { status: "claimed", effect: effect(row), leaseToken };
  },
  async finish(
    tx: TenantTx,
    effectKey: string,
    leaseToken: string,
    status: "succeeded" | "failed" | "reconciliation_required",
    errorKind: string | null,
    code: string | null,
  ): Promise<boolean> {
    const changed = await tx.$executeRaw`
      update report_delivery_effects set status = ${status}, error_kind = ${errorKind}, last_error = ${code},
        lease_token = null, lease_until = null, updated_at = now()
      where effect_key = ${effectKey} and lease_token = ${leaseToken}::uuid and status = 'processing'
    `;
    return changed === 1;
  },
};
