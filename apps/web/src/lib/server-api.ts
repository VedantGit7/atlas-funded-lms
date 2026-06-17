import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ServerApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, status: number, requestId: string, message: string) {
    super(message);
    this.name = "ServerApiError";
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

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const origin = await getRequestOrigin();
  const cookie = await getCookieHeader();
  const requestHeaders = new Headers(init?.headers);

  requestHeaders.set("cookie", cookie);

  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    const envelope = body as ApiErrorBody;
    throw new ServerApiError(
      envelope.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      envelope.error?.requestId ?? randomUUID(),
      envelope.error?.message ?? "Request failed.",
    );
  }

  return body as T;
}

export const serverApi = {
  get: <T>(path: string) => request<T>(path),
};
