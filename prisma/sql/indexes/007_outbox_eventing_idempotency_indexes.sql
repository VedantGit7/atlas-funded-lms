CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_tenant_idempotency_key_uq
ON outbox_events (tenant_id, idempotency_key)
WHERE tenant_id IS NOT NULL
  AND idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_global_idempotency_key_uq
ON outbox_events (idempotency_key)
WHERE tenant_id IS NULL
  AND idempotency_key IS NOT NULL;