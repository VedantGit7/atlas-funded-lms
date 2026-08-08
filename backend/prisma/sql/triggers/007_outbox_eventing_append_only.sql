DROP TRIGGER IF EXISTS outbox_events_append_only ON outbox_events;
CREATE TRIGGER outbox_events_append_only
BEFORE UPDATE OR DELETE ON outbox_events
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

DROP TRIGGER IF EXISTS event_deliveries_append_only ON event_deliveries;
CREATE TRIGGER event_deliveries_append_only
BEFORE UPDATE OR DELETE ON event_deliveries
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

DROP TRIGGER IF EXISTS dead_letter_events_append_only ON dead_letter_events;
CREATE TRIGGER dead_letter_events_append_only
BEFORE UPDATE OR DELETE ON dead_letter_events
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();