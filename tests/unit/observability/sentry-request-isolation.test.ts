import type * as OtelModule from "../../../backend/apps/api/node_modules/@opentelemetry/api";
import type * as SentryModule from "../../../backend/apps/api/node_modules/@sentry/nextjs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

/**
 * With tracing off, the server Sentry config skips Sentry's OpenTelemetry
 * tracer (it cost 13-19% of busy time in the staging burst profile) but must
 * keep each request's scope separate. These run the real SDK through the API's
 * config. Events are recorded by a global event processor and dropped before
 * the transport, so nothing leaves the process.
 */
let sentry: typeof SentryModule;
let otel: typeof OtelModule;
const events: { message: string | undefined; tags: Record<string, unknown> | undefined }[] = [];

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
  vi.stubEnv("SENTRY_DSN", "https://public@sentry.example.test/1");
  vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "");
  await import("../../../backend/apps/api/sentry.server.config");
  sentry = await import("../../../backend/apps/api/node_modules/@sentry/nextjs");
  otel = await import("../../../backend/apps/api/node_modules/@opentelemetry/api");
  sentry.getGlobalScope().addEventProcessor((event) => {
    events.push({ message: event.exception?.values?.[0]?.value, tags: event.tags });
    return null;
  });
});
afterAll(async () => {
  await sentry.close(1000);
  vi.unstubAllEnvs();
});

it("registers no tracer, so Next.js's spans are OpenTelemetry no-ops", () => {
  const span = otel.trace.getTracer("next.js").startSpan("BaseServer.handleRequest");
  expect(span.isRecording()).toBe(false);
  expect(otel.isSpanContextValid(span.spanContext())).toBe(false);
  span.end();
});

it("keeps two concurrent requests' scopes apart", async () => {
  const request = (name: string, waitMs: number) =>
    sentry.withIsolationScope(async () => {
      sentry.setTag("request", name);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      sentry.captureException(new Error(`failed in ${name}`));
    });
  // "a" sets its tag first and reports last, after "b" has set its own.
  await Promise.all([request("a", 40), request("b", 10)]);
  await sentry.flush(1000);

  expect(events).toHaveLength(2);
  for (const event of events)
    expect(event.message).toBe(`failed in ${String(event.tags?.["request"])}`);
});
