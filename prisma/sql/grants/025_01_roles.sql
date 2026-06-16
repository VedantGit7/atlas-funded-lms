DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    CREATE ROLE atlas_app NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_worker') THEN
    CREATE ROLE atlas_worker NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_platform') THEN
    CREATE ROLE atlas_platform NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO atlas_app, atlas_worker, atlas_platform;
GRANT USAGE ON SCHEMA app TO atlas_app, atlas_worker, atlas_platform;