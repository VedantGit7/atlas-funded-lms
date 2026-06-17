export const REQUEST_ID_HEADER = "x-atlas-request-id";

export function createRequestId(): string {
  const id = crypto.randomUUID();
  return `req_${id}`;
}

export function getOrCreateRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER);

  if (existing && isSafeRequestId(existing)) {
    return existing;
  }

  return createRequestId();
}

export function isSafeRequestId(value: string): boolean {
  return /^req_[a-f0-9-]{36}$/i.test(value);
}
