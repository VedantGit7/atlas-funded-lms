DROP TRIGGER IF EXISTS attempt_answers_append_only ON attempt_answers;
CREATE TRIGGER attempt_answers_append_only
BEFORE UPDATE OR DELETE ON attempt_answers
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();