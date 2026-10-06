-- Audit finding M3 — no composite tenant foreign keys.
--
-- Core tables referenced each other by id alone, and most had no foreign key
-- at all, so a row could point at a row of another tenant (or at nothing)
-- whenever application code trusted an id it was given. RLS hides other
-- tenants' rows from reads; it does not stop a write that names one.
--
-- Each reference on the learning, money and access paths becomes a composite
-- foreign key (tenant_id, <parent>_id) -> parent(tenant_id, id): the parent
-- must exist AND belong to the same tenant. ON DELETE RESTRICT throughout:
-- these parents are soft-deleted (memberships, courses, assessments, items,
-- roles, ...) or have their children removed first (coupons, roles,
-- assessment items while still a draft), so a hard delete that would orphan
-- children is a bug to surface, not a case to cascade.
--
-- Stage 1 (this migration): the parents' (tenant_id, id) keys, and the
-- constraints added NOT VALID, so every new write is checked immediately
-- while existing rows are left alone. Stage 2 (migration 121) validates the
-- existing rows. Before deploying, run `pnpm db:tenant-fk:check` against the
-- target database; it lists any row stage 2 would reject.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Parent keys: (tenant_id, id) is trivially unique (id is the primary key);
-- the index is what a composite foreign key references.
CREATE UNIQUE INDEX IF NOT EXISTS courses_tenant_id_id_key ON public.courses (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS course_modules_tenant_id_id_key ON public.course_modules (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS lessons_tenant_id_id_key ON public.lessons (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_tenant_id_id_key ON public.memberships (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS assessments_tenant_id_id_key ON public.assessments (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS items_tenant_id_id_key ON public.items (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS attempts_tenant_id_id_key ON public.attempts (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_items_tenant_id_id_key ON public.assessment_items (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS certificates_tenant_id_id_key ON public.certificates (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_coupons_tenant_id_id_key ON public.sales_coupons (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_wallets_tenant_id_id_key ON public.sales_wallets (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_affiliates_tenant_id_id_key ON public.sales_affiliates (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_id_id_key ON public.roles (tenant_id, id);


ALTER TABLE public.course_modules
  ADD CONSTRAINT course_modules_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.lessons
  ADD CONSTRAINT lessons_module_id_tenant_fkey
  FOREIGN KEY (tenant_id, module_id) REFERENCES public.course_modules (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.lesson_assets
  ADD CONSTRAINT lesson_assets_lesson_id_tenant_fkey
  FOREIGN KEY (tenant_id, lesson_id) REFERENCES public.lessons (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_lesson_id_tenant_fkey
  FOREIGN KEY (tenant_id, lesson_id) REFERENCES public.lessons (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.assessment_items
  ADD CONSTRAINT assessment_items_assessment_id_tenant_fkey
  FOREIGN KEY (tenant_id, assessment_id) REFERENCES public.assessments (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.assessment_items
  ADD CONSTRAINT assessment_items_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, item_id) REFERENCES public.items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.item_options
  ADD CONSTRAINT item_options_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, item_id) REFERENCES public.items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_assessment_id_tenant_fkey
  FOREIGN KEY (tenant_id, assessment_id) REFERENCES public.assessments (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.attempt_answers
  ADD CONSTRAINT attempt_answers_attempt_id_tenant_fkey
  FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.attempts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.attempt_answers
  ADD CONSTRAINT attempt_answers_assessment_item_id_tenant_fkey
  FOREIGN KEY (tenant_id, assessment_item_id) REFERENCES public.assessment_items (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.grading_tasks
  ADD CONSTRAINT grading_tasks_attempt_id_tenant_fkey
  FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.attempts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.proctoring_sessions
  ADD CONSTRAINT proctoring_sessions_attempt_id_tenant_fkey
  FOREIGN KEY (tenant_id, attempt_id) REFERENCES public.attempts (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.proctoring_sessions
  ADD CONSTRAINT proctoring_sessions_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.proctoring_events
  ADD CONSTRAINT proctoring_events_proctoring_session_id_tenant_fkey
  FOREIGN KEY (tenant_id, proctoring_session_id) REFERENCES public.proctoring_sessions (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.certificate_wallet_passes
  ADD CONSTRAINT certificate_wallet_passes_certificate_id_tenant_fkey
  FOREIGN KEY (tenant_id, certificate_id) REFERENCES public.certificates (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.credential_verifications
  ADD CONSTRAINT credential_verifications_certificate_id_tenant_fkey
  FOREIGN KEY (tenant_id, certificate_id) REFERENCES public.certificates (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.certificate_render_jobs
  ADD CONSTRAINT certificate_render_jobs_certificate_id_tenant_fkey
  FOREIGN KEY (tenant_id, certificate_id) REFERENCES public.certificates (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.payment_instalments
  ADD CONSTRAINT payment_instalments_payment_order_id_tenant_fkey
  FOREIGN KEY (tenant_id, payment_order_id) REFERENCES public.payment_orders (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.payment_instalment_plans
  ADD CONSTRAINT payment_instalment_plans_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_coupon_redemptions
  ADD CONSTRAINT sales_coupon_redemptions_coupon_id_tenant_fkey
  FOREIGN KEY (tenant_id, coupon_id) REFERENCES public.sales_coupons (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_coupon_redemptions
  ADD CONSTRAINT sales_coupon_redemptions_payment_order_id_tenant_fkey
  FOREIGN KEY (tenant_id, payment_order_id) REFERENCES public.payment_orders (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_coupon_redemptions
  ADD CONSTRAINT sales_coupon_redemptions_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_coupon_redemptions
  ADD CONSTRAINT sales_coupon_redemptions_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_coupon_courses
  ADD CONSTRAINT sales_coupon_courses_coupon_id_tenant_fkey
  FOREIGN KEY (tenant_id, coupon_id) REFERENCES public.sales_coupons (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_coupon_courses
  ADD CONSTRAINT sales_coupon_courses_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_wallets
  ADD CONSTRAINT sales_wallets_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_wallet_transactions
  ADD CONSTRAINT sales_wallet_transactions_wallet_id_tenant_fkey
  FOREIGN KEY (tenant_id, wallet_id) REFERENCES public.sales_wallets (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_wallet_transactions
  ADD CONSTRAINT sales_wallet_transactions_payment_order_id_tenant_fkey
  FOREIGN KEY (tenant_id, payment_order_id) REFERENCES public.payment_orders (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_wallet_transactions
  ADD CONSTRAINT sales_wallet_transactions_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_wallet_transactions
  ADD CONSTRAINT sales_wallet_transactions_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_affiliate_commissions
  ADD CONSTRAINT sales_affiliate_commissions_affiliate_id_tenant_fkey
  FOREIGN KEY (tenant_id, affiliate_id) REFERENCES public.sales_affiliates (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_affiliate_commissions
  ADD CONSTRAINT sales_affiliate_commissions_payment_order_id_tenant_fkey
  FOREIGN KEY (tenant_id, payment_order_id) REFERENCES public.payment_orders (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.sales_affiliate_commissions
  ADD CONSTRAINT sales_affiliate_commissions_course_id_tenant_fkey
  FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.sales_referral_purchase_credits
  ADD CONSTRAINT sales_referral_purchase_credits_payment_order_id_tenant_fkey
  FOREIGN KEY (tenant_id, payment_order_id) REFERENCES public.payment_orders (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_id_tenant_fkey
  FOREIGN KEY (tenant_id, role_id) REFERENCES public.roles (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_id_tenant_fkey
  FOREIGN KEY (tenant_id, role_id) REFERENCES public.roles (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE public.permission_overrides
  ADD CONSTRAINT permission_overrides_membership_id_tenant_fkey
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.memberships (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

COMMIT;
