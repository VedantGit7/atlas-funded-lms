-- DoD item 8 — per-tenant cost attribution.
--
-- The architecture review named the gap exactly: "Gross-margin-per-tenant is a
-- stated North Star, but only the *usage* side is metered; the *cost* side
-- isn't instrumented." Usage per tenant was already derivable (storage bytes,
-- active members, emails, domains) or is metered from this release (API
-- requests). What did not exist anywhere was a price for a unit of any of it, or
-- a record of what the platform itself pays each month.
--
-- These two tables are that record. They are platform-global: a cost rate is a
-- fact about the platform's suppliers, not about any tenant, so neither table
-- carries tenant_id and neither is readable from the tenant plane at all.

-- ---------------------------------------------------------------------------
-- Variable costs: what one unit of a usage driver costs the platform.
-- ---------------------------------------------------------------------------
--
-- Append-only and versioned by month. A rate change is a new row with a later
-- effective_from, never an edit: "what did we believe storage cost when we
-- priced the Q3 plans" has to stay answerable after the supplier changes its
-- price, and a report for a past month must keep producing the number it
-- produced then.
CREATE TABLE IF NOT EXISTS platform_cost_rates (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Insertion order, used to decide which of several rates for the same month
  -- is the current one. Not created_at: its default is now(), which is the
  -- transaction's start time, so two rates written in one transaction tie and
  -- Postgres would pick between them arbitrarily.
  seq                    bigint GENERATED ALWAYS AS IDENTITY,

  driver                 text NOT NULL,

  -- USD per unit of the driver, where the unit is the driver's own (GB-month,
  -- email, million requests, ...). numeric rather than float: these are prices,
  -- and several are fractions of a cent.
  unit_cost_usd          numeric(14, 6) NOT NULL,

  -- First day of the month the rate applies from. It stays in force until a
  -- later row for the same driver supersedes it.
  effective_from         date NOT NULL,

  reason                 text NOT NULL,
  created_by_principal_id uuid REFERENCES auth_principals(id),
  created_at             timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT platform_cost_rates_driver_valid
    CHECK (driver IN (
      'storage_gb_month',
      'active_member',
      'email_sent',
      'custom_domain',
      'api_million_requests'
    )),
  CONSTRAINT platform_cost_rates_unit_cost_non_negative
    CHECK (unit_cost_usd >= 0),
  CONSTRAINT platform_cost_rates_effective_from_month_start
    CHECK (effective_from = date_trunc('month', effective_from)::date)
);

COMMENT ON TABLE platform_cost_rates IS
  'Platform supplier cost per unit of each usage driver, versioned by month. Append-only. DoD item 8.';

-- Deliberately not unique on (driver, effective_from). A mistyped rate has to be
-- correctable at once, and an append-only table can only correct by adding a
-- row: the rate in force for a month is the one with the latest effective_from
-- not after it, and among rows for that same month the last inserted (highest
-- seq). The mistaken row stays in the history, which is the point of never
-- updating.
CREATE INDEX IF NOT EXISTS platform_cost_rates_driver_month_idx
  ON platform_cost_rates (driver, effective_from DESC, seq DESC);

-- ---------------------------------------------------------------------------
-- Fixed costs: monthly bills that are not per-unit (servers, database plan,
-- monitoring plans), and the key they are shared out by.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_fixed_costs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label                  text NOT NULL,
  monthly_cost_usd       numeric(12, 2) NOT NULL,

  -- How this bill is divided between tenants. A server's CPU is consumed by
  -- requests; a per-seat auth plan is consumed by members. Choosing the key per
  -- line keeps each bill tied to what actually drives it.
  allocation_key         text NOT NULL,

  -- First month the line applies to, and the last (inclusive). An open-ended
  -- line has no effective_until.
  effective_from         date NOT NULL,
  effective_until        date,

  reason                 text NOT NULL,
  created_by_principal_id uuid REFERENCES auth_principals(id),
  ended_by_principal_id  uuid REFERENCES auth_principals(id),
  created_at             timestamptz(6) NOT NULL DEFAULT now(),
  updated_at             timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT platform_fixed_costs_label_present
    CHECK (length(btrim(label)) > 0),
  CONSTRAINT platform_fixed_costs_amount_non_negative
    CHECK (monthly_cost_usd >= 0),
  CONSTRAINT platform_fixed_costs_allocation_key_valid
    CHECK (allocation_key IN (
      'api_requests',
      'active_members',
      'member_days',
      'storage_gb',
      'equal'
    )),
  CONSTRAINT platform_fixed_costs_from_month_start
    CHECK (effective_from = date_trunc('month', effective_from)::date),
  CONSTRAINT platform_fixed_costs_until_month_start
    CHECK (effective_until IS NULL OR effective_until = date_trunc('month', effective_until)::date),
  CONSTRAINT platform_fixed_costs_range_ordered
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

COMMENT ON TABLE platform_fixed_costs IS
  'Platform fixed monthly costs and the key each is allocated to tenants by. Lines are ended, not deleted. DoD item 8.';

CREATE INDEX IF NOT EXISTS platform_fixed_costs_active_idx
  ON platform_fixed_costs (effective_from, effective_until);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
--
-- Supplier costs are commercially sensitive and have no tenant dimension, so the
-- tenant application and worker roles get nothing -- not even SELECT. The same
-- revokes are repeated in sql/grants/025_02_table_grants.sql, because that file's
-- blanket GRANT runs after migrate deploy on a fresh provision and would
-- otherwise hand every privilege back.
REVOKE ALL ON platform_cost_rates FROM atlas_app, atlas_worker;
REVOKE ALL ON platform_fixed_costs FROM atlas_app, atlas_worker;

GRANT SELECT, INSERT ON platform_cost_rates TO atlas_platform;
-- The rate history is the evidence behind every past report.
REVOKE UPDATE, DELETE ON platform_cost_rates FROM atlas_platform;

GRANT SELECT, INSERT, UPDATE ON platform_fixed_costs TO atlas_platform;
-- A line that stops applying is ended with effective_until, so the month it was
-- in force keeps reporting it.
REVOKE DELETE ON platform_fixed_costs FROM atlas_platform;
