import { describe, expect, it } from "vitest";
import {
  clearClientDataCache,
  getActiveTenantScope,
  setActiveTenantScope,
  tenantQueryKey,
  writeClientDataCache,
  readClientDataCache,
} from "../../../apps/web/src/lib/query/client-data-cache";

describe("tenant query keys", () => {
  it("scopes keys by tenant host scope", () => {
    const tenantA = tenantQueryKey("tenant-a.example", ["courses"]);
    const tenantB = tenantQueryKey("tenant-b.example", ["courses"]);
    expect(tenantA).not.toEqual(tenantB);
  });

  it("clears cache on host change and logout", () => {
    setActiveTenantScope("tenant-a.example");
    writeClientDataCache(tenantQueryKey("tenant-a.example", ["profile"]), { name: "A" });
    expect(readClientDataCache(tenantQueryKey("tenant-a.example", ["profile"]))).toEqual({
      name: "A",
    });

    setActiveTenantScope("tenant-b.example");
    expect(getActiveTenantScope()).toBe("tenant-b.example");
    expect(readClientDataCache(tenantQueryKey("tenant-a.example", ["profile"]))).toBeUndefined();

    writeClientDataCache(tenantQueryKey("tenant-b.example", ["profile"]), { name: "B" });
    clearClientDataCache("logout");
    expect(readClientDataCache(tenantQueryKey("tenant-b.example", ["profile"]))).toBeUndefined();
  });
});
