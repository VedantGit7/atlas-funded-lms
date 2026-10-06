/**
 * Sanitizes SVG uploads stored before audit M8.
 *
 *   DIRECT_DATABASE_URL=... <storage env> pnpm data:sanitize-svg-assets
 *   ... pnpm data:sanitize-svg-assets -- --apply
 *
 * Uploads are now sanitized when they are confirmed, but an SVG confirmed
 * earlier (a lesson thumbnail) was stored as uploaded, and public-safe objects
 * can be fetched straight from the bucket. This rewrites each stored SVG with
 * its sanitized form and a download disposition, and records the new size and
 * checksum.
 *
 * Dry run by default. `--apply` makes the changes; `--tenant <id>`
 * (repeatable) limits the run, to try one tenant first. Safe to re-run. It
 * needs the database owner login with BYPASSRLS (DIRECT_DATABASE_URL) and the
 * API's storage settings. See `scripts/data/svg-asset-backfill.ts` for what it
 * guarantees, and docs/runbooks/uploaded-files.md for when to run it.
 *
 * Exit codes: 0 when nothing needs sanitizing or review, 1 when something
 * does, 2 when it refused to run.
 */
import { createStorageProvider } from "../../backend/packages/storage/src/providers/storage-provider-factory";
import { parseStorageEnv } from "../../backend/packages/storage/src/schemas/storage-env";
import { tenantArgs } from "./backfill-connection";
import { backfillStoredSvgAssets } from "./svg-asset-backfill";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const tenantIds = tenantArgs(args);
  const report = await backfillStoredSvgAssets({
    databaseUrl: process.env["DIRECT_DATABASE_URL"],
    apply: args.includes("--apply"),
    provider: createStorageProvider(parseStorageEnv(process.env)),
    tenantIds,
  });

  const list = (ids: string[]) => (ids.length > 0 ? `: ${ids.join(", ")}` : "");
  console.log(
    `Database: ${report.database}` +
      (tenantIds.length > 0 ? ` (tenants ${tenantIds.join(", ")})` : " (all tenants)"),
  );
  console.log(
    `${String(report.scanned)} stored SVG reference(s); ${String(report.alreadySafe)} already safe; ` +
      `${String(report.toSanitize.length)} to sanitize${list(report.toSanitize)}; ` +
      `${String(report.toCorrect.length)} with a stale size/checksum record${list(report.toCorrect)}.`,
  );
  if (report.deletedGone > 0) {
    console.log(`${String(report.deletedGone)} deleted reference(s) whose object is already gone.`);
  }
  if (report.apply) {
    console.log(
      `Sanitized ${String(report.sanitized)}; corrected ${String(report.corrected)} record(s).`,
    );
    if (report.changedMeanwhile.length > 0) {
      console.log(`Changed meanwhile, left alone (re-run)${list(report.changedMeanwhile)}`);
    }
    if (report.failed.length > 0) console.log(`Failed, unchanged${list(report.failed)}`);
  } else if (report.remaining > 0) {
    console.log("Dry run. Re-run with --apply to sanitize them.");
  }
  if (report.missing.length > 0) {
    console.log(`Needs review, READY but the object is missing${list(report.missing)}`);
  }
  if (report.unreadable.length > 0) {
    console.log(`Needs review, not a readable SVG${list(report.unreadable)}`);
  }

  const clean =
    report.remaining === 0 &&
    report.changedMeanwhile.length === 0 &&
    report.failed.length === 0 &&
    report.missing.length === 0 &&
    report.unreadable.length === 0;
  return clean ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  });
