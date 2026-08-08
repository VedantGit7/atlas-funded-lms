import type { ReactNode } from "react";
import { TenantAdminShellGate } from "./TenantAdminShellGate";

export const tenantAdminShellNavigationContract = {
  shell: "TenantAdminShell",
  primaryNavSource: "features/admin/admin-navigation.ts",
  routeRegistry: "features/admin/admin-route-registry.ts",
} as const;

type TenantAdminShellProps = {
  children: ReactNode;
};

export function TenantAdminShell({ children }: TenantAdminShellProps) {
  return <TenantAdminShellGate>{children}</TenantAdminShellGate>;
}

export { TenantAdminShellClient } from "./TenantAdminShellClient";
