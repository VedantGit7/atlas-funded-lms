-- Importing questions from an Excel template (item import, PR 3 of 4).
--
-- An import batch records one upload: the question type, the file's name, how
-- many rows it had and what became of them. The browser reads the file and
-- sends its rows in chunks (the web proxy takes at most 4 MB per request), so
-- a batch is opened first, filled chunk by chunk, then completed. A batch left
-- "importing" was abandoned part way; its questions are still Drafts and can
-- be found, and undone (PR 4), through the batch.
--
-- Each imported question remembers its batch and the spreadsheet row it came
-- from. The unique index on (batch, row) makes a re-sent chunk harmless: a row
-- is imported once, whatever happens to the request carrying it.
--
-- "Your reference" is the admin's own id for a question, used to spot the
-- same question being imported twice.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.item_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_type_key text NOT NULL CHECK (length(item_type_key) BETWEEN 1 AND 80),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  template_version text NOT NULL CHECK (length(template_version) BETWEEN 1 AND 20),
  status text NOT NULL DEFAULT 'importing'
    CHECK (status IN ('importing', 'completed', 'undone')),
  -- Counted by the browser from the whole file when the batch is opened.
  rows_in_file integer NOT NULL CHECK (rows_in_file BETWEEN 1 AND 5000),
  rows_with_errors integer NOT NULL CHECK (rows_with_errors BETWEEN 0 AND 5000),
  rows_to_import integer NOT NULL CHECK (rows_to_import BETWEEN 0 AND 5000),
  -- Counted by the server as chunks arrive.
  imported_count integer NOT NULL DEFAULT 0 CHECK (imported_count BETWEEN 0 AND 5000),
  duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count BETWEEN 0 AND 5000),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count BETWEEN 0 AND 5000),
  skip_duplicates boolean NOT NULL,
  extra_tags text[] NOT NULL DEFAULT '{}',
  created_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  undone_at timestamptz,
  undone_by_membership_id uuid,
  CONSTRAINT item_import_batches_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT item_import_batches_created_by_membership_id_tenant_fkey
    FOREIGN KEY (tenant_id, created_by_membership_id) REFERENCES public.memberships(tenant_id, id),
  CONSTRAINT item_import_batches_undone_by_membership_id_tenant_fkey
    FOREIGN KEY (tenant_id, undone_by_membership_id) REFERENCES public.memberships(tenant_id, id),
  CONSTRAINT item_import_batches_rows_check
    CHECK (rows_with_errors + rows_to_import <= rows_in_file),
  CONSTRAINT item_import_batches_outcome_check
    CHECK (imported_count + duplicate_count + rejected_count <= rows_to_import),
  CONSTRAINT item_import_batches_extra_tags_check CHECK (cardinality(extra_tags) <= 20)
);

CREATE INDEX item_import_batches_history_idx
  ON public.item_import_batches (tenant_id, created_at DESC);

ALTER TABLE public.item_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_import_batches FORCE ROW LEVEL SECURITY;

CREATE POLICY item_import_batches_tenant_isolation ON public.item_import_batches
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY item_import_batches_platform_scope ON public.item_import_batches
  FOR SELECT TO atlas_platform USING (true);
-- A batch is history: it is completed or undone, never deleted.
GRANT SELECT, INSERT, UPDATE ON public.item_import_batches TO atlas_app;
GRANT SELECT ON public.item_import_batches TO atlas_worker, atlas_platform;

COMMENT ON TABLE public.item_import_batches IS
  'One upload of questions from an Excel template: its type, file, row counts and status (importing, completed, undone).';

ALTER TABLE public.items
  ADD COLUMN import_batch_id uuid,
  ADD COLUMN import_row_number integer,
  ADD COLUMN import_reference text,
  ADD CONSTRAINT items_import_batch_id_tenant_fkey
    FOREIGN KEY (tenant_id, import_batch_id) REFERENCES public.item_import_batches(tenant_id, id),
  ADD CONSTRAINT items_import_row_check
    CHECK ((import_batch_id IS NULL) = (import_row_number IS NULL)),
  ADD CONSTRAINT items_import_row_number_check
    CHECK (import_row_number IS NULL OR import_row_number BETWEEN 2 AND 5001),
  ADD CONSTRAINT items_import_reference_check
    CHECK (import_reference IS NULL OR length(import_reference) BETWEEN 1 AND 120);

CREATE UNIQUE INDEX items_import_batch_row_key
  ON public.items (tenant_id, import_batch_id, import_row_number)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX items_import_reference_idx
  ON public.items (tenant_id, import_reference)
  WHERE import_reference IS NOT NULL AND deleted_at IS NULL;

-- Finding a question already in the bank: same type, same wording once case
-- and runs of spaces are ignored. Hashed, because a question can be longer
-- than a B-tree entry may be. The import queries this exact expression.
CREATE INDEX items_stem_fingerprint_idx
  ON public.items (
    tenant_id,
    item_type_key,
    md5(lower(regexp_replace(btrim(stem_json ->> 'stem'), '\s+', ' ', 'g')))
  )
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.items.import_batch_id IS
  'The import batch that created this question, if it was imported from a spreadsheet.';
COMMENT ON COLUMN public.items.import_row_number IS
  'The spreadsheet row the question came from (2 is the first question row).';
COMMENT ON COLUMN public.items.import_reference IS
  'The admin''s own reference for the question, from the template''s "Your reference" column.';

COMMIT;
