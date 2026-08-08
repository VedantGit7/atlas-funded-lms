export const REQUEST_ID_HEADER = "x-request-id";

export function createRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

export function isSafeRequestId(value: string): boolean {
  return /^req_[a-f0-9-]{36}$/i.test(value);
}

type HeaderLike = Headers | { get(name: string): string | null };

export function getOrCreateRequestId(headers: HeaderLike): string {
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
