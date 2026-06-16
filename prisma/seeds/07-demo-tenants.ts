import { emptySeedResult, type SeedModule } from "./types";

export const demoTenantsSeed: SeedModule = {
  name: "07-demo-tenants",
  groups: ["all", "tenants", "fundedbeyond", "smoke-tenant"],
  run(ctx) {
    ctx.log("[07-demo-tenants] skeleton only; no rows inserted");
    return Promise.resolve(emptySeedResult("07-demo-tenants"));
  },
};
