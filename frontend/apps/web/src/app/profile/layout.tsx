import type { ReactNode } from "react";
import { AccountShell } from "../../components/shells/AccountShell";
import { AccountSettingsLayout } from "../../features/account-settings/account-settings-layout";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <AccountShell>
      <AccountSettingsLayout>{children}</AccountSettingsLayout>
    </AccountShell>
  );
}
