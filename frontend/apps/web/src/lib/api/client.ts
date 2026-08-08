"use client";

import { ClientApiError, type ApiErrorBody } from "./errors";
import { toast } from "../feedback/toast";
import { createUuid } from "../create-uuid";

export type ClientApiMutationOptions = {
  /** Full toast message override */
  successMessage?: string;
  /** Skip success toast for background or multi-step mutations */
  silent?: boolean;
};

function randomUuid(): string {
  return createUuid();
}

/** Works on non-secure origins such as `*.localhost.test` where `crypto.randomUUID` is unavailable. */
export function createClientUuid(): string {
  return createUuid();
}

function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${createUuid()}`;
}

async function request<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string; body?: BodyInit | null },
  allowRefreshRetry = true,
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

  if (response.status === 401 && allowRefreshRetry) {
    const refreshResponse = await fetch("/api/v1/public/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });

    if (refreshResponse.ok) {
      return request<T>(path, init, false);
    }
  }

  const rawBody = await response.text();
  let body: unknown;

  try {
    body = rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    throw new ClientApiError(
      "INVALID_RESPONSE",
      response.status,
      randomUuid(),
      response.status >= 500
        ? "The server returned an unexpected error. Check the API logs for details."
        : "Request failed.",
    );
  }

  if (!response.ok) {
    const envelope = body as ApiErrorBody;
    throw new ClientApiError(
      envelope.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      envelope.error?.requestId ?? randomUuid(),
      envelope.error?.message ?? "Request failed.",
    );
  }

  return body as T;
}

function notifyMutationSuccess(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  idempotencyKeyPrefix: string,
  options?: ClientApiMutationOptions,
) {
  toast.mutationSuccess({
    idempotencyKeyPrefix,
    method,
    ...(options?.successMessage ? { message: options.successMessage } : {}),
    ...(options?.silent ? { silent: true } : {}),
  });
}

export const clientApi = {
  get: <T>(path: string) =>
    request<T>(path, {
      method: "GET",
    }),

  put: async <T>(
    path: string,
    body: object,
    idempotencyKeyPrefix: string,
    options?: ClientApiMutationOptions,
  ) => {
    const result = await request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    });
    notifyMutationSuccess("PUT", idempotencyKeyPrefix, options);
    return result;
  },

  patch: async <T>(
    path: string,
    body: object,
    idempotencyKeyPrefix: string,
    options?: ClientApiMutationOptions,
  ) => {
    const result = await request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    });
    notifyMutationSuccess("PATCH", idempotencyKeyPrefix, options);
    return result;
  },

  post: async <T>(
    path: string,
    body: object | null,
    idempotencyKeyPrefix: string,
    options?: ClientApiMutationOptions,
  ) => {
    const result = await request<T>(path, {
      method: "POST",
      body: body == null ? null : JSON.stringify(body),
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    });
    notifyMutationSuccess("POST", idempotencyKeyPrefix, options);
    return result;
  },

  postWithKey: async <T>(
    path: string,
    body: object | null,
    idempotencyKey: string,
    options?: ClientApiMutationOptions,
  ) => {
    const result = await request<T>(path, {
      method: "POST",
      body: body == null ? null : JSON.stringify(body),
      idempotencyKey,
    });
    notifyMutationSuccess("POST", idempotencyKey, options);
    return result;
  },

  delete: async <T>(
    path: string,
    idempotencyKeyPrefix: string,
    body?: object,
    options?: ClientApiMutationOptions,
  ) => {
    const result = await request<T>(path, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : null,
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    });
    notifyMutationSuccess("DELETE", idempotencyKeyPrefix, options);
    return result;
  },
};
