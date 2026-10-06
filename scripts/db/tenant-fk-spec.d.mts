export type TenantForeignKey = {
  child: string;
  column: string;
  parent: string;
  name: string;
};

export declare const CORE_TENANT_FOREIGN_KEYS: readonly TenantForeignKey[];
export declare const COVERAGE_TENANT_FOREIGN_KEYS: readonly TenantForeignKey[];
export declare const TENANT_FOREIGN_KEYS: readonly TenantForeignKey[];
