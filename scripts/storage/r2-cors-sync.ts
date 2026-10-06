import {
  matchingUploadRule,
  planUploadCors,
  probeUploadPreflight,
  type BucketCors,
  type CorsRule,
  type PreflightResult,
} from "../../backend/packages/storage/src/r2-cors";

export type { BucketCors };

/**
 * The work behind `pnpm storage:r2-cors` (audit M8): read the bucket's CORS
 * rules, replace the upload rule if it is missing or wrong, then prove the
 * result the way a browser would, with a preflight to a presigned upload URL.
 * The bucket access and the network are injected, so it can be tested without
 * R2; `scripts/storage/r2-cors.ts` wires the real ones.
 */

export type R2CorsReport = {
  bucket: string;
  apply: boolean;
  before: CorsRule[];
  /** Origins whose uploads the rules allowed before the run. */
  allowedBefore: Record<string, boolean>;
  changed: boolean;
  written: boolean;
  /** Existing non-upload rules kept as they are. */
  kept: CorsRule[];
  /** Live preflights after the run (a dry run probes the current rules). */
  preflights: PreflightResult[];
  /** True when every probed origin can upload. */
  ok: boolean;
};

export async function syncR2UploadCors(input: {
  bucket: string;
  apply: boolean;
  cors: BucketCors;
  /** A presigned upload URL; only its preflight is sent, nothing is uploaded. */
  probeUrl: () => Promise<string>;
  origins: readonly string[];
  fetchImpl?: typeof fetch;
  /** Wait between writing the rules and probing them (R2 applies them shortly after). */
  settleMs?: number;
  /** Probe attempts after a write, while the new rules propagate. */
  attempts?: number;
}): Promise<R2CorsReport> {
  const before = await input.cors.get();
  const plan = planUploadCors(before);
  const allowedBefore = Object.fromEntries(
    input.origins.map((origin) => [origin, matchingUploadRule(before, origin) !== null]),
  );

  let written = false;
  if (input.apply && plan.changed) {
    await input.cors.put(plan.rules);
    written = true;
  }

  const url = await input.probeUrl();
  const probeAll = () =>
    Promise.all(
      input.origins.map((origin) =>
        probeUploadPreflight({
          url,
          origin,
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      ),
    );

  let preflights = await probeAll();
  const attempts = written ? (input.attempts ?? 6) : 1;
  for (let attempt = 1; attempt < attempts && !preflights.every((p) => p.ok); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, input.settleMs ?? 5000));
    preflights = await probeAll();
  }

  return {
    bucket: input.bucket,
    apply: input.apply,
    before,
    allowedBefore,
    changed: plan.changed,
    written,
    kept: plan.kept,
    preflights,
    ok: preflights.every((preflight) => preflight.ok),
  };
}
