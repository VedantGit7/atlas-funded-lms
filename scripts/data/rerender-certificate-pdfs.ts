/**
 * Re-renders certificate PDFs stored at the wrong page size (every design was
 * printed on portrait A4 before the page-size fix).
 *
 *   DIRECT_DATABASE_URL=... <storage env> pnpm data:rerender-certificate-pdfs
 *   ... pnpm data:rerender-certificate-pdfs -- --apply --tenant <tenant-id>
 *   ... pnpm data:rerender-certificate-pdfs -- --apply
 *
 * Rendering needs Chromium, so `--apply` runs where the PDF worker does, in
 * the managed-node worker image, which carries this script bundled
 * (deploy/managed-node/build-worker.mjs):
 *
 *   node rerender-certificate-pdfs.mjs --apply
 *
 * Dry run by default: it reads each stored PDF and reports which ones need a
 * re-render. `--apply` re-renders and replaces them; `--tenant <id>`
 * (repeatable) limits the run, to try one tenant first. Safe to re-run: a PDF
 * already at its design's size is left alone. It needs the database owner
 * login with BYPASSRLS (DIRECT_DATABASE_URL) and the API's storage settings.
 * See `scripts/data/certificate-pdf-backfill.ts` for what it guarantees.
 *
 * Exit codes: 0 when nothing needs a re-render or review, 1 when something
 * does, 2 when it refused to run.
 */
import { createStorageProvider } from "../../backend/packages/storage/src/providers/storage-provider-factory";
import { parseStorageEnv } from "../../backend/packages/storage/src/schemas/storage-env";
import { tenantArgs } from "./backfill-connection";
import { backfillCertificatePdfs } from "./certificate-pdf-backfill";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const tenantIds = tenantArgs(args);
  const storageEnv = parseStorageEnv(process.env);
  const report = await backfillCertificatePdfs({
    databaseUrl: process.env["DIRECT_DATABASE_URL"],
    apply: args.includes("--apply"),
    provider: createStorageProvider(storageEnv),
    bucket: storageEnv.R2_BUCKET_NAME,
    tenantIds,
  });

  const list = (ids: string[]) => (ids.length > 0 ? `: ${ids.join(", ")}` : "");
  console.log(
    `Database: ${report.database}` +
      (tenantIds.length > 0 ? ` (tenants ${tenantIds.join(", ")})` : " (all tenants)"),
  );
  console.log(
    `${String(report.scanned)} certificate(s) with a stored PDF; ${String(report.sizeOk)} already the right size; ` +
      `${String(report.wrongSize.length)} at the wrong size${list(report.wrongSize)}.`,
  );
  if (report.missing.length > 0) {
    console.log(`PDF object missing, will be re-rendered${list(report.missing)}`);
  }
  if (report.unreadable.length > 0) {
    console.log(
      `Stored PDF has no readable page size, will be re-rendered${list(report.unreadable)}`,
    );
  }
  if (report.apply) {
    console.log(`Re-rendered ${String(report.rerendered)}.`);
    if (report.failed.length > 0) console.log(`Failed, stored PDF unchanged${list(report.failed)}`);
  } else if (report.remaining > 0) {
    console.log("Dry run. Re-run with --apply (in the worker image) to re-render them.");
  }
  if (report.unexpectedKey.length > 0) {
    console.log(`Needs review, stored under an unexpected key${list(report.unexpectedKey)}`);
  }
  if (report.unparseable.length > 0) {
    console.log(`Needs review, no valid design to render${list(report.unparseable)}`);
  }

  const clean =
    report.remaining === 0 &&
    report.failed.length === 0 &&
    report.unexpectedKey.length === 0 &&
    report.unparseable.length === 0;
  return clean ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  });
