-- Follow-up grants for custom field value history (idempotent with migration 090).
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_field_value_history TO atlas_app, atlas_worker, atlas_platform;
