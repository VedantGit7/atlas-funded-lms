DROP TRIGGER IF EXISTS notification_dispatches_append_only ON notification_dispatches;
CREATE TRIGGER notification_dispatches_append_only
BEFORE UPDATE OR DELETE ON notification_dispatches
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();