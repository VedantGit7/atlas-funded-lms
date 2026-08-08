"use client";

import { useAccountTheme } from "./account-theme-context";

type AccountSettingsPageHeaderProps = {
  title: string;
  description?: string;
};

export function AccountSettingsPageHeader({ title, description }: AccountSettingsPageHeaderProps) {
  const { classes } = useAccountTheme();

  return (
    <header className="mb-10 md:mb-12">
      <h1 className={classes.pageTitle}>{title}</h1>
      {description ? <p className={`${classes.pageDesc} mt-1`}>{description}</p> : null}
    </header>
  );
}
