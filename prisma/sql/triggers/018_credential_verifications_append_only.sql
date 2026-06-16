DROP TRIGGER IF EXISTS credential_verifications_append_only ON credential_verifications;
CREATE TRIGGER credential_verifications_append_only
BEFORE UPDATE OR DELETE ON credential_verifications
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();