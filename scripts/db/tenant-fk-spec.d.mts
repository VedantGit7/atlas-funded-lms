export type TenantForeignKey = {
  child: string;
  column: string;
  parent: string;
  name: string;
};

export declare const TENANT_FOREIGN_KEYS: readonly TenantForeignKey[];
