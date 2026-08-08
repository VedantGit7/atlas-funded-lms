-- Post-migration 036: tags and lesson_tags need explicit grants for atlas_app.
GRANT SELECT, INSERT, UPDATE, DELETE ON tags, lesson_tags TO atlas_app, atlas_worker, atlas_platform;
