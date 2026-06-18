"use client";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ClientApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, status: number, requestId: string, message: string) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function request<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string; body?: BodyInit | null },
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.idempotencyKey) {
    headers.set("idempotency-key", init.idempotencyKey);
  }

  if (init.body) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    const envelope = body as ApiErrorBody;
    throw new ClientApiError(
      envelope.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      envelope.error?.requestId ?? crypto.randomUUID(),
      envelope.error?.message ?? "Request failed.",
    );
  }

  return body as T;
}

export const clientApi = {
  get: <T>(path: string) =>
    request<T>(path, {
      method: "GET",
    }),

  put: <T>(path: string, body: object, idempotencyKeyPrefix: string) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    }),

  post: <T>(path: string, body: object | null, idempotencyKeyPrefix: string) =>
    request<T>(path, {
      method: "POST",
      body: body == null ? null : JSON.stringify(body),
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    }),

  delete: <T>(path: string, idempotencyKeyPrefix: string) =>
    request<T>(path, {
      method: "DELETE",
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    }),
};
