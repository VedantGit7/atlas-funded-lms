CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_membership_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.is_platform_scope()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.platform_scope', true) = 'true';
$$;

DO $$
DECLARE
  target_table text;
  tenant_tables text[] := ARRAY[
    'tenant_domains',

    'memberships',
    'member_profiles',

    'roles',
    'role_permissions',
    'user_roles',
    'permission_overrides',

    'tenant_config',
    'tenant_config_version',
    'feature_flag_overrides',
    'entitlements',
    'entitlement_grant_history',

    'audit_entries',
    'secret_refs',

    'outbox_events',
    'event_deliveries',
    'dead_letter_events',

    'provisioning_jobs',
    'tenant_branding',
    'tenant_theme',
    'tenant_branding_version',
    'tenant_theme_version',

    'courses',
    'course_modules',
    'lessons',
    'lesson_assets',
    'enrollments',
    'lesson_progress',

    'workflow_definitions',
    'workflow_transitions',

    'learning_paths',
    'path_steps',
    'path_step_gates',
    'path_enrollments',
    'path_step_progress',

    'items',
    'item_options',
    'item_dimension_weights',
    'item_collections',
    'item_collection_items',

    'assessments',
    'assessment_items',
    'attempts',
    'attempt_answers',
    'grading_tasks',

    'practice_sessions',
    'practice_responses',
    'srs_state',

    'competency_dimensions',
    'scoring_profiles',
    'scoring_config_versions',
    'competency_bands',
    'signal_sources',
    'competency_signals',
    'competency_scores',
    'composite_readiness_state',
    'competency_score_snapshots',

    'diagnostic_sessions',
    'readiness_policies',
    'attribution_tokens',

    'certificate_templates',
    'certificates',
    'credential_verifications',

    'gamification_profiles',
    'point_ledger',
    'badges',
    'badge_awards',
    'streak_states',
    'streak_freezes',
    'leaderboard_definitions',
    'leaderboard_snapshots',

    'notification_templates',
    'notification_dispatches',

    'community_spaces',
    'group_memberships',
    'posts',
    'comments',
    'reactions',
    'mentions',
    'moderation_cases',
    'moderation_decisions',
    'appeals',

    'search_index_entries',
    'analytics_rollups',
    'funnel_daily_rollups',
    'item_statistics',

    'automation_rules',
    'automation_runs',
    'locale_resources',
    'extension_registrations',

    'export_jobs',
    'deletion_requests'
  ];
BEGIN
  FOREACH target_table IN ARRAY tenant_tables
  LOOP
    IF to_regclass('public.' || quote_ident(target_table)) IS NULL THEN
      RAISE NOTICE 'Skipping missing table: %', target_table;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = target_table
        AND c.column_name = 'tenant_id'
    ) THEN
      RAISE EXCEPTION 'Tenant RLS table % does not have tenant_id', target_table;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      target_table || '_tenant_isolation',
      target_table
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO atlas_app, atlas_worker USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id())',
      target_table || '_tenant_isolation',
      target_table
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      target_table || '_platform_scope',
      target_table
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO atlas_platform USING (true) WITH CHECK (true)',
      target_table || '_platform_scope',
      target_table
    );
  END LOOP;
END $$;