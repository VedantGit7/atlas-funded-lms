// Downloads a database backup from R2, for a restore or a restore drill
// (docs/runbooks/coolify-deployment.md, "Backups and restore drills"). It ships
// in the atlas-migrate image and needs only a read-only key.
//
//   node scripts/db/fetch-backup.mjs <output directory>
//
// R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY name the
// bucket and the key. Without BACKUP_KEY it takes the newest `.gz` object under
// BACKUP_PREFIX: Coolify writes an all-databases backup as gzipped pg_dumpall
// output. It saves `backup.sql.gz` and prints the object's key, size, time and
// SHA-256 as JSON.
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// The storage package owns the S3 client; resolve it from there.
const { GetObjectCommand, ListObjectsV2Command, S3Client } = createRequire(
  join(repoRoot, "backend", "packages", "storage", "package.json"),
)("@aws-sdk/client-s3");

const output = process.argv[2];
const env = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
if (!output) throw new Error("usage: fetch-backup.mjs <output directory>");

const bucket = env("R2_BUCKET");
const client = new S3Client({
  region: "auto",
  endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  },
});

async function newestBackup() {
  let newest;
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: process.env["BACKUP_PREFIX"]?.trim() || undefined,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? [])
      if (object.Key?.endsWith(".gz") && (!newest || object.LastModified > newest.LastModified))
        newest = object;
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  if (!newest) throw new Error(`No .gz backup in ${bucket}`);
  return newest.Key;
}

const key = process.env["BACKUP_KEY"]?.trim() || (await newestBackup());
const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
const digest = createHash("sha256");
const file = join(output, "backup.sql.gz");
let bytes = 0;
await pipeline(
  object.Body,
  async function* (chunks) {
    for await (const chunk of chunks) {
      digest.update(chunk);
      bytes += chunk.length;
      yield chunk;
    }
  },
  createWriteStream(file, { mode: 0o644 }),
);
if (bytes !== object.ContentLength) throw new Error(`Incomplete download of ${key}`);
process.stdout.write(
  `${JSON.stringify({ key, bytes, lastModified: object.LastModified, sha256: digest.digest("hex") })}\n`,
);
