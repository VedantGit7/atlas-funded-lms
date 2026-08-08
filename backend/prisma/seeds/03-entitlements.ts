import { emptySeedResult, type SeedModule } from "./types";

export const entitlementsSeed: SeedModule = {
  name: "03-entitlements",
  groups: ["all", "catalogues"],
  run(ctx) {
    ctx.log("[03-entitlements] skeleton only; no rows inserted");
    return Promise.resolve(emptySeedResult("03-entitlements"));
  },
};
