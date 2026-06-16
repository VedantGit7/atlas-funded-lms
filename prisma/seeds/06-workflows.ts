import { emptySeedResult, type SeedModule } from "./types";

export const workflowsSeed: SeedModule = {
  name: "06-workflows",
  groups: ["all", "catalogues"],
  run(ctx) {
    ctx.log("[06-workflows] skeleton only; no rows inserted");
    return Promise.resolve(emptySeedResult("06-workflows"));
  },
};
