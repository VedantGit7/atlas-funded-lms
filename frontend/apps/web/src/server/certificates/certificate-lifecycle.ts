// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createHash } from "node:crypto";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function hashCertificateDesignSnapshot(snapshot: unknown): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function readSnapshotValidityDays(snapshot: unknown): number | undefined {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return undefined;
  const record = snapshot as Record<string, unknown>;
  const metadata =
    record["metadata"] &&
    typeof record["metadata"] === "object" &&
    !Array.isArray(record["metadata"])
      ? (record["metadata"] as Record<string, unknown>)
      : null;
  const value = record["validityDays"] ?? metadata?.["validityDays"];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function resolveCertificateExpiry(args: {
  issuedAt?: Date;
  expiresAt?: string;
  validityDays?: number;
}): Date | null {
  if (args.expiresAt) return new Date(args.expiresAt);
  if (args.validityDays == null) return null;
  return new Date((args.issuedAt ?? new Date()).getTime() + args.validityDays * DAY_IN_MS);
}
