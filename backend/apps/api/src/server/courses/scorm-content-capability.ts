import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";
import {
  parseScormContentSigningKeys,
  SCORM_CONTENT_SIGNING_KEYS_ENV,
  type ScormContentSigningKey,
} from "@atlas/core/config/scorm-content-keys";

/**
 * SCORM package-read capability.
 *
 * Package files are served into an opaque sandboxed iframe (never
 * `allow-same-origin`), so the browser sends no session cookie with the
 * package's own requests for its scripts, styles and media. The launch instead
 * mints this capability and puts it in the URL *path*, so a package's relative
 * references (`scripts/app.js`) resolve beneath it and carry it automatically.
 *
 * It is deliberately narrow: one tenant, one membership, one module, one stored
 * content version. It is not a session: every request re-checks membership,
 * permission, enrollment and publication (see scorm-content.service.ts), so
 * revoking any of those takes effect on the next file. Expiry bounds what a
 * leaked URL is worth; a lesson open longer than this must be reopened.
 *
 * Wire format: `<kid>.<base64url payload>.<base64url HMAC-SHA256>`, with the
 * MAC over `<kid>.<payload>` so a signature cannot be replayed under another key.
 */
export const SCORM_CAPABILITY_TTL_SECONDS = 6 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LENGTH = 1_024;

const payloadSchema = z
  .object({
    v: z.literal(1),
    tid: z.uuid(),
    mbr: z.uuid(),
    mod: z.uuid(),
    // Null for packages stored before content versioning.
    cv: z.uuid().nullable(),
    ver: z.enum(["1.2", "2004"]),
    // Launch session id: binds the runtime bridge's messages to this launch.
    sid: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
    exp: z.number().int().positive(),
  })
  .strict();

export type ScormContentCapability = {
  tenantId: string;
  membershipId: string;
  moduleId: string;
  contentVersion: string | null;
  scormVersion: "1.2" | "2004";
  launchId: string;
  expiresAt: number;
};

const devKeyGlobal = globalThis as typeof globalThis & {
  __atlasScormDevSigningKey?: ScormContentSigningKey;
};

function signingKeys(env: NodeJS.ProcessEnv = process.env): ScormContentSigningKey[] {
  const raw = env[SCORM_CONTENT_SIGNING_KEYS_ENV]?.trim() ?? "";
  if (raw) return parseScormContentSigningKeys(raw);
  if (isDeployedRuntime(env)) {
    // Deployment validation reports this at startup; fail closed if it is reached anyway.
    throw new Error(`${SCORM_CONTENT_SIGNING_KEYS_ENV} is required in deployed runtimes`);
  }
  // Local development only: one random key per process. It lives on globalThis
  // because the dev server can load this module once per route bundle, and the
  // launch route and the content route must agree.
  devKeyGlobal.__atlasScormDevSigningKey ??= {
    kid: "dev",
    secret: randomBytes(32).toString("base64url"),
  };
  return [devKeyGlobal.__atlasScormDevSigningKey];
}

function mac(key: ScormContentSigningKey, signedPart: string): Buffer {
  return createHmac("sha256", key.secret).update(signedPart).digest();
}

export function newScormLaunchId(): string {
  return randomBytes(18).toString("base64url");
}

export function mintScormContentCapability(
  capability: Omit<ScormContentCapability, "expiresAt" | "launchId"> & { launchId?: string },
  options: { nowMs?: number; env?: NodeJS.ProcessEnv } = {},
): { token: string; launchId: string; expiresAt: number } {
  const [key] = signingKeys(options.env);
  if (!key) throw new Error("No SCORM content signing key is configured");
  const launchId = capability.launchId ?? newScormLaunchId();
  const expiresAt = Math.floor((options.nowMs ?? Date.now()) / 1000) + SCORM_CAPABILITY_TTL_SECONDS;
  const payload = payloadSchema.parse({
    v: 1,
    tid: capability.tenantId,
    mbr: capability.membershipId,
    mod: capability.moduleId,
    cv: capability.contentVersion,
    ver: capability.scormVersion,
    sid: launchId,
    exp: expiresAt,
  });
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signedPart = `${key.kid}.${encoded}`;
  return {
    token: `${signedPart}.${mac(key, signedPart).toString("base64url")}`,
    launchId,
    expiresAt,
  };
}

/** Returns null for anything malformed, forged, expired or signed by an unknown key. */
export function verifyScormContentCapability(
  token: string,
  options: { nowMs?: number; env?: NodeJS.ProcessEnv } = {},
): ScormContentCapability | null {
  if (token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [kid, encoded, signature] = parts as [string, string, string];
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;

  const key = signingKeys(options.env).find((candidate) => candidate.kid === kid);
  if (!key) return null;
  const expected = mac(key, `${kid}.${encoded}`);
  const presented = Buffer.from(signature, "base64url");
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) return null;
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (parsed.data.exp + CLOCK_SKEW_SECONDS <= nowSeconds) return null;

  return {
    tenantId: parsed.data.tid,
    membershipId: parsed.data.mbr,
    moduleId: parsed.data.mod,
    contentVersion: parsed.data.cv,
    scormVersion: parsed.data.ver,
    launchId: parsed.data.sid,
    expiresAt: parsed.data.exp,
  };
}
