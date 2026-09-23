import type { ApprovedPostHogEvent } from "./taxonomy";
import {
  assertNoForbiddenPostHogProperties,
  isApprovedPostHogEvent,
  sanitizePostHogProperties,
} from "./taxonomy";
import { readDeploymentEnvironment, readReleaseIdentifier } from "../release";

type PostHogServerClient = {
  capture(args: {
    uuid?: string;
    distinctId: string;
    event: string;
    properties?: Record<string, string | number | boolean>;
  }): void;
  shutdown(): Promise<void>;
};

let cachedClient: PostHogServerClient | null | undefined;

function getPostHogServerClient(): PostHogServerClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = process.env["POSTHOG_SERVER_KEY"]?.trim();
  if (!apiKey) {
    cachedClient = null;
    return cachedClient;
  }

  const host = process.env["POSTHOG_SERVER_HOST"]?.trim() || "https://eu.i.posthog.com";

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog } = require("posthog-node") as {
      PostHog: new (
        key: string,
        options: { host: string; requestTimeout: number; fetchRetryCount: number },
      ) => PostHogServerClient;
    };
    cachedClient = new PostHog(apiKey, { host, requestTimeout: 20_000, fetchRetryCount: 0 });
  } catch {
    cachedClient = null;
  }

  return cachedClient;
}

export function captureServerPostHogEvent(args: {
  uuid?: string;
  event: ApprovedPostHogEvent;
  distinctId: string;
  properties?: Record<string, unknown>;
}): void {
  const eventName: string = args.event;
  if (!isApprovedPostHogEvent(eventName)) {
    throw new Error(`Unapproved PostHog event: ${eventName}`);
  }

  const properties = {
    ...(args.properties ?? {}),
    environment: readDeploymentEnvironment(),
    release: readReleaseIdentifier(),
  };

  assertNoForbiddenPostHogProperties(properties);

  const client = getPostHogServerClient();
  if (!client) {
    return;
  }

  client.capture({
    ...(args.uuid ? { uuid: args.uuid } : {}),
    distinctId: args.distinctId,
    event: args.event,
    properties: sanitizePostHogProperties(properties),
  });
}

export async function shutdownPostHogServerClient(): Promise<void> {
  if (cachedClient) {
    await cachedClient.shutdown();
    cachedClient = null;
  }
}

/** The SDK swallows capture errors, so durable jobs use the acknowledged HTTP API. */
export async function captureServerPostHogEventImmediate(
  args: Parameters<typeof captureServerPostHogEvent>[0],
  send: typeof fetch = fetch,
): Promise<void> {
  if (!isApprovedPostHogEvent(args.event)) throw new Error("POSTHOG_EVENT_NOT_APPROVED");
  const properties = {
    ...(args.properties ?? {}),
    environment: readDeploymentEnvironment(),
    release: readReleaseIdentifier(),
  };
  assertNoForbiddenPostHogProperties(properties);
  const apiKey = process.env["POSTHOG_SERVER_KEY"]?.trim();
  if (!apiKey) throw new Error("POSTHOG_CLIENT_UNAVAILABLE");
  const url = new URL(
    "/i/v0/e/",
    process.env["POSTHOG_SERVER_HOST"]?.trim() || "https://eu.i.posthog.com",
  );
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("POSTHOG_HOST_INVALID");
  const response = await send(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      ...(args.uuid ? { uuid: args.uuid } : {}),
      distinct_id: args.distinctId,
      event: args.event,
      properties: sanitizePostHogProperties(properties),
    }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("POSTHOG_DELIVERY_REJECTED");
  }
  const acknowledgment = (await response.json()) as { status?: unknown; quota_limited?: unknown };
  if (
    acknowledgment.status !== 1 ||
    (Array.isArray(acknowledgment.quota_limited) && acknowledgment.quota_limited.length > 0)
  )
    throw new Error("POSTHOG_DELIVERY_NOT_ACCEPTED");
}
