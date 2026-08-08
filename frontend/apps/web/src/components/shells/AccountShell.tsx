import type { ReactNode } from "react";
import { AdminAccountShell } from "./AdminAccountShell";
import { LearnerShell } from "./LearnerShell";
import { ModerationShell } from "./ModerationShell";
import { StudioShell } from "./StudioShell";
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
    case "admin":
      return <AdminAccountShell>{themedChildren}</AdminAccountShell>;
    case "instructor":
      return <StudioShell>{themedChildren}</StudioShell>;
    case "moderator":
      return <ModerationShell>{themedChildren}</ModerationShell>;
    case "learner":
      return <LearnerShell>{themedChildren}</LearnerShell>;
  }
}
