export const REQUEST_ID_HEADER = "x-request-id";

/** @deprecated Use REQUEST_ID_HEADER. Kept for transitional imports. */
export const LEGACY_REQUEST_ID_HEADER = "x-atlas-request-id";

export function createRequestId(): string {
  const id = crypto.randomUUID();
  return `req_${id}`;
}

export function getOrCreateRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER) ?? headers.get("x-atlas-request-id");

  if (existing && isSafeRequestId(existing)) {
    return existing;
  }

  return createRequestId();
}

export function stripClientSuppliedRequestIds(headers: Headers): void {
  headers.delete(REQUEST_ID_HEADER);
  headers.delete("x-atlas-request-id");
}

export function isSafeRequestId(value: string): boolean {
  return /^req_[a-f0-9-]{36}$/i.test(value);
}
