import { emptySeedResult, type SeedModule } from "./types";

export const featureFlagsSeed: SeedModule = {
  name: "02-feature-flags",
  groups: ["all", "catalogues"],
  run(ctx) {
    ctx.log("[02-feature-flags] skeleton only; no rows inserted");
    return Promise.resolve(emptySeedResult("02-feature-flags"));
  },
};
