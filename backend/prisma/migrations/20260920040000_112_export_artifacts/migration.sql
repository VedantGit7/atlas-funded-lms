ALTER TABLE export_jobs ADD COLUMN artifact_json jsonb;
ALTER TABLE export_jobs ADD CONSTRAINT export_jobs_artifact_object CHECK (artifact_json IS NULL OR jsonb_typeof(artifact_json) = 'object');
