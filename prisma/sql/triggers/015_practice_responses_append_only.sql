DROP TRIGGER IF EXISTS practice_responses_append_only ON practice_responses;
CREATE TRIGGER practice_responses_append_only
BEFORE UPDATE OR DELETE ON practice_responses
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();