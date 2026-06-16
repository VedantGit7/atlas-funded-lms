DROP TRIGGER IF EXISTS scoring_config_versions_append_only ON scoring_config_versions;
CREATE TRIGGER scoring_config_versions_append_only
BEFORE UPDATE OR DELETE ON scoring_config_versions
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

DROP TRIGGER IF EXISTS competency_signals_append_only ON competency_signals;
CREATE TRIGGER competency_signals_append_only
BEFORE UPDATE OR DELETE ON competency_signals
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

DROP TRIGGER IF EXISTS competency_score_snapshots_append_only ON competency_score_snapshots;
CREATE TRIGGER competency_score_snapshots_append_only
BEFORE UPDATE OR DELETE ON competency_score_snapshots
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();