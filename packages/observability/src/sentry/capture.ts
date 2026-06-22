import type { SafeSentryTags } from "./tags";
import { toSafeSentryTagRecord } from "./tags";

type SentryLike = {
  setTags(tags: Record<string, string>): void;
  setContext(name: string, context: Record<string, unknown>): void;
  captureException(error: unknown): void;
};

function getSentry(): SentryLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require("@sentry/nextjs") as SentryLike;
    return sentry;
  } catch {
    return null;
  }
}

export function applySafeSentryTags(tags: SafeSentryTags): void {
  const sentry = getSentry();
  if (!sentry) {
    return;
  }

  sentry.setTags(toSafeSentryTagRecord(tags));
}

export function captureUnexpectedError(error: unknown, tags: SafeSentryTags): void {
  const sentry = getSentry();
  if (!sentry) {
    return;
  }

  sentry.setTags(toSafeSentryTagRecord(tags));
  sentry.captureException(error);
}

export function captureUnexpectedMessage(message: string, tags: SafeSentryTags): void {
  const sentry = getSentry();
  if (!sentry) {
    return;
  }

  sentry.setTags(toSafeSentryTagRecord(tags));
  sentry.setContext("safe_message", { message });
  sentry.captureException(new Error(message));
}
