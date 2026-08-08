"use client";

import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import { toast } from "../../lib/feedback/toast";
import type { ClientApiMutationOptions } from "../../lib/api/client";
import { createUuid } from "../../lib/create-uuid";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class PlatformApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, status: number, requestId: string, message: string) {
    super(message);
    this.name = "PlatformApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${createUuid()}`;
}

async function request<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string; reason?: string; body?: BodyInit | null },
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.idempotencyKey) {
    headers.set("idempotency-key", init.idempotencyKey);
  }

  if (init.reason) {
    headers.set(ATLAS_PLATFORM_REASON_HEADER, init.reason);
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
    throw new PlatformApiError(
      envelope.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      envelope.error?.requestId ?? createUuid(),
      envelope.error?.message ?? "Request failed.",
    );
  }

  return body as T;
}

function notifyMutationSuccess(
  method: "POST" | "PUT",
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

export const platformApi = {
  get: <T>(path: string, reason: string) =>
    request<T>(path, {
      method: "GET",
      reason,
    }),

  post: async <T>(
    path: string,
    body: object | null,
    reason: string,
    idempotencyKeyPrefix: string,
    options?: ClientApiMutationOptions,
  ) => {
    const result = await request<T>(path, {
      method: "POST",
      body: body == null ? null : JSON.stringify(body),
      reason,
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    });
    notifyMutationSuccess("POST", idempotencyKeyPrefix, options);
    return result;
  },

  put: async <T>(
    path: string,
    body: object,
    reason: string,
    idempotencyKeyPrefix: string,
    options?: ClientApiMutationOptions,
  ) => {
    const result = await request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      reason,
      idempotencyKey: createIdempotencyKey(idempotencyKeyPrefix),
    });
    notifyMutationSuccess("PUT", idempotencyKeyPrefix, options);
    return result;
  },
};
