// Names only a developer's machine or a private network resolves. A tenant's
// custom domain is a real public name that it proves it controls.
const NON_PUBLIC_SUFFIXES = [
  ".localhost",
  ".test",
  ".local",
  ".internal",
  ".invalid",
  ".example",
  ".lan",
  ".home.arpa",
];

/**
 * A custom domain as stored: lowercase, without a trailing dot, or null when
 * it is not a public DNS name (two or more labels, an alphabetic top-level
 * label, no scheme, path, port or IP address).
 */
export function normalizePublicHostname(raw: string): string | null {
  const hostname = raw.trim().toLowerCase().replace(/\.$/, "");
  const labels = hostname.split(".");
  const valid =
    hostname.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    /^[a-z]{2,63}$/.test(labels[labels.length - 1] ?? "") &&
    !NON_PUBLIC_SUFFIXES.some((suffix) => `.${hostname}`.endsWith(suffix));
  return valid ? hostname : null;
}
