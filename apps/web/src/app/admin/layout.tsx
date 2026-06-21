import { TenantAdminShell } from "../../components/shells/TenantAdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <TenantAdminShell>{children}</TenantAdminShell>;
}
