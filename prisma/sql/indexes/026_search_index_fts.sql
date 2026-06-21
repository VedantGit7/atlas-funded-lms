-- Atlas LMS Migration 026 — tenant search index full-text and trigram indexes.
-- Strategy: combined tsvector GIN (primary ranking) + pg_trgm GIN (typo tolerance).
-- Query path must use these indexes; no unindexed whole-table ILIKE fallback.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS search_index_entries_tenant_fts_idx
ON search_index_entries
USING GIN (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
);

CREATE INDEX IF NOT EXISTS search_index_entries_tenant_trgm_idx
ON search_index_entries
USING GIN ((coalesce(title, '') || ' ' || coalesce(body, '')) gin_trgm_ops);
