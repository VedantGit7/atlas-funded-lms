import { describe, expect, it } from "vitest";
import {
  createRequestId,
  getOrCreateRequestId,
  isSafeRequestId,
  stripClientSuppliedRequestIds,
} from "@atlas/core/request/request-id";

describe("request id", () => {
  it("creates req_ prefixed UUID ids", () => {
    const id = createRequestId();
    expect(isSafeRequestId(id)).toBe(true);
  });

  it("rejects spoofed client ids when stripped", () => {
    const headers = new Headers({
      "x-request-id": "client-spoofed",
    });
    stripClientSuppliedRequestIds(headers);
    const id = getOrCreateRequestId(headers);
    expect(isSafeRequestId(id)).toBe(true);
    expect(id).not.toBe("client-spoofed");
  });

  it("preserves middleware-generated ids", () => {
    const generated = createRequestId();
    const headers = new Headers({ "x-request-id": generated });
    expect(getOrCreateRequestId(headers)).toBe(generated);
  });
});
