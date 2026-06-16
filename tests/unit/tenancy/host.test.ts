import { describe, expect, it } from "vitest";
import { normalizeHost } from "@atlas/tenancy";

describe("normalizeHost", () => {
  it("normalizes lowercase host without port", () => {
    expect(normalizeHost("Academy.Tenant-A.Com:443")).toBe("academy.tenant-a.com");
  });

  it("rejects missing host", () => {
    expect(() => normalizeHost(null)).toThrow("Tenant not found");
  });

  it("rejects unsafe host values", () => {
    expect(() => normalizeHost("example.com/path")).toThrow("Tenant not found");
  });

  it("does not silently default localhost to a tenant", () => {
    expect(() => normalizeHost("localhost:3000")).toThrow("Tenant not found");
  });
});
