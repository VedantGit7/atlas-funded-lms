import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const DIAGNOSTIC_SESSION_COOKIE = "atlas_diagnostic_session";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type DiagnosticSessionProof = {
  secret: string;
  secretHash: string;
  expiresAt: string;
};

export function generateSessionProof(now = Date.now()): DiagnosticSessionProof {
  const secret = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();

  return {
    secret,
    secretHash: hashSessionSecret(secret),
    expiresAt,
  };
}

export function hashSessionSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifySessionSecret(secret: string, expectedHash: string): boolean {
  const actual = hashSessionSecret(secret);
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function encodeDiagnosticSessionCookieValue(args: {
  anonymousId: string;
  secret: string;
}): string {
  return `${args.anonymousId}.${args.secret}`;
}

export function parseDiagnosticSessionCookieValue(
  value: string | null | undefined,
): { anonymousId: string; secret: string } | null {
  if (!value) return null;

  const separatorIndex = value.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
    return null;
  }

  const anonymousId = value.slice(0, separatorIndex);
  const secret = value.slice(separatorIndex + 1);

  if (!anonymousId || !secret) {
    return null;
  }

  return { anonymousId, secret };
}

export function readDiagnosticSessionCookie(req: NextRequest): {
  anonymousId: string;
  secret: string;
} | null {
  return parseDiagnosticSessionCookieValue(req.cookies.get(DIAGNOSTIC_SESSION_COOKIE)?.value);
}

export function setDiagnosticSessionCookie(args: {
  response: NextResponse;
  anonymousId: string;
  secret: string;
  expiresAt: string;
}): void {
  args.response.cookies.set(DIAGNOSTIC_SESSION_COOKIE, encodeDiagnosticSessionCookieValue(args), {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(args.expiresAt),
  });
}

export function isSessionProofExpired(
  expiresAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now;
}

export type StoredSessionProofJson = {
  secretHash: string;
  expiresAt: string;
  mergedAt?: string;
  mergedAttemptId?: string;
  mergedMembershipId?: string;
};

export function parseStoredSessionProof(mergeJson: unknown): StoredSessionProofJson | null {
  if (!mergeJson || typeof mergeJson !== "object" || Array.isArray(mergeJson)) {
    return null;
  }

  const record = mergeJson as Record<string, unknown>;
  if (typeof record["secretHash"] !== "string" || typeof record["expiresAt"] !== "string") {
    return null;
  }

  return {
    secretHash: record["secretHash"],
    expiresAt: record["expiresAt"],
    ...(typeof record["mergedAt"] === "string" ? { mergedAt: record["mergedAt"] } : {}),
    ...(typeof record["mergedAttemptId"] === "string"
      ? { mergedAttemptId: record["mergedAttemptId"] }
      : {}),
    ...(typeof record["mergedMembershipId"] === "string"
      ? { mergedMembershipId: record["mergedMembershipId"] }
      : {}),
  };
}
