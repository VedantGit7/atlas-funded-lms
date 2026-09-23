import { expect, it, vi } from "vitest";
import { createScormHandler } from "../../../backend/apps/api/src/server/courses/scorm-worker-router";
const event = {
  id: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  eventType: "course.module.scorm_processing_requested",
  requestId: "request",
  idempotencyKey: "key",
  attempt: 1,
  payload: {
    moduleId: "00000000-0000-4000-8000-000000000003",
    assetReferenceId: "00000000-0000-4000-8000-000000000004",
  },
};
it("does not download a superseded package", async () => {
  const publish = vi.fn(),
    complete = vi.fn();
  const handler = createScormHandler({ load: vi.fn().mockResolvedValue(null), publish, complete });
  await handler.handle(event);
  expect(publish).not.toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
});
it("publishes outside load/complete transactions and fences readiness by event attempt and asset", async () => {
  const phases: string[] = [];
  const complete = vi.fn(async () => {
    phases.push("complete");
  });
  const handler = createScormHandler({
    load: vi.fn(async () => {
      phases.push("load");
      return { bucket: "bucket", object_key: "key", size_bytes: 10 };
    }),
    publish: vi.fn(async () => {
      phases.push("publish");
      return { launchPath: "index.html", scormVersion: "1.2" as const };
    }),
    complete,
  });
  await handler.handle(event);
  expect(phases).toEqual(["load", "publish", "complete"]);
  expect(complete).toHaveBeenCalledWith(
    expect.objectContaining({
      eventId: event.id,
      attempt: 1,
      assetReferenceId: event.payload.assetReferenceId,
      launchPath: "index.html",
    }),
  );
});
it("does not mark a failed extraction ready", async () => {
  const complete = vi.fn();
  const handler = createScormHandler({
    load: vi.fn().mockResolvedValue({ bucket: "b", object_key: "k", size_bytes: 10 }),
    publish: vi.fn().mockRejectedValue(new Error("SCORM_ENTRY_TOO_LARGE")),
    complete,
  });
  await expect(handler.handle(event)).rejects.toMatchObject({ kind: "permanent" });
  expect(complete).not.toHaveBeenCalled();
});
