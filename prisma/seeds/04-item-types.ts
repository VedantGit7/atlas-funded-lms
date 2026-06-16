import { emptySeedResult, type SeedModule } from "./types";

export const itemTypesSeed: SeedModule = {
  name: "04-item-types",
  groups: ["all", "catalogues"],
  run(ctx) {
    ctx.log("[04-item-types] skeleton only; no rows inserted");
    return Promise.resolve(emptySeedResult("04-item-types"));
  },
};
