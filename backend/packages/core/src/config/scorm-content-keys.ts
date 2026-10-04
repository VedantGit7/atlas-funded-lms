/**
 * Signing keys for SCORM package-read capabilities.
 *
 * Package files load inside an opaque sandboxed iframe, where the browser sends
 * no session cookie with the package's own requests. Each launch therefore
 * carries a short-lived signed capability in its URL path; these keys sign it.
 *
 * Format: `SCORM_CONTENT_SIGNING_KEYS="<kid>:<secret>[,<kid>:<secret>...]"`.
 * The first key signs new capabilities; every listed key verifies. To rotate,
 * prepend a new key, wait out the capability lifetime, then drop the old one.
 */
export const SCORM_CONTENT_SIGNING_KEYS_ENV = "SCORM_CONTENT_SIGNING_KEYS";

export type ScormContentSigningKey = { kid: string; secret: string };

const MAX_KEYS = 4;
const MIN_SECRET_LENGTH = 32;

export class ScormContentSigningKeysError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScormContentSigningKeysError";
  }
}

/** Throws a value-redacted error; never echoes key material. */
export function parseScormContentSigningKeys(raw: string): ScormContentSigningKey[] {
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    throw new ScormContentSigningKeysError(`${SCORM_CONTENT_SIGNING_KEYS_ENV} lists no keys`);
  }
  if (entries.length > MAX_KEYS) {
    throw new ScormContentSigningKeysError(
      `${SCORM_CONTENT_SIGNING_KEYS_ENV} lists more than ${String(MAX_KEYS)} keys`,
    );
  }
  const keys = entries.map((entry) => {
    const separator = entry.indexOf(":");
    const kid = separator > 0 ? entry.slice(0, separator) : "";
    const secret = separator > 0 ? entry.slice(separator + 1) : "";
    if (!/^[A-Za-z0-9_-]{1,16}$/.test(kid)) {
      throw new ScormContentSigningKeysError(
        `${SCORM_CONTENT_SIGNING_KEYS_ENV} entries must be <kid>:<secret> with a 1-16 character [A-Za-z0-9_-] kid`,
      );
    }
    if (secret.length < MIN_SECRET_LENGTH || /^(.)\1+$/.test(secret)) {
      throw new ScormContentSigningKeysError(
        `${SCORM_CONTENT_SIGNING_KEYS_ENV} secrets must be at least ${String(MIN_SECRET_LENGTH)} nontrivial characters`,
      );
    }
    return { kid, secret };
  });
  if (new Set(keys.map((key) => key.kid)).size !== keys.length) {
    throw new ScormContentSigningKeysError(`${SCORM_CONTENT_SIGNING_KEYS_ENV} kids must be unique`);
  }
  if (new Set(keys.map((key) => key.secret)).size !== keys.length) {
    throw new ScormContentSigningKeysError(
      `${SCORM_CONTENT_SIGNING_KEYS_ENV} secrets must be unique`,
    );
  }
  return keys;
}
