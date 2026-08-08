"use client";

import type { ReactNode } from "react";
import { useAccountTheme } from "../account-settings/account-theme-context";

type SecuritySectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function SecuritySection({ title, description, children }: SecuritySectionProps) {
  const { classes } = useAccountTheme();

  return (
    <section className="grid grid-cols-1 gap-8 md:grid-cols-3">
      <div>
        <h3 className={classes.sectionTitle}>{title}</h3>
        <p className={`${classes.sectionDesc} mt-2`}>{description}</p>
      </div>
      <div className="md:col-span-2">{children}</div>
    </section>
  );
}
