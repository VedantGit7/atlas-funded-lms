-- Audit finding M11 — quantitative entitlement enforcement and per-tenant metering.
--
-- `enforce-entitlement.ts` checked key existence only. `Entitlement.value_json`
-- was never read, and the `usageContext` parameter was declared and ignored.
-- Every entitlement in the seeded catalogue is literally `true`, so a plan could
-- express "this tenant may use analytics" but never "this tenant may run 500
-- exports a month" — plan limits were unenforceable, and the only lever
-- available was switching a capability off entirely.
--
-- This is the counter side. The limit itself lives in `entitlements.value_json`,
-- which now accepts `{ "enabled": true, "limit": 500, "period": "month" }`
-- alongside the historic bare boolean.
--
-- The unique index is what makes the increment atomic: consumption is a single
-- INSERT ... ON CONFLICT DO UPDATE, so two concurrent requests against the last
-- remaining unit cannot both succeed. Doing this as read-then-write would
-- reintroduce exactly the C2/C3 class of bug this programme already fixed on the
-- wallet and coupon paths.

CREATE TABLE IF NOT EXISTS entitlement_usage (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,

  -- Start of the window this counter covers. A non-periodic ("total")
  -- entitlement uses the epoch, so one shape serves both cases.
  period_start   timestamptz(6) NOT NULL,
  period         text NOT NULL,

  used           bigint NOT NULL DEFAULT 0,

  -- The limit in force when the counter was last touched. Kept so a later plan
  -- change does not silently rewrite history: "they were over their limit in
  -- March" stays answerable after the limit is raised.
  limit_snapshot bigint,

  created_at     timestamptz(6) NOT NULL DEFAULT now(),
  updated_at     timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT entitlement_usage_period_valid
    CHECK (period IN ('day', 'month', 'total')),
  CONSTRAINT entitlement_usage_used_non_negative
    CHECK (used >= 0)
);

COMMENT ON TABLE entitlement_usage IS
  'Per-tenant metering for quantitative entitlements. M11.';

CREATE UNIQUE INDEX IF NOT EXISTS entitlement_usage_tenant_key_period_uq
  ON entitlement_usage (tenant_id, entitlement_key, period_start);

CREATE INDEX IF NOT EXISTS entitlement_usage_tenant_key_idx
  ON entitlement_usage (tenant_id, entitlement_key);

GRANT SELECT, INSERT, UPDATE ON entitlement_usage TO atlas_app, atlas_worker;
-- Counters are evidence of consumption. Nothing in the tenant plane may erase
-- them; expiry is by period rollover, not deletion.
REVOKE DELETE ON entitlement_usage FROM atlas_app, atlas_worker;

GRANT SELECT, INSERT, UPDATE, DELETE ON entitlement_usage TO atlas_platform;
