import type { ApprovedPostHogEvent } from "./taxonomy";
import {
  assertNoForbiddenPostHogProperties,
  isApprovedPostHogEvent,
  sanitizePostHogProperties,
} from "./taxonomy";
import { readDeploymentEnvironment, readReleaseIdentifier } from "../release";

type PostHogServerClient = {
  capture(args: {
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

  const host = process.env["POSTHOG_SERVER_HOST"]?.trim() || "https://us.i.posthog.com";

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog } = require("posthog-node") as {
      PostHog: new (key: string, options: { host: string }) => PostHogServerClient;
    };
    cachedClient = new PostHog(apiKey, { host });
  } catch {
    cachedClient = null;
  }

  return cachedClient;
}

export function captureServerPostHogEvent(args: {
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
