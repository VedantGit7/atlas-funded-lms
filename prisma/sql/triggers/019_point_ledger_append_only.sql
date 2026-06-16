DROP TRIGGER IF EXISTS point_ledger_append_only ON point_ledger;
CREATE TRIGGER point_ledger_append_only
BEFORE UPDATE OR DELETE ON point_ledger
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();