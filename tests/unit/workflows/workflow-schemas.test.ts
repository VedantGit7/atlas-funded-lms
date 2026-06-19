import { describe, expect, it } from "vitest";
import {
  workflowListQuerySchema,
  workflowTransitionBodySchema,
} from "../../../apps/web/src/server/workflows/workflow-schemas";

describe("WorkflowListQuerySchema", () => {
  it("defaults status to pending", () => {
    expect(workflowListQuerySchema.parse({}).status).toBe("pending");
  });

  it("rejects unsupported targetType values", () => {
    expect(() => workflowListQuerySchema.parse({ targetType: "assessment" })).toThrow();
  });

  it("caps limit at 100", () => {
    expect(() => workflowListQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it("accepts cursor", () => {
    expect(workflowListQuerySchema.parse({ cursor: "abc123" }).cursor).toBe("abc123");
  });
});

describe("WorkflowTransitionBodySchema", () => {
  it("accepts approve without comment", () => {
    expect(workflowTransitionBodySchema.parse({ action: "approve" }).action).toBe("approve");
  });

  it("accepts approve with comment", () => {
    expect(
      workflowTransitionBodySchema.parse({ action: "approve", comment: "Looks good" }).comment,
    ).toBe("Looks good");
  });

  it("rejects reject without comment", () => {
    expect(() => workflowTransitionBodySchema.parse({ action: "reject" })).toThrow();
  });

  it("rejects return without comment", () => {
    expect(() => workflowTransitionBodySchema.parse({ action: "return" })).toThrow();
  });

  it("rejects invalid action", () => {
    expect(() => workflowTransitionBodySchema.parse({ action: "publish" })).toThrow();
  });

  it("enforces max comment length", () => {
    expect(() =>
      workflowTransitionBodySchema.parse({
        action: "reject",
        comment: "x".repeat(2001),
      }),
    ).toThrow();
  });
});
