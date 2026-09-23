-- Preserve historical unknown outcomes. Do not backfill unverified erasure claims.
ALTER TABLE deletion_requests ADD COLUMN outcome_json jsonb;
ALTER TABLE deletion_requests ADD CONSTRAINT deletion_requests_outcome_object
  CHECK (outcome_json IS NULL OR jsonb_typeof(outcome_json) = 'object');
COMMENT ON COLUMN deletion_requests.outcome_json IS
  'Versioned outcome recorded atomically with access removal; NULL means no detailed evidence. Not proof of data erasure.';
