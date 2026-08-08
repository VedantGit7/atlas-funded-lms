-- Post-migration 038: course_tags needs explicit grants for atlas_app.

GRANT SELECT, INSERT, UPDATE, DELETE ON course_tags TO atlas_app, atlas_worker, atlas_platform;

