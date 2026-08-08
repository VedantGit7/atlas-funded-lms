import type { ReactNode } from "react";
import { AccountThemeProvider } from "../../features/account-settings/account-theme-context";
import { AccountSettingsContentFrame } from "../../features/account-settings/account-settings-content-frame";
import {
  AccountSettingsMobileNav,
  AccountSettingsSidebar,
} from "../../features/account-settings/account-settings-shared";
import { AccountSettingsSidebarFooter } from "../../features/account-settings/account-settings-sidebar-footer";
import { AccountSettingsUserCard } from "../../features/account-settings/account-settings-user-card";

type AccountSettingsLayoutProps = {
  children: ReactNode;
};

export function AccountSettingsLayout({ children }: AccountSettingsLayoutProps) {
  return (
    <AccountThemeProvider kind="settings">
      <div className="account-settings-theme -mx-4 min-h-[50vh] sm:-mx-6 lg:-mx-8">
        <div className="flex min-h-[inherit] flex-col md:flex-row">
          <AccountSettingsSidebar
            header={<AccountSettingsUserCard variant="header" />}
            footer={<AccountSettingsSidebarFooter />}
          />

          <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--acct-bg)]">
            <AccountSettingsContentFrame>
              <AccountSettingsMobileNav />
              {children}
            </AccountSettingsContentFrame>
          </main>
        </div>
      </div>
    </AccountThemeProvider>
  );
}
