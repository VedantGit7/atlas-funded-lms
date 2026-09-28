import type { ReactNode } from "react";
import { resolveAccountShellKind } from "../../lib/server/account-role";
import {
  AccountThemeProvider,
  type AccountThemeKind,
} from "../../features/account-settings/account-theme-context";

type AccountShellProps = {
  children: ReactNode;
};

const THEME_BY_SHELL_KIND: Record<
  Awaited<ReturnType<typeof resolveAccountShellKind>>,
  AccountThemeKind
> = {
  admin: "admin",
  instructor: "studio",
  moderator: "default",
  learner: "default",
};

/**
 * Wraps account-level pages (e.g. /profile, /settings) in whichever shell
 * chrome matches the visitor's role, so every role manages their own account
 * inside their own home shell instead of always landing in the learner shell.
 * Also provides the matching token theme (admin/studio/default) so the shared
 * account-settings form components pick up the right colors in each shell.
 */
export async function AccountShell({ children }: AccountShellProps) {
  const kind = await resolveAccountShellKind();
  const themeKind = THEME_BY_SHELL_KIND[kind];

  const themedChildren = <AccountThemeProvider kind={themeKind}>{children}</AccountThemeProvider>;

  switch (kind) {
    case "admin": {
      const { AdminAccountShell } = await import("./AdminAccountShell");
      return <AdminAccountShell>{themedChildren}</AdminAccountShell>;
    }
    case "instructor": {
      const { StudioShell } = await import("./StudioShell");
      return <StudioShell>{themedChildren}</StudioShell>;
    }
    case "moderator": {
      const { ModerationShell } = await import("./ModerationShell");
      return <ModerationShell>{themedChildren}</ModerationShell>;
    }
    case "learner": {
      const { LearnerShell } = await import("./LearnerShell");
      return <LearnerShell>{themedChildren}</LearnerShell>;
    }
  }
}
