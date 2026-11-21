-- Repair article lessons whose text was wrapped in {"body": …} (QA review 1
-- C5, review 2 C1).
--
-- Both lesson editors loaded an article as {"body": "text"}, showed it as JSON
-- and saved that JSON back as the body, wrapping it once more on every save:
-- {"body": "{\"body\": \"text\"}"}. Learners saw the code. The editors and the
-- API are fixed in the same release (lesson-player-content.ts unwrapBodyText);
-- this undoes the damage already stored.
--
-- A layer is peeled only when the body is a JSON object made entirely of
-- content_json keys, the same rule as unwrapBodyText, so an article whose text
-- really is a JSON sample keeps it. A layer with no text body inside (the JSON
-- of a quiz id or a file reference, saved by the same bug) is not article text,
-- so the body is removed. Safe to run more than once.
--
-- lessons forces row-level security and the owner has no policy, so on a
-- deployed database the update runs in the platform scope, as migration 130
-- does. On a fresh database there are no lessons yet and it updates nothing.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  known_keys text[] := ARRAY[
    'body', 'type', 'lessonType', 'description', 'isPreview', 'features',
    'displayInSyllabus', 'thumbnailAssetReferenceId', 'primaryAssetReferenceId',
    'primaryAssetFileName', 'transcriptText', 'transcriptAssetReferenceId', 'live',
    'assessmentId', 'discussionPostId', 'videoProvider', 'videoUrl'
  ];
  lesson record;
  body text;
  parsed jsonb;
  depth integer;
  changed boolean;
  only_known boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_platform')
    AND has_table_privilege('atlas_platform', 'public.lessons', 'SELECT')
    AND has_table_privilege('atlas_platform', 'public.lessons', 'UPDATE')
  THEN
    SET LOCAL ROLE atlas_platform;
    PERFORM set_config('app.platform_scope', 'true', true);
  END IF;

  FOR lesson IN
    SELECT l.id, l.content_json ->> 'body' AS body
      FROM public.lessons l
     WHERE l.content_json ? 'body'
       AND jsonb_typeof(l.content_json -> 'body') = 'string'
       AND btrim(l.content_json ->> 'body') LIKE '{%}'
  LOOP
    body := lesson.body;
    changed := false;

    FOR depth IN 1..20 LOOP
      BEGIN
        parsed := btrim(body)::jsonb;
      EXCEPTION WHEN others THEN
        EXIT; -- not JSON: real text
      END;
      EXIT WHEN parsed IS NULL OR jsonb_typeof(parsed) <> 'object';

      SELECT coalesce(bool_and(key = ANY (known_keys)), false)
        INTO only_known
        FROM jsonb_object_keys(parsed) AS key;
      EXIT WHEN NOT only_known; -- JSON of something else: real text

      changed := true;
      IF jsonb_typeof(parsed -> 'body') = 'string' THEN
        body := parsed ->> 'body';
      ELSE
        body := NULL; -- leaked lesson content with no text inside
        EXIT;
      END IF;
    END LOOP;

    IF changed THEN
      IF body IS NULL OR btrim(body) = '' THEN
        UPDATE public.lessons
           SET content_json = content_json - 'body', updated_at = now()
         WHERE id = lesson.id;
      ELSE
        UPDATE public.lessons
           SET content_json = jsonb_set(content_json, '{body}', to_jsonb(body)),
               updated_at = now()
         WHERE id = lesson.id;
      END IF;
    END IF;
  END LOOP;
END
$$;

RESET ROLE;
COMMIT;
