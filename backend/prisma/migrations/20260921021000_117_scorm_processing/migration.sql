-- Publication switches to a complete generation only after the durable worker succeeds.
-- NULL preserves the content prefix used by packages published before F22.
ALTER TABLE course_modules ADD COLUMN scorm_content_version uuid;
