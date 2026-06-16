import { emptySeedResult, type SeedModule } from "./types";

export const rolesSeed: SeedModule = {
  name: "01-roles",
  groups: ["all", "catalogues"],
  run(ctx) {
    ctx.log("[01-roles] skeleton only; no rows inserted");
    return Promise.resolve(emptySeedResult("01-roles"));
  },
};
