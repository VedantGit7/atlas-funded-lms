export type PermissionDefinition = {
  key: string;
  description: string;
  resourceType: string;
  platformOnly?: boolean;
};

export const PERMISSIONS: readonly PermissionDefinition[] = [
  // Platform context — never granted to tenant roles
  {
    key: "platform.tenant.read",
    description: "List/inspect tenants and provisioning state",
    resourceType: "tenant",
    platformOnly: true,
  },
  {
    key: "platform.tenant.manage",
    description: "Create/suspend/resume/archive tenants and drive provisioning",
    resourceType: "tenant",
    platformOnly: true,
  },
  {
    key: "platform.entitlement.manage",
    description: "Grant/modify tenant entitlements",
    resourceType: "entitlement",
    platformOnly: true,
  },
  {
    key: "platform.feature_flag.manage",
    description: "Manage global feature flags",
    resourceType: "feature_flag",
    platformOnly: true,
  },
  {
    key: "platform.catalog.manage",
    description: "Manage global catalogues",
    resourceType: "catalog",
    platformOnly: true,
  },
  {
    key: "platform.audit.read",
    description: "Read cross-tenant/global audit stream",
    resourceType: "audit_entry",
    platformOnly: true,
  },
  {
    key: "platform.support.access",
    description: "Enter reason-bound platform support scope",
    resourceType: "tenant",
    platformOnly: true,
  },
  {
    key: "platform.identity.manage",
    description:
      "Review blocked re-registrations (relink requests) and disable or re-enable accounts",
    resourceType: "auth_principal",
    platformOnly: true,
  },
  {
    key: "platform.cost.read",
    description: "Read per-tenant cost attribution and the supplier rate card",
    resourceType: "cost",
    platformOnly: true,
  },
  {
    key: "platform.cost.manage",
    description: "Set supplier unit rates and fixed monthly costs",
    resourceType: "cost",
    platformOnly: true,
  },

  // Tenancy
  {
    key: "tenancy.domain.read",
    description: "View tenant domains and verification state",
    resourceType: "tenant_domain",
  },
  {
    key: "tenancy.domain.manage",
    description: "Manage tenant domains and lifecycle",
    resourceType: "tenant_domain",
  },
  {
    key: "tenancy.provisioning.read",
    description: "View tenant provisioning jobs/status",
    resourceType: "provisioning_job",
  },

  // Membership/profile
  { key: "membership.read", description: "View tenant memberships", resourceType: "membership" },
  { key: "membership.invite", description: "Invite tenant members", resourceType: "membership" },
  {
    key: "membership.suspend",
    description: "Suspend/reactivate tenant members",
    resourceType: "membership",
  },
  { key: "membership.remove", description: "Remove tenant members", resourceType: "membership" },
  { key: "profile.read", description: "Read member profiles", resourceType: "member_profile" },
  { key: "profile.update", description: "Update member profiles", resourceType: "member_profile" },

  // Access control
  { key: "role.read", description: "View roles and their permissions", resourceType: "role" },
  { key: "role.create", description: "Create a custom tenant role", resourceType: "role" },
  { key: "role.update", description: "Edit a role permission set", resourceType: "role" },
  { key: "role.delete", description: "Delete a custom tenant role", resourceType: "role" },
  { key: "role.assign", description: "Assign role to membership", resourceType: "user_role" },
  { key: "role.revoke", description: "Revoke role from membership", resourceType: "user_role" },
  {
    key: "permission_override.manage",
    description: "Create/remove explicit allow/deny overrides",
    resourceType: "permission_override",
  },

  // Branding/config
  {
    key: "branding.read",
    description: "View branding/theme config and versions",
    resourceType: "tenant_branding",
  },
  {
    key: "branding.update",
    description: "Edit branding/theme draft",
    resourceType: "tenant_branding",
  },
  {
    key: "branding.publish",
    description: "Publish branding/theme version",
    resourceType: "tenant_branding_version",
  },
  { key: "config.read", description: "View tenant runtime config", resourceType: "tenant_config" },
  { key: "config.update", description: "Edit tenant config draft", resourceType: "tenant_config" },
  {
    key: "config.publish",
    description: "Publish tenant config version",
    resourceType: "tenant_config_version",
  },
  {
    key: "feature_flag.read",
    description: "View effective tenant flag values",
    resourceType: "feature_flag_override",
  },
  {
    key: "feature_flag.override",
    description: "Set tenant feature-flag overrides",
    resourceType: "feature_flag_override",
  },
  { key: "entitlement.read", description: "View tenant entitlements", resourceType: "entitlement" },
  {
    key: "subscription.read",
    description: "View tenant subscriptions",
    resourceType: "subscription",
  },
  { key: "usage.read", description: "View tenant usage insights", resourceType: "usage" },
  {
    key: "usage.snapshot",
    description: "Record tenant usage snapshots",
    resourceType: "usage",
  },

  // Learning
  { key: "course.read", description: "Read courses", resourceType: "course" },
  { key: "course.create", description: "Create a course", resourceType: "course" },
  {
    key: "course.update",
    description: "Edit course/modules/lessons/assets",
    resourceType: "course",
  },
  { key: "course.delete", description: "Soft-delete a course", resourceType: "course" },
  { key: "course.publish", description: "Publish/unpublish a course", resourceType: "course" },
  { key: "enrollment.read", description: "View enrollments", resourceType: "enrollment" },
  { key: "enrollment.create", description: "Create enrollment", resourceType: "enrollment" },
  {
    key: "enrollment.manage",
    description: "Manage/transfer/cancel enrollments",
    resourceType: "enrollment",
  },
  { key: "course_review.read", description: "Read course reviews", resourceType: "course" },
  {
    key: "course_review.create",
    description: "Write or update a course review",
    resourceType: "course",
  },
  {
    // Self-scoped: only ever grants access to decks the learner owns. Managing
    // tenant/studio collections stays behind item_collection.manage.
    key: "practice_deck.manage",
    description: "Create and manage your own practice decks",
    resourceType: "item_collection",
  },
  {
    key: "progress.read",
    description: "View lesson/path progress",
    resourceType: "lesson_progress",
  },
  { key: "learning_path.read", description: "Read learning paths", resourceType: "learning_path" },
  {
    key: "learning_path.create",
    description: "Create learning path",
    resourceType: "learning_path",
  },
  {
    key: "learning_path.update",
    description: "Edit path steps and gates",
    resourceType: "learning_path",
  },
  {
    key: "learning_path.delete",
    description: "Soft-delete learning path",
    resourceType: "learning_path",
  },
  {
    key: "learning_path.publish",
    description: "Publish learning path",
    resourceType: "learning_path",
  },

  // Item registry / assessment / practice
  { key: "item.read", description: "Read items / item bank", resourceType: "item" },
  { key: "item.create", description: "Create item", resourceType: "item" },
  { key: "item.update", description: "Edit item/options/dimension weights", resourceType: "item" },
  { key: "item.delete", description: "Soft-delete item", resourceType: "item" },
  {
    key: "item_collection.manage",
    description: "Create/edit decks, quiz banks, practice sets",
    resourceType: "item_collection",
  },
  { key: "assessment.read", description: "Read assessments", resourceType: "assessment" },
  { key: "assessment.create", description: "Create assessment", resourceType: "assessment" },
  {
    key: "assessment.update",
    description: "Edit assessment composition/config",
    resourceType: "assessment",
  },
  { key: "assessment.delete", description: "Soft-delete assessment", resourceType: "assessment" },
  { key: "assessment.publish", description: "Publish assessment", resourceType: "assessment" },
  {
    key: "assessment.grade",
    description: "Manual/subjective grading",
    resourceType: "grading_task",
  },
  { key: "attempt.start", description: "Start attempt", resourceType: "attempt" },
  { key: "attempt.submit", description: "Submit/finalize attempt", resourceType: "attempt" },
  { key: "attempt.read", description: "Read attempts", resourceType: "attempt" },
  {
    key: "practice.start",
    description: "Start/continue practice session",
    resourceType: "practice_session",
  },

  // Competency/scoring
  {
    key: "competency.dimension.read",
    description: "Read competency dimensions",
    resourceType: "competency_dimension",
  },
  {
    key: "competency.dimension.manage",
    description: "Create/edit competency dimensions",
    resourceType: "competency_dimension",
  },
  {
    key: "scoring_profile.read",
    description: "Read scoring profiles",
    resourceType: "scoring_profile",
  },
  {
    key: "scoring_profile.create",
    description: "Create scoring profile",
    resourceType: "scoring_profile",
  },
  {
    key: "scoring_profile.update",
    description: "Edit scoring profile",
    resourceType: "scoring_profile",
  },
  {
    key: "scoring_config.publish",
    description: "Publish scoring config version",
    resourceType: "scoring_config_version",
  },
  {
    key: "competency.band.manage",
    description: "Define competency bands",
    resourceType: "competency_band",
  },
  {
    key: "competency.score.read",
    description: "Read scores/readiness",
    resourceType: "competency_score",
  },
  {
    key: "competency.signal.read",
    description: "Read raw competency signals",
    resourceType: "competency_signal",
  },

  // Certification
  {
    key: "certificate_template.read",
    description: "Read certificate templates",
    resourceType: "certificate_template",
  },
  {
    key: "certificate_template.manage",
    description: "Create/edit certificate templates",
    resourceType: "certificate_template",
  },
  {
    key: "certificate_template.publish",
    description: "Publish certificate template",
    resourceType: "certificate_template",
  },
  { key: "certificate.read", description: "Read certificates", resourceType: "certificate" },
  { key: "certificate.issue", description: "Issue certificate", resourceType: "certificate" },
  { key: "certificate.revoke", description: "Revoke certificate", resourceType: "certificate" },

  // Gamification
  {
    key: "gamification.profile.read",
    description: "Read XP/level profile",
    resourceType: "gamification_profile",
  },
  { key: "badge.read", description: "Read badge definitions/awards", resourceType: "badge" },
  {
    key: "badge.manage",
    description: "Create/edit badges and manual awards",
    resourceType: "badge",
  },
  {
    key: "leaderboard.read",
    description: "View leaderboards",
    resourceType: "leaderboard_definition",
  },
  {
    key: "leaderboard.manage",
    description: "Configure leaderboards",
    resourceType: "leaderboard_definition",
  },

  // Community/moderation
  { key: "community.space.read", description: "View spaces", resourceType: "community_space" },
  {
    key: "community.space.manage",
    description: "Create/edit/delete spaces",
    resourceType: "community_space",
  },
  { key: "community.space.join", description: "Join a space", resourceType: "group_membership" },
  { key: "post.read", description: "Read posts", resourceType: "post" },
  { key: "post.create", description: "Create post", resourceType: "post" },
  { key: "post.update", description: "Edit post", resourceType: "post" },
  { key: "post.delete", description: "Delete post", resourceType: "post" },
  { key: "comment.create", description: "Create comment", resourceType: "comment" },
  { key: "comment.update", description: "Edit comment", resourceType: "comment" },
  { key: "comment.delete", description: "Delete comment", resourceType: "comment" },
  { key: "reaction.create", description: "React to post/comment", resourceType: "reaction" },
  {
    key: "community.report",
    description: "Report posts and comments for moderation review",
    resourceType: "moderation_case",
  },
  {
    key: "community.moderate",
    description: "Open/decide moderation cases and action content",
    resourceType: "moderation_case",
  },
  { key: "appeal.create", description: "Submit appeal", resourceType: "appeal" },
  { key: "appeal.review", description: "Review/decide appeals", resourceType: "appeal" },

  // Notifications/search/analytics/data/workflow/automation/locales/extensions/app-layer
  {
    key: "notification.template.read",
    description: "Read notification templates",
    resourceType: "notification_template",
  },
  {
    key: "notification.template.manage",
    description: "Create/edit notification templates",
    resourceType: "notification_template",
  },
  {
    key: "notification.read.self",
    description: "Read own notifications",
    resourceType: "notification_dispatch",
  },
  {
    key: "search.query",
    description: "Query tenant search index",
    resourceType: "search_index_entry",
  },
  {
    key: "search.reindex.manage",
    description: "Trigger/administer reindex jobs",
    resourceType: "search_index_entry",
  },
  {
    key: "analytics.dashboard.view",
    description: "View advanced dashboards",
    resourceType: "analytics_rollup",
  },
  {
    key: "analytics.funnel.view",
    description: "View funnel rollups",
    resourceType: "funnel_daily_rollup",
  },
  {
    key: "analytics.at_risk.view",
    description: "View at-risk learner alerts",
    resourceType: "at_risk_alert",
  },
  {
    key: "analytics.at_risk.manage",
    description: "Acknowledge and manage at-risk alerts",
    resourceType: "at_risk_alert",
  },
  {
    key: "reports.library.view",
    description: "View reports library",
    resourceType: "report_definition",
  },
  {
    key: "reports.run",
    description: "Run report generations",
    resourceType: "report_run",
  },
  {
    key: "reports.schedule.manage",
    description: "Create and manage report schedules",
    resourceType: "report_schedule",
  },
  {
    key: "insights.view",
    description: "View admin insights dashboards",
    resourceType: "analytics_rollup",
  },
  { key: "data.export.run", description: "Run tenant data export job", resourceType: "export_job" },
  {
    key: "data.deletion.request",
    description: "File deletion request",
    resourceType: "deletion_request",
  },
  {
    key: "data.deletion.manage",
    description: "Approve/process deletion requests",
    resourceType: "deletion_request",
  },
  { key: "audit.read", description: "Read tenant audit log", resourceType: "audit_entry" },
  {
    key: "workflow.definition.read",
    description: "Read workflow definitions",
    resourceType: "workflow_definition",
  },
  {
    key: "workflow.definition.manage",
    description: "Create/edit workflow definitions",
    resourceType: "workflow_definition",
  },
  {
    key: "workflow.transition.act",
    description: "Approve/reject review transition",
    resourceType: "workflow_transition",
  },
  {
    key: "automation.rule.read",
    description: "Read automation rules",
    resourceType: "automation_rule",
  },
  {
    key: "automation.rule.manage",
    description: "Create/edit automation rules",
    resourceType: "automation_rule",
  },
  { key: "locale.read", description: "Read locale resources", resourceType: "locale_resource" },
  { key: "locale.manage", description: "Edit locale resources", resourceType: "locale_resource" },
  {
    key: "extension.point.read",
    description: "Read global extension-point catalogue",
    resourceType: "extension_point",
  },
  {
    key: "extension.registration.read",
    description: "Read tenant extension registrations",
    resourceType: "extension_registration",
  },
  {
    key: "extension.registration.manage",
    description: "Register/configure first-party extensions",
    resourceType: "extension_registration",
  },
  {
    key: "diagnostic.start",
    description: "Start diagnostic session",
    resourceType: "diagnostic_session",
  },
  {
    key: "readiness_policy.read",
    description: "Read readiness CTA policy",
    resourceType: "readiness_policy",
  },
  {
    key: "readiness_policy.manage",
    description: "Configure readiness CTA policy and legal copy",
    resourceType: "readiness_policy",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export function getPermissionKeys(): string[] {
  return PERMISSIONS.map((permission) => permission.key);
}

export function isPlatformPermission(key: string): boolean {
  return key.startsWith("platform.");
}
