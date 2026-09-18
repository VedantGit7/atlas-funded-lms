"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

/** Match admin form field / dropdown-trigger language from admin-form-dropdown-shared. */
export const MESSENGER_WIZARD_FIELD_CLASS =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[var(--admin-on-surface-variant)]/55 hover:border-[var(--admin-outline)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const MESSENGER_WIZARD_LABEL_CLASS =
  "mb-2 block text-sm font-medium text-[var(--admin-on-surface)]";

export type MessengerWizardStepDef = { id: string; label: string };

export const PUSH_WIZARD_STEPS: ReadonlyArray<MessengerWizardStepDef> = [
  { id: "title", label: "Title" },
  { id: "audience", label: "Audience" },
  { id: "recipients", label: "Recipients" },
  { id: "compose", label: "Compose" },
  { id: "delivery", label: "Delivery" },
];

export const EMAIL_WIZARD_STEPS: ReadonlyArray<MessengerWizardStepDef> = [
  { id: "title", label: "Title" },
  { id: "audience", label: "Audience" },
  { id: "recipients", label: "Recipients" },
  { id: "compose", label: "Compose" },
  { id: "delivery", label: "Delivery" },
];

type MessengerWizardStepperProps = {
  steps: ReadonlyArray<MessengerWizardStepDef>;
  current: string;
};

export function MessengerWizardStepper({ steps, current }: MessengerWizardStepperProps) {
  const currentIndex = steps.findIndex((entry) => entry.id === current);

  return (
    <nav
      aria-label="Campaign steps"
      className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)] sm:px-6"
    >
      <ol className="flex items-center justify-between gap-2">
        {steps.map((entry, index) => {
          const active = entry.id === current;
          const done = index < currentIndex;
          return (
            <li key={entry.id} className="flex min-w-0 flex-1 items-center last:flex-none">
              <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                <span
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    active
                      ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)]"
                      : done
                        ? "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]"
                        : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={[
                    "hidden max-w-[5.5rem] truncate text-[11px] font-bold uppercase tracking-[0.06em] sm:block",
                    active
                      ? "text-[var(--admin-primary)]"
                      : done
                        ? "text-[var(--admin-on-surface-variant)]"
                        : "text-[var(--admin-on-surface-variant)]/70",
                  ].join(" ")}
                >
                  {entry.label}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={[
                    "mx-2 hidden h-0.5 flex-1 rounded-full sm:block",
                    index < currentIndex ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-border)]",
                  ].join(" ")}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type MessengerWizardFooterProps = {
  left?: ReactNode;
  right: ReactNode;
};

export function MessengerWizardFooter({ left, right }: MessengerWizardFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-6">
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">{right}</div>
    </div>
  );
}

export function MessengerWizardCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}
