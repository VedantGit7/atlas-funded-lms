-- Audit finding M3, coverage: composite tenant foreign keys for the remaining
-- tenant tables.
--
-- Migration 120 constrained the learning, money and access paths. This one
-- extends the same rule to every other reference column whose parent is
-- unambiguous: community, engagement, competency and practice, live classes,
-- paths, marketing, sales programmes, test series, messaging and integrations.
-- (tenant_id, <column>) -> parent(tenant_id, id): the parent must exist AND
-- belong to the same tenant.
--
-- Each mapping was confirmed against real writes: a probe recorded, for every
-- insert and update in the full test suite, whether the referenced id was a
-- same-tenant parent. Deliberately left out:
--   * actor attribution (created_by_, updated_by_, assigned_by_, decided_by_,
--     actor_membership_id, ...): set by the server from the session, never
--     from a client id, may hold the system actor sentinel, and mostly sits
--     on append-only history tables;
--   * polymorphic references (bundle_items.ref_id, mentions.source_id,
--     search_index_entries.source_id, storage_references.resource_id, ...);
--   * automation_runs.automation_rule_id: rules are hard-deleted while their
--     append-only run history is kept.
--
-- Platform-wide outbox rows (event_deliveries, dead_letter_events) have no
-- tenant_id; a composite key is not checked for them, only for tenant rows.
--
-- ON DELETE RESTRICT throughout, as in 120. Parents that are hard-deleted have
-- their dependants cleared or removed first by the code that deletes them.
--
-- Stage 1 (this migration): the new parents' (tenant_id, id) keys, and the
-- constraints added NOT VALID. Stage 2 (migration 123) validates existing
-- rows. Before deploying, run `pnpm db:tenant-fk:check` against the target
-- database; it lists any row stage 2 would reject.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Parent keys: (tenant_id, id) is trivially unique (id is the primary key);
-- the index is what a composite foreign key references.
CREATE UNIQUE INDEX IF NOT EXISTS moderation_cases_tenant_id_id_key ON public.moderation_cases (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS badges_tenant_id_id_key ON public.badges (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_templates_tenant_id_id_key ON public.certificate_templates (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS posts_tenant_id_id_key ON public.posts (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS scoring_profiles_tenant_id_id_key ON public.scoring_profiles (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS scoring_config_versions_tenant_id_id_key ON public.scoring_config_versions (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS competency_dimensions_tenant_id_id_key ON public.competency_dimensions (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS tags_tenant_id_id_key ON public.tags (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_tenant_id_id_key ON public.outbox_events (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS community_spaces_tenant_id_id_key ON public.community_spaces (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS item_collections_tenant_id_id_key ON public.item_collections (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS batches_tenant_id_id_key ON public.batches (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_forms_tenant_id_id_key ON public.marketing_forms (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_contacts_tenant_id_id_key ON public.marketing_contacts (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_events_tenant_id_id_key ON public.marketing_events (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_integration_webhooks_tenant_id_id_key ON public.marketing_integration_webhooks (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_newsfeed_posts_tenant_id_id_key ON public.marketing_newsfeed_posts (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_promo_sliders_tenant_id_id_key ON public.marketing_promo_sliders (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_workflow_runs_tenant_id_id_key ON public.marketing_workflow_runs (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_workflows_tenant_id_id_key ON public.marketing_workflows (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS learning_paths_tenant_id_id_key ON public.learning_paths (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS path_steps_tenant_id_id_key ON public.path_steps (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS learner_billing_locations_tenant_id_id_key ON public.learner_billing_locations (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_gateways_tenant_id_id_key ON public.payment_gateways (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_tenant_id_id_key ON public.live_sessions (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS practice_sessions_tenant_id_id_key ON public.practice_sessions (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS report_delivery_destinations_tenant_id_id_key ON public.report_delivery_destinations (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS reward_items_tenant_id_id_key ON public.reward_items (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_affiliate_payouts_tenant_id_id_key ON public.sales_affiliate_payouts (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_referral_codes_tenant_id_id_key ON public.sales_referral_codes (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_referral_attributions_tenant_id_id_key ON public.sales_referral_attributions (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS mock_tests_tenant_id_id_key ON public.mock_tests (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_templates_tenant_id_id_key ON public.whatsapp_templates (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_tenant_id_id_key ON public.whatsapp_conversations (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_definitions_tenant_id_id_key ON public.workflow_definitions (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS zoom_connections_tenant_id_id_key ON public.zoom_connections (tenant_id, id);


ALTER TABLE public.appeals
  ADD CONSTRAINT appeals_moderation_case_id_tenant_fkey
  FOREIGN KEY (tenant_id, moderation_case_id) REFERENCES public.moderation_cases (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.at_risk_alerts
  ADD CONSTRAINT at_risk_alerts_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.attribution_tokens
  ADD CONSTRAINT attribution_tokens_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.badge_awards
  ADD CONSTRAINT badge_awards_badge_id_tenant_fkey
  FOREIGN KEY (tenant_id, badge_id) REFERENCES public.badges (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.badge_awards
  ADD CONSTRAINT badge_awards_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.batch_memberships
  ADD CONSTRAINT batch_memberships_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.batches
  ADD CONSTRAINT batches_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.bundle_enrollments
  ADD CONSTRAINT bundle_enrollments_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_template_id_tenant_fkey
  FOREIGN KEY (tenant_id, template_id) REFERENCES public.certificate_templates (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_author_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, author_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_post_id_tenant_fkey
  FOREIGN KEY (tenant_id, post_id) REFERENCES public.posts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.competency_bands
  ADD CONSTRAINT competency_bands_scoring_profile_id_tenant_fkey
  FOREIGN KEY (tenant_id, scoring_profile_id) REFERENCES public.scoring_profiles (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.competency_score_snapshots
  ADD CONSTRAINT competency_score_snapshots_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.competency_score_snapshots
  ADD CONSTRAINT competency_score_snapshots_scoring_profile_id_tenant_fkey
  FOREIGN KEY (tenant_id, scoring_profile_id) REFERENCES public.scoring_profiles (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.competency_scores
  ADD CONSTRAINT competency_scores_config_version_id_tenant_fkey
  FOREIGN KEY (tenant_id, config_version_id) REFERENCES public.scoring_config_versions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.competency_scores
  ADD CONSTRAINT competency_scores_dimension_id_tenant_fkey
  FOREIGN KEY (tenant_id, dimension_id) REFERENCES public.competency_dimensions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.competency_scores
  ADD CONSTRAINT competency_scores_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.competency_scores
  ADD CONSTRAINT competency_scores_scoring_profile_id_tenant_fkey
  FOREIGN KEY (tenant_id, scoring_profile_id) REFERENCES public.scoring_profiles (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.competency_signals
  ADD CONSTRAINT competency_signals_dimension_id_tenant_fkey
  FOREIGN KEY (tenant_id, dimension_id) REFERENCES public.competency_dimensions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.competency_signals
  ADD CONSTRAINT competency_signals_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.composite_readiness_state
  ADD CONSTRAINT composite_readiness_state_config_version_id_tenant_fkey
  FOREIGN KEY (tenant_id, config_version_id) REFERENCES public.scoring_config_versions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.composite_readiness_state
  ADD CONSTRAINT composite_readiness_state_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.composite_readiness_state
  ADD CONSTRAINT composite_readiness_state_scoring_profile_id_tenant_fkey
  FOREIGN KEY (tenant_id, scoring_profile_id) REFERENCES public.scoring_profiles (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.course_backup_jobs
  ADD CONSTRAINT course_backup_jobs_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.course_reviews
  ADD CONSTRAINT course_reviews_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.course_reviews
  ADD CONSTRAINT course_reviews_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.course_tags
  ADD CONSTRAINT course_tags_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.course_tags
  ADD CONSTRAINT course_tags_tag_id_tenant_fkey
  FOREIGN KEY (tenant_id, tag_id) REFERENCES public.tags (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.custom_field_value_history
  ADD CONSTRAINT custom_field_value_history_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.custom_field_values
  ADD CONSTRAINT custom_field_values_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.dead_letter_events
  ADD CONSTRAINT dead_letter_events_outbox_event_id_tenant_fkey
  FOREIGN KEY (tenant_id, outbox_event_id) REFERENCES public.outbox_events (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.device_security_alerts
  ADD CONSTRAINT device_security_alerts_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.device_sessions
  ADD CONSTRAINT device_sessions_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.diagnostic_sessions
  ADD CONSTRAINT diagnostic_sessions_assessment_id_tenant_fkey
  FOREIGN KEY (tenant_id, assessment_id) REFERENCES public.assessments (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.diagnostic_sessions
  ADD CONSTRAINT diagnostic_sessions_attempt_id_tenant_fkey
  FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.attempts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.diagnostic_sessions
  ADD CONSTRAINT diagnostic_sessions_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.event_deliveries
  ADD CONSTRAINT event_deliveries_outbox_event_id_tenant_fkey
  FOREIGN KEY (tenant_id, outbox_event_id) REFERENCES public.outbox_events (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.gamification_profiles
  ADD CONSTRAINT gamification_profiles_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.grading_tasks
  ADD CONSTRAINT grading_tasks_assigned_to_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, assigned_to_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.group_memberships
  ADD CONSTRAINT group_memberships_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.group_memberships
  ADD CONSTRAINT group_memberships_space_id_tenant_fkey
  FOREIGN KEY (tenant_id, space_id) REFERENCES public.community_spaces (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.group_streak_states
  ADD CONSTRAINT group_streak_states_space_id_tenant_fkey
  FOREIGN KEY (tenant_id, space_id) REFERENCES public.community_spaces (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.identity_verifications
  ADD CONSTRAINT identity_verifications_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.identity_verifications
  ADD CONSTRAINT identity_verifications_proctoring_session_id_tenant_fkey
  FOREIGN KEY (tenant_id, proctoring_session_id) REFERENCES public.proctoring_sessions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.item_collection_items
  ADD CONSTRAINT item_collection_items_collection_id_tenant_fkey
  FOREIGN KEY (tenant_id, collection_id) REFERENCES public.item_collections (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.item_collection_items
  ADD CONSTRAINT item_collection_items_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, item_id) REFERENCES public.items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.item_dimension_weights
  ADD CONSTRAINT item_dimension_weights_dimension_id_tenant_fkey
  FOREIGN KEY (tenant_id, dimension_id) REFERENCES public.competency_dimensions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.item_dimension_weights
  ADD CONSTRAINT item_dimension_weights_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, item_id) REFERENCES public.items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.item_statistics
  ADD CONSTRAINT item_statistics_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, item_id) REFERENCES public.items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.learner_subscription_enrollments
  ADD CONSTRAINT learner_subscription_enrollments_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.lesson_tags
  ADD CONSTRAINT lesson_tags_lesson_id_tenant_fkey
  FOREIGN KEY (tenant_id, lesson_id) REFERENCES public.lessons (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.lesson_tags
  ADD CONSTRAINT lesson_tags_tag_id_tenant_fkey
  FOREIGN KEY (tenant_id, tag_id) REFERENCES public.tags (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.live_attendance
  ADD CONSTRAINT live_attendance_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_batch_id_tenant_fkey
  FOREIGN KEY (tenant_id, batch_id) REFERENCES public.batches (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.marketing_ctas
  ADD CONSTRAINT marketing_ctas_form_id_tenant_fkey
  FOREIGN KEY (tenant_id, form_id) REFERENCES public.marketing_forms (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.marketing_event_registrations
  ADD CONSTRAINT marketing_event_registrations_contact_id_tenant_fkey
  FOREIGN KEY (tenant_id, contact_id) REFERENCES public.marketing_contacts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.marketing_event_registrations
  ADD CONSTRAINT marketing_event_registrations_event_id_tenant_fkey
  FOREIGN KEY (tenant_id, event_id) REFERENCES public.marketing_events (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.marketing_event_registrations
  ADD CONSTRAINT marketing_event_registrations_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.marketing_form_submissions
  ADD CONSTRAINT marketing_form_submissions_contact_id_tenant_fkey
  FOREIGN KEY (tenant_id, contact_id) REFERENCES public.marketing_contacts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.marketing_form_submissions
  ADD CONSTRAINT marketing_form_submissions_form_id_tenant_fkey
  FOREIGN KEY (tenant_id, form_id) REFERENCES public.marketing_forms (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.marketing_integration_webhook_deliveries
  ADD CONSTRAINT marketing_integration_webhook_deliveries_webhook_id_tenant_fkey
  FOREIGN KEY (tenant_id, webhook_id) REFERENCES public.marketing_integration_webhooks (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.marketing_newsfeed_saves
  ADD CONSTRAINT marketing_newsfeed_saves_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.marketing_newsfeed_saves
  ADD CONSTRAINT marketing_newsfeed_saves_post_id_tenant_fkey
  FOREIGN KEY (tenant_id, post_id) REFERENCES public.marketing_newsfeed_posts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.marketing_promo_slides
  ADD CONSTRAINT marketing_promo_slides_slider_id_tenant_fkey
  FOREIGN KEY (tenant_id, slider_id) REFERENCES public.marketing_promo_sliders (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.marketing_workflow_run_logs
  ADD CONSTRAINT marketing_workflow_run_logs_run_id_tenant_fkey
  FOREIGN KEY (tenant_id, run_id) REFERENCES public.marketing_workflow_runs (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.marketing_workflow_runs
  ADD CONSTRAINT marketing_workflow_runs_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.marketing_workflow_runs
  ADD CONSTRAINT marketing_workflow_runs_workflow_id_tenant_fkey
  FOREIGN KEY (tenant_id, workflow_id) REFERENCES public.marketing_workflows (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.member_balances
  ADD CONSTRAINT member_balances_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.mentions
  ADD CONSTRAINT mentions_mentioned_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, mentioned_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.messenger_messages
  ADD CONSTRAINT messenger_messages_sender_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, sender_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.mock_test_enrollments
  ADD CONSTRAINT mock_test_enrollments_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.mock_tests
  ADD CONSTRAINT mock_tests_assessment_id_tenant_fkey
  FOREIGN KEY (tenant_id, assessment_id) REFERENCES public.assessments (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.moderation_decisions
  ADD CONSTRAINT moderation_decisions_moderation_case_id_tenant_fkey
  FOREIGN KEY (tenant_id, moderation_case_id) REFERENCES public.moderation_cases (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.module_scorm_progress
  ADD CONSTRAINT module_scorm_progress_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.module_scorm_progress
  ADD CONSTRAINT module_scorm_progress_module_id_tenant_fkey
  FOREIGN KEY (tenant_id, module_id) REFERENCES public.course_modules (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.notification_dispatches
  ADD CONSTRAINT notification_dispatches_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.path_enrollments
  ADD CONSTRAINT path_enrollments_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.path_enrollments
  ADD CONSTRAINT path_enrollments_path_id_tenant_fkey
  FOREIGN KEY (tenant_id, path_id) REFERENCES public.learning_paths (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.path_step_gates
  ADD CONSTRAINT path_step_gates_path_step_id_tenant_fkey
  FOREIGN KEY (tenant_id, path_step_id) REFERENCES public.path_steps (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.path_step_progress
  ADD CONSTRAINT path_step_progress_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.path_steps
  ADD CONSTRAINT path_steps_path_id_tenant_fkey
  FOREIGN KEY (tenant_id, path_id) REFERENCES public.learning_paths (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.payment_gateways
  ADD CONSTRAINT payment_gateways_billing_location_id_tenant_fkey
  FOREIGN KEY (tenant_id, billing_location_id) REFERENCES public.learner_billing_locations (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.payment_refund_intents
  ADD CONSTRAINT payment_refund_intents_gateway_id_tenant_fkey
  FOREIGN KEY (tenant_id, gateway_id) REFERENCES public.payment_gateways (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.point_ledger
  ADD CONSTRAINT point_ledger_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.poll_responses
  ADD CONSTRAINT poll_responses_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.polls
  ADD CONSTRAINT polls_live_session_id_tenant_fkey
  FOREIGN KEY (tenant_id, live_session_id) REFERENCES public.live_sessions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, author_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_space_id_tenant_fkey
  FOREIGN KEY (tenant_id, space_id) REFERENCES public.community_spaces (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.practice_responses
  ADD CONSTRAINT practice_responses_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, item_id) REFERENCES public.items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.practice_responses
  ADD CONSTRAINT practice_responses_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.practice_responses
  ADD CONSTRAINT practice_responses_practice_session_id_tenant_fkey
  FOREIGN KEY (tenant_id, practice_session_id) REFERENCES public.practice_sessions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.practice_sessions
  ADD CONSTRAINT practice_sessions_collection_id_tenant_fkey
  FOREIGN KEY (tenant_id, collection_id) REFERENCES public.item_collections (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT practice_sessions_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.proctoring_reports
  ADD CONSTRAINT proctoring_reports_proctoring_session_id_tenant_fkey
  FOREIGN KEY (tenant_id, proctoring_session_id) REFERENCES public.proctoring_sessions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.quest_definitions
  ADD CONSTRAINT quest_definitions_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.quest_progress
  ADD CONSTRAINT quest_progress_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.reactions
  ADD CONSTRAINT reactions_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.readiness_policies
  ADD CONSTRAINT readiness_policies_scoring_profile_id_tenant_fkey
  FOREIGN KEY (tenant_id, scoring_profile_id) REFERENCES public.scoring_profiles (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.report_delivery_effects
  ADD CONSTRAINT report_delivery_effects_destination_id_tenant_fkey
  FOREIGN KEY (tenant_id, destination_id) REFERENCES public.report_delivery_destinations (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.reward_redemptions
  ADD CONSTRAINT reward_redemptions_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.reward_redemptions
  ADD CONSTRAINT reward_redemptions_reward_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, reward_item_id) REFERENCES public.reward_items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_affiliate_commissions
  ADD CONSTRAINT sales_affiliate_commissions_affiliate_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, affiliate_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_affiliate_commissions
  ADD CONSTRAINT sales_affiliate_commissions_buyer_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, buyer_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_affiliate_commissions
  ADD CONSTRAINT sales_affiliate_commissions_payout_id_tenant_fkey
  FOREIGN KEY (tenant_id, payout_id) REFERENCES public.sales_affiliate_payouts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_affiliate_payouts
  ADD CONSTRAINT sales_affiliate_payouts_affiliate_id_tenant_fkey
  FOREIGN KEY (tenant_id, affiliate_id) REFERENCES public.sales_affiliates (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_affiliate_payouts
  ADD CONSTRAINT sales_affiliate_payouts_affiliate_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, affiliate_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_affiliate_products
  ADD CONSTRAINT sales_affiliate_products_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_affiliate_requests
  ADD CONSTRAINT sales_affiliate_requests_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_affiliates
  ADD CONSTRAINT sales_affiliates_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_attribution_events
  ADD CONSTRAINT sales_attribution_events_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_referral_attributions
  ADD CONSTRAINT sales_referral_attributions_referee_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, referee_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_referral_attributions
  ADD CONSTRAINT sales_referral_attributions_referral_code_id_tenant_fkey
  FOREIGN KEY (tenant_id, referral_code_id) REFERENCES public.sales_referral_codes (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_referral_attributions
  ADD CONSTRAINT sales_referral_attributions_referrer_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, referrer_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_referral_codes
  ADD CONSTRAINT sales_referral_codes_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_referral_purchase_credits
  ADD CONSTRAINT sales_referral_purchase_credits_attribution_id_tenant_fkey
  FOREIGN KEY (tenant_id, attribution_id) REFERENCES public.sales_referral_attributions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_referral_purchase_credits
  ADD CONSTRAINT sales_referral_purchase_credits_referee_membership_tenant_fkey
  FOREIGN KEY (tenant_id, referee_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_referral_purchase_credits
  ADD CONSTRAINT sales_referral_purchase_credits_referrer_membership_tenant_fkey
  FOREIGN KEY (tenant_id, referrer_membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.scoring_config_versions
  ADD CONSTRAINT scoring_config_versions_scoring_profile_id_tenant_fkey
  FOREIGN KEY (tenant_id, scoring_profile_id) REFERENCES public.scoring_profiles (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.srs_state
  ADD CONSTRAINT srs_state_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, item_id) REFERENCES public.items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.srs_state
  ADD CONSTRAINT srs_state_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.streak_freezes
  ADD CONSTRAINT streak_freezes_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.streak_states
  ADD CONSTRAINT streak_states_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.tenant_active_days
  ADD CONSTRAINT tenant_active_days_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.test_series_enrollments
  ADD CONSTRAINT test_series_enrollments_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.test_series_item_progress
  ADD CONSTRAINT test_series_item_progress_attempt_id_tenant_fkey
  FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.attempts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.test_series_item_progress
  ADD CONSTRAINT test_series_item_progress_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.test_series_items
  ADD CONSTRAINT test_series_items_assessment_id_tenant_fkey
  FOREIGN KEY (tenant_id, assessment_id) REFERENCES public.assessments (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.test_series_items
  ADD CONSTRAINT test_series_items_mock_test_id_tenant_fkey
  FOREIGN KEY (tenant_id, mock_test_id) REFERENCES public.mock_tests (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.whatsapp_campaigns
  ADD CONSTRAINT whatsapp_campaigns_template_id_tenant_fkey
  FOREIGN KEY (tenant_id, template_id) REFERENCES public.whatsapp_templates (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.whatsapp_inbox_messages
  ADD CONSTRAINT whatsapp_inbox_messages_conversation_id_tenant_fkey
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES public.whatsapp_conversations (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.workflow_transitions
  ADD CONSTRAINT workflow_transitions_workflow_definition_id_tenant_fkey
  FOREIGN KEY (tenant_id, workflow_definition_id) REFERENCES public.workflow_definitions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.zoom_meeting_participants
  ADD CONSTRAINT zoom_meeting_participants_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.zoom_webhook_events
  ADD CONSTRAINT zoom_webhook_events_zoom_connection_id_tenant_fkey
  FOREIGN KEY (tenant_id, zoom_connection_id) REFERENCES public.zoom_connections (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

COMMIT;
