export type SeedMode = "dry-run" | "apply";

export type SeedGroup = "all" | "catalogues" | "tenants" | "fundedbeyond" | "smoke-tenant";

export type SeedContext = {
  mode: SeedMode;
  group: SeedGroup;
  log: (message: string) => void;
};

export type SeedResult = {
  name: string;
  planned: number;
  inserted: number;
  updated: number;
  skipped: number;
};

export type SeedModule = {
  name: string;
  groups: readonly SeedGroup[];
  run: (ctx: SeedContext) => Promise<SeedResult>;
};

export function emptySeedResult(name: string): SeedResult {
  return {
    name,
    planned: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };
}
