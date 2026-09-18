import type { TenantTx } from "@atlas/db";
import {
  acknowledgeAtRiskAlertResponseSchema,
  evaluateAtRiskAlertsResponseSchema,
  listAtRiskAlertsQuerySchema,
  listAtRiskAlertsResponseSchema,
  listAtRiskRulesResponseSchema,
  atRiskRuleResponseSchema,
  updateAtRiskRuleBodySchema,
} from "./at-risk.dto";
import {
  atRiskAlertAlreadyAcknowledged,
  atRiskAlertNotFound,
  atRiskRuleNotFound,
} from "./at-risk.errors";
import { atRiskRepository } from "./at-risk.repository";
import type { AtRiskAlertRow, AtRiskRuleRow, AtRiskServiceCtx } from "./at-risk.types";

function formatDisplayName(membershipId: string, displayName: string | null): string {
  return displayName ?? `Member ${membershipId.slice(0, 8)}`;
}

function mapAlertDto(row: AtRiskAlertRow) {
  return {
    id: row.id,
    ruleId: row.at_risk_rule_id,
    ruleKey: row.rule_key,
    ruleName: row.rule_name,
    membershipId: row.membership_id,
    displayName: formatDisplayName(row.membership_id, row.display_name),
    status: row.status as "open" | "acknowledged",
    context: row.context_json,
    triggeredAt: row.triggered_at.toISOString(),
    acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
  };
}

function mapRuleDto(row: AtRiskRuleRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    ruleType: row.rule_type,
    config: row.config_json,
    status: row.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listAtRiskAlerts(tx: TenantTx, _ctx: AtRiskServiceCtx, rawQuery: unknown) {
  const query = listAtRiskAlertsQuerySchema.parse(rawQuery);
  const rows = await atRiskRepository.listAlerts(tx, {
    status: query.status ?? null,
    cursor: query.cursor ?? null,
    limit: query.limit,
  });

  const pageRows = rows.slice(0, query.limit);
  const hasNextPage = rows.length > query.limit;
  const nextCursor = hasNextPage ? (pageRows.at(-1)?.id ?? null) : null;

  return listAtRiskAlertsResponseSchema.parse({
    data: {
      alerts: pageRows.map(mapAlertDto),
      pageInfo: {
        nextCursor,
        hasNextPage,
      },
    },
  });
}

export async function acknowledgeAtRiskAlert(
  tx: TenantTx,
  _ctx: AtRiskServiceCtx,
  alertId: string,
) {
  const existing = await atRiskRepository.findAlertById(tx, alertId);
  if (!existing) {
    throw atRiskAlertNotFound(alertId);
  }

  if (existing.status === "acknowledged") {
    throw atRiskAlertAlreadyAcknowledged(alertId);
  }

  const updated = await atRiskRepository.acknowledgeAlert(tx, alertId);
  if (!updated) {
    throw atRiskAlertNotFound(alertId);
  }

  return acknowledgeAtRiskAlertResponseSchema.parse({
    data: mapAlertDto(updated),
  });
}

export async function listAtRiskRules(tx: TenantTx, _ctx: AtRiskServiceCtx) {
  await atRiskRepository.ensureDefaultRules(tx);
  const rules = await atRiskRepository.listRules(tx);

  return listAtRiskRulesResponseSchema.parse({
    data: {
      rules: rules.map(mapRuleDto),
    },
  });
}

export async function updateAtRiskRule(
  tx: TenantTx,
  _ctx: AtRiskServiceCtx,
  ruleId: string,
  rawBody: unknown,
) {
  const body = updateAtRiskRuleBodySchema.parse(rawBody);
  const updated = await atRiskRepository.updateRule(tx, {
    ruleId,
    ...(body.name ? { name: body.name } : {}),
    ...(body.config ? { config: body.config } : {}),
    ...(body.status ? { status: body.status } : {}),
  });

  if (!updated) {
    throw atRiskRuleNotFound(ruleId);
  }

  return atRiskRuleResponseSchema.parse({
    data: mapRuleDto(updated),
  });
}

export async function evaluateAtRiskAlerts(tx: TenantTx, _ctx: AtRiskServiceCtx) {
  await atRiskRepository.ensureDefaultRules(tx);
  const rules = await atRiskRepository.listRules(tx);
  const activeRules = rules.filter((rule) => rule.status === "ACTIVE");

  let alertsCreated = 0;
  let alertsUpdated = 0;

  for (const rule of activeRules) {
    if (rule.rule_type === "inactivity_days") {
      const inactivityDays = Number(rule.config_json["inactivityDays"] ?? 14);
      const memberships = await atRiskRepository.findInactiveMemberships(tx, inactivityDays);
      for (const membership of memberships) {
        const outcome = await atRiskRepository.upsertOpenAlert(tx, {
          ruleId: rule.id,
          membershipId: membership.membership_id,
          context: {
            lastSeenAt: membership.last_seen_at?.toISOString() ?? null,
            inactivityDays,
          },
        });
        if (outcome === "created") alertsCreated += 1;
        if (outcome === "updated") alertsUpdated += 1;
      }
      continue;
    }

    if (rule.rule_type === "grade_below") {
      const gradeThreshold = Number(rule.config_json["gradeThreshold"] ?? 70);
      const memberships = await atRiskRepository.findBelowGradeMemberships(tx, gradeThreshold);
      for (const membership of memberships) {
        const outcome = await atRiskRepository.upsertOpenAlert(tx, {
          ruleId: rule.id,
          membershipId: membership.membership_id,
          context: {
            scorePct: membership.score_pct,
            gradeThreshold,
          },
        });
        if (outcome === "created") alertsCreated += 1;
        if (outcome === "updated") alertsUpdated += 1;
      }
      continue;
    }

    // Last arm of an exhaustive chain: every other union member has
    // already returned, so `rule.rule_type === "low_activity_vs_cohort"` is always true here.
    {
      const lookbackDays = Number(rule.config_json["lookbackDays"] ?? 14);
      const cohortPercentile = Number(rule.config_json["cohortPercentile"] ?? 25);
      const memberships = await atRiskRepository.findLowActivityMemberships(
        tx,
        lookbackDays,
        cohortPercentile,
      );
      for (const membership of memberships) {
        const outcome = await atRiskRepository.upsertOpenAlert(tx, {
          ruleId: rule.id,
          membershipId: membership.membership_id,
          context: {
            activityCount: membership.activity_count,
            lookbackDays,
            cohortPercentile,
          },
        });
        if (outcome === "created") alertsCreated += 1;
        if (outcome === "updated") alertsUpdated += 1;
      }
    }
  }

  return evaluateAtRiskAlertsResponseSchema.parse({
    data: {
      evaluatedRules: activeRules.length,
      alertsCreated,
      alertsUpdated,
    },
  });
}
