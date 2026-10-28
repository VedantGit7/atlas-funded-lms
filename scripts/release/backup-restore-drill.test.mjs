import assert from "node:assert/strict";
import test from "node:test";
import { backupDrillConfiguration, unexpectedRestoreErrors } from "./backup-restore-drill.mjs";

const image = `ghcr.io/vedantgit7/atlas-migrate:${"a".repeat(40)}`;
const valid = {
  BACKUP_DRILL_ENV: "staging",
  BACKUP_DRILL_MIGRATE_IMAGE: image,
  BACKUP_DRILL_DOCKER_HOST: "ssh://root@203.0.113.10",
  BACKUP_DRILL_QUIESCED: "1",
  R2_ACCOUNT_ID: "account",
  R2_BUCKET: "atlas-staging-backups",
  R2_ACCESS_KEY_ID: "read-only-key",
  R2_SECRET_ACCESS_KEY: "read-only-secret",
};

test("accepts a complete configuration and defaults the database", () => {
  const config = backupDrillConfiguration(valid);
  assert.equal(config.environment, "staging");
  assert.equal(config.sourceDb, "atlas_lms");
  assert.equal(config.image, image);
  assert.match(config.runId, /^[a-f0-9]{32}$/);
});

test("refuses to run unless the source is confirmed quiet since the backup", () => {
  assert.throws(
    () => backupDrillConfiguration({ ...valid, BACKUP_DRILL_QUIESCED: undefined }),
    /BACKUP_DRILL_QUIESCED=1/,
  );
});

test("requires a SHA-tagged migration image, an SSH Docker host and every R2 setting", () => {
  for (const tag of ["latest", "main", "a".repeat(39)])
    assert.throws(
      () =>
        backupDrillConfiguration({
          ...valid,
          BACKUP_DRILL_MIGRATE_IMAGE: `ghcr.io/vedantgit7/atlas-migrate:${tag}`,
        }),
      /tagged with a SHA/,
    );
  assert.throws(
    () => backupDrillConfiguration({ ...valid, BACKUP_DRILL_DOCKER_HOST: "tcp://0.0.0.0:2375" }),
    /ssh:\/\//,
  );
  for (const name of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"])
    assert.throws(() => backupDrillConfiguration({ ...valid, [name]: " " }), new RegExp(name));
});

test("tolerates only the postgres role a fresh cluster already has", () => {
  const stderr = [
    'ERROR:  role "postgres" already exists',
    "NOTICE:  something harmless",
    'psql:<stdin>:42: ERROR:  relation "tenants" already exists',
    "ERROR:  permission denied for schema app",
  ].join("\n");
  assert.deepEqual(unexpectedRestoreErrors(stderr), [
    'psql:<stdin>:42: ERROR:  relation "tenants" already exists',
    "ERROR:  permission denied for schema app",
  ]);
  assert.deepEqual(unexpectedRestoreErrors('ERROR:  role "postgres" already exists\n'), []);
});
