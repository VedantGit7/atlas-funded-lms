"use client";

import { ClientApiError, type ApiErrorBody } from "./errors";
import { toast } from "../feedback/toast";
import { createUuid } from "../create-uuid";
import { requestMfaStepUp } from "./mfa-step-up";

export type ClientApiMutationOptions = {
  /** Full toast message override */
  successMessage?: string | undefined;
  /** Skip success toast for background or multi-step mutations */
  silent?: boolean | undefined;
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
  allowStepUp = true,
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
      return request<T>(path, init, false, allowStepUp);
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
    // A sensitive action needs this session to complete MFA (audit H4). Once
    // the user steps up, repeat the same request, with the same idempotency
    // key: the server refused it before doing any work.
    if (
      allowStepUp &&
      response.status === 403 &&
      envelope.error?.code === "MFA_REQUIRED" &&
      (await requestMfaStepUp(envelope.error.message ?? ""))
    ) {
      return request<T>(path, init, allowRefreshRetry, false);
    }
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
  // Optional unused label kept for call-site ergonomics / future logging
  get: <T>(path: string, _label?: string) => {
    void _label;
    return request<T>(path, {
      method: "GET",
    });
  },

  put: async <T>(
    path: string,
    body: object,
    idempotencyKeyPrefix: string = "mutation",
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
    idempotencyKeyPrefix: string = "mutation",
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
    idempotencyKeyPrefix: string = "mutation",
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
    idempotencyKeyPrefix: string = "mutation",
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
