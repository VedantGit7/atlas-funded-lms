-- Audit finding M10 — central idempotency registry with replay protection.
--
-- `requireIdempotencyKey` asserted only that the header was present. Actual
-- deduplication depended on each handler happening to have its own
-- `@@unique([tenant_id, idempotency_key])`. Measured state: **188 routes**
-- declare `idempotency: "required"`, and **11 tables** carry an
-- `idempotency_key` column. Every other one of those routes validated the
-- header and then wrote twice on a replay — including the payment paths, where
-- a retried request after a timeout is the normal case rather than the
-- exceptional one.
--
-- This makes the guarantee framework-level instead of per-handler. The route
-- pipeline claims the key here before the handler runs, so a handler cannot
-- forget: forgetting is no longer possible.
--
-- Uniqueness is (tenant_id, idempotency_key) rather than
-- (tenant_id, route, idempotency_key). A key identifies one operation, so the
-- same key arriving at a different route is client error, not a second
-- namespace — and the request fingerprint below turns that into an explicit
-- rejection rather than a silent second write.

CREATE TABLE IF NOT EXISTS idempotency_records (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  idempotency_key      text NOT NULL,

  -- Recorded for diagnostics, deliberately not part of the unique key.
  scope                text NOT NULL,
  actor_membership_id  uuid,
  request_id           text,

  -- SHA-256 over method, path and body. Distinguishes an honest retry of the
  -- same operation from a key reused for a different one.
  request_fingerprint  text NOT NULL,

  status               text NOT NULL DEFAULT 'IN_PROGRESS',
  response_status      integer,
  response_json        jsonb,

  -- Set when the response was too large to store. A replay then fails loudly
  -- instead of re-running the handler, because re-running is the double write
  -- this table exists to prevent.
  response_omitted     boolean NOT NULL DEFAULT false,

  created_at           timestamptz(6) NOT NULL DEFAULT now(),
  completed_at         timestamptz(6),
  expires_at           timestamptz(6) NOT NULL DEFAULT now() + interval '24 hours',

  CONSTRAINT idempotency_records_status_valid
    CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),

  -- A completed record must say when, and must carry either a response or an
  -- explicit reason it has none. Without this a half-written row reads as a
  -- replayable success with an empty body.
  CONSTRAINT idempotency_records_completion_consistent
    CHECK (
      status <> 'COMPLETED'
      OR (completed_at IS NOT NULL AND (response_json IS NOT NULL OR response_omitted))
    )
);

COMMENT ON TABLE idempotency_records IS
  'Framework-level idempotency claims for mutating tenant routes. M10.';

-- The claim. ON CONFLICT against this index is what makes "first request wins"
-- atomic rather than a read-then-write race between two concurrent retries.
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_records_tenant_key_uq
  ON idempotency_records (tenant_id, idempotency_key);

-- Supports the retention sweep.
CREATE INDEX IF NOT EXISTS idempotency_records_expires_at_idx
  ON idempotency_records (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_records TO atlas_app, atlas_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_records TO atlas_platform;
