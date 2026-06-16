DROP TRIGGER IF EXISTS moderation_decisions_append_only ON moderation_decisions;
CREATE TRIGGER moderation_decisions_append_only
BEFORE UPDATE OR DELETE ON moderation_decisions
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();