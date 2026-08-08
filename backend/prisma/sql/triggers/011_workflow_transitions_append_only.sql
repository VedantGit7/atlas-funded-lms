DROP TRIGGER IF EXISTS workflow_transitions_append_only ON workflow_transitions;
CREATE TRIGGER workflow_transitions_append_only
BEFORE UPDATE OR DELETE ON workflow_transitions
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();