COMMENT ON TABLE outbox_events IS
'PARTITION_CANDIDATE: monthly by available_at/occurred_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE audit_entries IS
'PARTITION_CANDIDATE: monthly by occurred_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE practice_responses IS
'PARTITION_CANDIDATE: monthly by occurred_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE competency_signals IS
'PARTITION_CANDIDATE: monthly by occurred_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE competency_score_snapshots IS
'PARTITION_CANDIDATE: monthly by occurred_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE point_ledger IS
'PARTITION_CANDIDATE: monthly by occurred_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE credential_verifications IS
'PARTITION_CANDIDATE: monthly by occurred_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE notification_dispatches IS
'PARTITION_CANDIDATE: monthly by created_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE automation_runs IS
'PARTITION_CANDIDATE: monthly by occurred_at. Convert only through approved expand/contract migration.';

COMMENT ON TABLE workflow_transitions IS
'PARTITION_CANDIDATE: monthly by occurred_at. Convert only through approved expand/contract migration.';

DO $$
DECLARE
  candidate text;
  candidates text[] := ARRAY[
    'outbox_events',
    'audit_entries',
    'practice_responses',
    'competency_signals',
    'competency_score_snapshots',
    'point_ledger',
    'credential_verifications',
    'notification_dispatches',
    'automation_runs',
    'workflow_transitions'
  ];
BEGIN
  FOREACH candidate IN ARRAY candidates
  LOOP
    IF to_regclass('public.' || quote_ident(candidate)) IS NULL THEN
      RAISE NOTICE 'Partition candidate table missing, skipped: %', candidate;
      CONTINUE;
    END IF;

    RAISE NOTICE 'Partition policy recorded for %. Do not convert in-place without expand/contract migration.', candidate;
  END LOOP;
END $$;