import type { TenantTx } from "@atlas/db";
import type * as StorageModule from "@atlas/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultRetentionTasks,
  runOutboxSweep,
} from "../../../backend/apps/api/src/worker/outbox-sweep";

const boundary = vi.hoisted(() => ({
  query: vi.fn(),
  execute: vi.fn(),
  deleteObject: vi.fn(),
  committed: false,
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: async (_ctx: unknown, run: (tx: TenantTx) => Promise<unknown>) => {
    const result = await run({
      $queryRaw: boundary.query,
      $executeRaw: boundary.execute,
    } as unknown as TenantTx);
    boundary.committed = true;
    return result;
  },
}));
vi.mock("@atlas/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof StorageModule>()),
  getStorageProvider: () => ({ deleteObject: boundary.deleteObject }),
  parseStorageEnv: () => ({ R2_BUCKET_NAME: "test" }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  boundary.committed = false;
});

function mediaTask() {
  const task = defaultRetentionTasks().find((task) => task.name === "proctoring-media-purge");
  if (!task) throw new Error("Missing proctoring retention task");
  return task;
}

describe("proctoring retention failure reporting", () => {
  it("reports a failed object deletion while retaining its row and continuing other tasks", async () => {
    boundary.query.mockResolvedValue([{ id: "failed", r2_object_key: "failed-object" }]);
    boundary.deleteObject.mockRejectedValue(new Error("storage unavailable"));
    const followingTask = vi.fn().mockResolvedValue(0);

    const result = await runOutboxSweep({
      batchLimit: 25,
      maxRetries: 3,
      processors: [],
      listTenantIds: async () => ["tenant"],
      retentionTasks: [mediaTask(), { name: "following-task", run: followingTask }],
    });

    expect(result.errors).toEqual([
      {
        processor: "proctoring-media-purge",
        tenantId: "tenant",
        message: "1 proctoring media deletion(s) failed; references retained for retry.",
      },
    ]);
    expect(boundary.execute).not.toHaveBeenCalled();
    expect(followingTask).toHaveBeenCalledOnce();
    expect(result.proctoringMediaPurged).toBe(0);
  });

  it("commits successful deletions before reporting partial failure and retries retained rows", async () => {
    boundary.query.mockResolvedValueOnce([
      { id: "successful", r2_object_key: "successful-object" },
      { id: "failed", r2_object_key: "failed-object" },
    ]);
    boundary.deleteObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("retry"));
    boundary.execute.mockResolvedValue(1);

    await expect(mediaTask().run({ tenantId: "tenant", requestId: "first" })).rejects.toThrow(
      "1 proctoring media deletion(s) failed; references retained for retry.",
    );
    expect(boundary.committed).toBe(true);
    expect(boundary.execute.mock.calls[0]?.[1]).toEqual(["successful"]);

    boundary.query.mockResolvedValueOnce([{ id: "failed", r2_object_key: "failed-object" }]);
    boundary.deleteObject.mockResolvedValueOnce(undefined);
    await expect(mediaTask().run({ tenantId: "tenant", requestId: "retry" })).resolves.toBe(1);
    expect(boundary.execute.mock.calls[1]?.[1]).toEqual(["failed"]);
  });
});
