-- Audit finding M12 — retention policy for proctoring media.
--
-- `proctoring_media_artifacts` had a `retention_expires_at` column and nothing
-- that set it, nothing that read it, and no purge anywhere in
-- `server/proctoring/`. Artifacts would have accumulated indefinitely: a
-- permanent storage cost floor, and — more seriously — indefinitely retained
-- webcam and screen footage of learners taking exams. That is biometric-adjacent
-- personal data under GDPR and the DPDP Act, and "we kept it forever because
-- nobody wrote the deletion job" is not a defensible retention position.
--
-- The table is empty today: L2/L3 proctoring created it and the upload path is
-- not implemented yet. That makes this the cheapest possible moment to fix — the
-- policy exists before the first artifact does, rather than being retrofitted
-- over a corpus nobody wants to reason about.
--
-- The default is the substance of the fix. A row cannot be written without an
-- expiry now, so an upload path that forgets to set one gets 90 days rather than
-- forever. Tenants may shorten it (see exam_security_policies.config_json
-- mediaRetentionDays); the application caps how far it may be lengthened.

ALTER TABLE proctoring_media_artifacts
  ALTER COLUMN retention_expires_at SET DEFAULT now() + interval '90 days';

UPDATE proctoring_media_artifacts
   SET retention_expires_at = created_at + interval '90 days'
 WHERE retention_expires_at IS NULL;

ALTER TABLE proctoring_media_artifacts
  ALTER COLUMN retention_expires_at SET NOT NULL;

COMMENT ON COLUMN proctoring_media_artifacts.retention_expires_at IS
  'When this artifact must be deleted from object storage and this table. NOT NULL with a 90-day default so an upload path cannot create immortal footage by omission. M12.';

-- Supports the sweep that deletes expired artifacts.
CREATE INDEX IF NOT EXISTS proctoring_media_artifacts_retention_idx
  ON proctoring_media_artifacts (retention_expires_at);

-- The purge deletes rows, so unlike the metering counters this table does need
-- DELETE in the tenant plane.
GRANT SELECT, INSERT, UPDATE, DELETE ON proctoring_media_artifacts TO atlas_app, atlas_worker;
