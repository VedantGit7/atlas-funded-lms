import type { TenantForeignKey } from "./tenant-fk-spec.mjs";

export type TenantForeignKeyResult = TenantForeignKey & {
  missing: number;
  crossTenant: number;
  sampleIds: string[];
  constraint: "validated" | "not_valid" | "absent";
};

export declare function checkTenantForeignKeys(
  databaseUrl: string | undefined,
  options?: { samples?: number },
): Promise<{
  database: string;
  clean: boolean;
  allValidated: boolean;
  violations: TenantForeignKeyResult[];
  results: TenantForeignKeyResult[];
}>;
