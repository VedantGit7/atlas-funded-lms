-- PostgreSQL settings for each environment's Coolify database
-- (docs/runbooks/coolify-deployment.md, "Database resources and settings").
--
-- coolify-limits: cpus=4 memory=6GB
--
-- Sized for the database's Coolify resource limits above: set those first,
-- because shared_buffers alone would not fit Coolify's default of 2 GB under
-- load. Run as the postgres superuser against the postgres database, then
-- restart the database once. ALTER SYSTEM writes postgresql.auto.conf in the
-- data volume, so the settings survive restarts and redeploys.
-- tests/unit/api/postgresql-settings.test.ts checks they fit the limits and the
-- pools in deploy/coolify/compose.yaml.

-- Every process's pools in compose.yaml together, plus a migration job, an
-- operator's psql and the superuser slots. PostgreSQL's default is 100.
ALTER SYSTEM SET max_connections = 200;

-- A quarter of the memory limit. The default, 128 MB, held a quarter of a
-- 525 MB database in the November staging load test.
ALTER SYSTEM SET shared_buffers = '1536MB';

-- The planner's estimate of shared_buffers plus the operating system's cache.
ALTER SYSTEM SET effective_cache_size = '4GB';

-- Per sort or hash, so a report query does not spill to disk. Even with every
-- connection using it at once (200 x 8 MB), it fits beside shared_buffers.
ALTER SYSTEM SET work_mem = '8MB';

-- Vacuum and index builds.
ALTER SYSTEM SET maintenance_work_mem = '256MB';

-- The server's disks are NVMe SSDs: random reads cost about the same as
-- sequential ones.
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Per-statement timings (calls, total and mean time, rows, buffer hits), so a
-- load test can see which statements cost the database most. Statistics only:
-- no parameter values. The view is created in the postgres database, outside
-- the application's schema, and reads statements from every database.
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_io_timing = on;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
