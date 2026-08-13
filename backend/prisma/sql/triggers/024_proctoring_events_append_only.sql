DROP TRIGGER IF EXISTS proctoring_events_append_only ON proctoring_events;
CREATE TRIGGER proctoring_events_append_only
BEFORE UPDATE OR DELETE ON proctoring_events
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();
