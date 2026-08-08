-- Add progress tracking for report export runs (determinate progress bars).
ALTER TABLE report_runs
  ADD COLUMN IF NOT EXISTS progress_percent integer;

ALTER TABLE report_runs
  ADD CONSTRAINT report_runs_progress_percent_range
  CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100));
