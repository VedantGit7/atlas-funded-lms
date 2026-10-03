import { it, expect, vi, afterEach } from "vitest";
import { captureServerPostHogEventImmediate } from "@atlas/observability/posthog/server";
const event = {
  uuid: "11111111-1111-4111-8111-111111111111",
  event: "lesson_completed" as const,
  distinctId: "tenant-safe",
};
afterEach(() => vi.unstubAllEnvs());
it("does not finish until provider delivery resolves and uses the original UUID", async () => {
  vi.stubEnv("POSTHOG_SERVER_KEY", "test-project-token");
  let accept: (response: Response) => void = () => {};
  const receipt = new Promise<Response>((resolve) => {
    accept = resolve;
  });
  const send = vi.fn<typeof fetch>(() => receipt);
  let completed = false;
  const pending = captureServerPostHogEventImmediate(event, send).then(() => {
    completed = true;
  });
  await Promise.resolve();
  expect(completed).toBe(false);
  accept(Response.json({ status: 1 }));
  await pending;
  const request = send.mock.calls[0]?.[1];
  expect(JSON.parse(String(request?.body))).toMatchObject({
    uuid: event.uuid,
    distinct_id: event.distinctId,
  });
  expect(request).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
  expect(completed).toBe(true);
});
it("propagates transport failures and missing configuration for durable retry", async () => {
  vi.stubEnv("POSTHOG_SERVER_KEY", "test-project-token");
  await expect(
    captureServerPostHogEventImmediate(event, vi.fn().mockRejectedValue(new Error("unavailable"))),
  ).rejects.toThrow("unavailable");
  vi.stubEnv("POSTHOG_SERVER_KEY", "");
  const send = vi.fn<typeof fetch>();
  await expect(captureServerPostHogEventImmediate(event, send)).rejects.toThrow(
    "POSTHOG_CLIENT_UNAVAILABLE",
  );
  expect(send).not.toHaveBeenCalled();
});
it.each([
  Response.json({}, { status: 503 }),
  Response.json({ status: 0 }),
  Response.json({ status: 1, quota_limited: ["events"] }),
])("does not acknowledge rejected or quota-dropped events", async (response) => {
  vi.stubEnv("POSTHOG_SERVER_KEY", "test-project-token");
  await expect(
    captureServerPostHogEventImmediate(event, vi.fn().mockResolvedValue(response)),
  ).rejects.toThrow(/POSTHOG_DELIVERY/);
});
