import { cookies, headers } from "next/headers";
import type { AcceptInvitationApiResponse } from "../api/public-client";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ServerPublicApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, status: number, requestId: string, message: string) {
    super(message);
    this.name = "ServerPublicApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function postJson<T>(path: string, body: object, idempotencyPrefix: string): Promise<T> {
  const origin = await getRequestOrigin();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      "idempotency-key": `${idempotencyPrefix}-${crypto.randomUUID()}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const envelope = payload as ApiErrorBody;
    throw new ServerPublicApiError(
      envelope.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      envelope.error?.requestId ?? crypto.randomUUID(),
      envelope.error?.message ?? "Request failed.",
    );
  }

  return payload as T;
}

export const serverPublicApi = {
  acceptInvitation: (body: { token: string }) =>
    postJson<AcceptInvitationApiResponse>(
      "/api/v1/public/invitations/accept",
      body,
      "public-invitation-accept",
    ),
};
