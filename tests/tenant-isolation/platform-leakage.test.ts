import { describe, expect, it } from "vitest";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";
import { withTenantTx } from "@atlas/db";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("platform scope leakage prevention", () => {
  it("tenant transactions do not enter platform scope", async () => {
    const fixture = await createTenantIsolationFixture();

    const rows = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ platform_scope: string | null }>>`
        SELECT current_setting('app.platform_scope', true) AS platform_scope
      `;
    });

    expect(rows[0]?.platform_scope ?? "").toBe("");
  });
});
