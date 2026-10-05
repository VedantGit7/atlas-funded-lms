-- Audit finding M7 — mutations without audit.
--
-- Route metadata declared `audit: "required"`, but nothing checked that a
-- request so declared wrote an audit entry. It was a promise, not a control.
--
-- Every insert into audit_entries now marks its transaction. The tenant route
-- wrapper reads the mark after a mutating handler runs: when an
-- `audit: "required"` route wrote nothing, the wrapper records the mutation
-- itself, so the request is never untraceable.
--
-- A statement trigger on the table rather than a flag in application code,
-- because entries are written by more than one path (the audit package, the
-- membership audit repository, SQL functions). The setting is transaction-local
-- and, like any GUC change, reverts when a savepoint that set it rolls back, so
-- an entry that did not commit does not count.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION app.mark_audit_written()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('atlas.audit_written', 'on', true);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_entries_mark_written ON public.audit_entries;
CREATE TRIGGER audit_entries_mark_written
AFTER INSERT ON public.audit_entries
FOR EACH STATEMENT EXECUTE FUNCTION app.mark_audit_written();

COMMIT;
