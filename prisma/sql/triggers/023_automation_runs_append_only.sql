DROP TRIGGER IF EXISTS automation_runs_append_only ON automation_runs;
CREATE TRIGGER automation_runs_append_only
BEFORE UPDATE OR DELETE ON automation_runs
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();