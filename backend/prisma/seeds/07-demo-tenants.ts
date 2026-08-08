import { emptySeedResult, type SeedModule } from "./types";

export const demoTenantsSeed: SeedModule = {
  name: "07-demo-tenants",
  groups: ["all", "tenants", "fundedbeyond", "smoke-tenant"],
  run(ctx) {
    ctx.log(
      "[07-demo-tenants] tenant fixtures are applied via scripts/tenants and configs/tenants manifests (ATL-STORY-044)",
    );
    return Promise.resolve(emptySeedResult("07-demo-tenants"));
  },
};
