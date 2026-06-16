import { emptySeedResult, type SeedModule } from "./types";

export const permissionsSeed: SeedModule = {
  name: "00-permissions",
  groups: ["all", "catalogues"],
  run(ctx) {
    ctx.log("[00-permissions] skeleton only; no rows inserted");
    return Promise.resolve(emptySeedResult("00-permissions"));
  },
};
