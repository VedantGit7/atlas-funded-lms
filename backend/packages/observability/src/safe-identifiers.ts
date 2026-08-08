import { createHmac } from "node:crypto";

export type SafeIdentifierKind = "tenant" | "actor";

function readHashSalt(): string | null {
  const salt = process.env["OBSERVABILITY_HASH_SALT"]?.trim();
  return salt && salt.length > 0 ? salt : null;
}

export function requireObservabilityHashSalt(): string {
  const salt = readHashSalt();

  if (!salt) {
    throw new Error("OBSERVABILITY_HASH_SALT is required for safe identifier hashing.");
  }

  return salt;
}

export function hashSafeIdentifier(kind: SafeIdentifierKind, rawId: string): string {
  const salt = requireObservabilityHashSalt();
  const digest = createHmac("sha256", salt).update(`${kind}:${rawId}`).digest("hex");
  return `${kind}_${digest.slice(0, 32)}`;
}

export function tenantSafeId(tenantId: string | null | undefined): string | undefined {
  if (!tenantId) {
    return undefined;
  }

  return hashSafeIdentifier("tenant", tenantId);
}

export function actorSafeId(actorId: string | null | undefined): string | undefined {
  if (!actorId) {
    return undefined;
  }

  return hashSafeIdentifier("actor", actorId);
}
