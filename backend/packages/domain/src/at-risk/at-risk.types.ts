export type AtRiskServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type AtRiskRuleType = "inactivity_days" | "grade_below" | "low_activity_vs_cohort";

export type AtRiskRuleRow = {
  id: string;
  key: string;
  name: string;
  rule_type: AtRiskRuleType;
  config_json: Record<string, unknown>;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type AtRiskAlertRow = {
  id: string;
  at_risk_rule_id: string;
  membership_id: string;
  status: string;
  context_json: Record<string, unknown> | null;
  triggered_at: Date;
  acknowledged_at: Date | null;
  created_at: Date;
  updated_at: Date;
  rule_key: string;
  rule_name: string;
  display_name: string | null;
};

export const DEFAULT_AT_RISK_RULES: Array<{
  key: string;
  name: string;
  ruleType: AtRiskRuleType;
  config: Record<string, unknown>;
}> = [
  {
    key: "inactivity_days",
    name: "Inactive learners",
    ruleType: "inactivity_days",
    config: { inactivityDays: 14 },
  },
  {
    key: "grade_below",
    name: "Below passing grade",
    ruleType: "grade_below",
    config: { gradeThreshold: 70 },
  },
  {
    key: "low_activity_vs_cohort",
    name: "Low activity vs cohort",
    ruleType: "low_activity_vs_cohort",
    config: { lookbackDays: 14, cohortPercentile: 25 },
  },
];
