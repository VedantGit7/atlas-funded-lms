import { emptySeedResult, type SeedModule } from "./types";

export const extensionPointsSeed: SeedModule = {
  name: "05-extension-points",
  groups: ["all", "catalogues"],
  run(ctx) {
    ctx.log("[05-extension-points] skeleton only; no rows inserted");
    return Promise.resolve(emptySeedResult("05-extension-points"));
  },
};
