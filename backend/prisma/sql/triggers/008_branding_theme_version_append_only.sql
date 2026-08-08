DROP TRIGGER IF EXISTS tenant_branding_version_append_only ON tenant_branding_version;
CREATE TRIGGER tenant_branding_version_append_only
BEFORE UPDATE OR DELETE ON tenant_branding_version
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();

DROP TRIGGER IF EXISTS tenant_theme_version_append_only ON tenant_theme_version;
CREATE TRIGGER tenant_theme_version_append_only
BEFORE UPDATE OR DELETE ON tenant_theme_version
FOR EACH ROW EXECUTE FUNCTION app.reject_update_delete();