"use client";

import { ChevronLeft, Info } from "lucide-react";
import type { LessonSettingsSection } from "./lesson-settings-metadata";
import {
  inlineLessonGhostButtonClassName,
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor-shared";
import {
  builderFieldLabelClassName,
  builderHelperClassName,
  builderTextareaClassName,
  fieldClassName,
} from "../course-builder-shared";
import { lessonInputClassName } from "../../lessons/lesson-editor-shared";

export const lessonSettingsNavItemClassName = (active: boolean) =>
  [
    "w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
    active
      ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary-strong)]"
      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
  ].join(" ");

export const LESSON_SETTINGS_NAV: Array<{ id: LessonSettingsSection; label: string }> = [
  { id: "branding", label: "Branding" },
  { id: "lesson_tag", label: "Lesson Tag" },
  { id: "features", label: "Features" },
];

type LessonSettingsShellProps = {
  section: LessonSettingsSection;
  onSectionChange: (section: LessonSettingsSection) => void;
  onBack: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function LessonSettingsShell({
  section,
  onSectionChange,
  onBack,
  children,
  footer,
}: LessonSettingsShellProps) {
  const sectionMeta = LESSON_SETTINGS_NAV.find((item) => item.id === section);

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)] md:flex">
          <div className="border-b border-[var(--admin-border)] px-4 py-4">
            <p className="text-sm font-bold text-[var(--admin-on-surface)]">Lesson Settings</p>
          </div>
          <nav className="flex flex-col gap-1 p-3" aria-label="Lesson settings sections">
            {LESSON_SETTINGS_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={lessonSettingsNavItemClassName(section === item.id)}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => {
                  onSectionChange(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
            <button
              type="button"
              className={`${inlineLessonGhostButtonClassName} mb-5 gap-1.5 px-2`}
              onClick={onBack}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Back
            </button>

            <header className={section === "lesson_tag" ? "sr-only" : "mb-8"}>
              <h2 className="text-2xl font-bold text-[var(--admin-on-surface)]">
                {sectionMeta?.label}
              </h2>
              {section === "branding" ? (
                <p className={`${builderHelperClassName} mt-2 max-w-xl`}>
                  Add details about your lesson and manage brand settings.
                </p>
              ) : null}
              {section === "features" ? (
                <p className={`${builderHelperClassName} mt-2 max-w-xl`}>
                  Control learner-facing capabilities for this lesson.
                </p>
              ) : null}
            </header>

            <div className="md:hidden mb-6">
              <label htmlFor="lesson-settings-section" className={builderFieldLabelClassName}>
                Section
              </label>
              <select
                id="lesson-settings-section"
                className={`${fieldClassName} mt-2`}
                value={section}
                onChange={(event) => {
                  onSectionChange(event.target.value as LessonSettingsSection);
                }}
              >
                {LESSON_SETTINGS_NAV.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {children}

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-[var(--admin-border)] pt-8">
              {footer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type LessonSettingsFieldLabelProps = {
  htmlFor?: string;
  label: string;
  required?: boolean;
  helper?: string;
  counter?: string;
};

export function LessonSettingsFieldLabel({
  htmlFor,
  label,
  required = false,
  helper,
  counter,
}: LessonSettingsFieldLabelProps) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3">
      <div>
        <label htmlFor={htmlFor} className={builderFieldLabelClassName}>
          {label}
          {required ? <span className="text-[var(--admin-danger)]">*</span> : null}
        </label>
        {helper ? <p className={`${builderHelperClassName} mt-1`}>{helper}</p> : null}
      </div>
      {counter ? (
        <span className="shrink-0 text-xs text-[var(--admin-on-surface-variant)]">{counter}</span>
      ) : null}
    </div>
  );
}

type LessonSettingsRadioOption<T extends string> = {
  value: T;
  label: string;
};

type LessonSettingsRadioGroupProps<T extends string> = {
  name: string;
  value: T;
  options: LessonSettingsRadioOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
};

export function LessonSettingsRadioGroup<T extends string>({
  name,
  value,
  options,
  disabled = false,
  onChange,
}: LessonSettingsRadioGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-4">
      {options.map((option) => (
        <label
          key={option.value}
          className={[
            "inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--admin-on-surface)]",
            disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <span
            className={[
              "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              value === option.value
                ? "border-[var(--admin-primary)]"
                : "border-[var(--admin-outline)]",
            ].join(" ")}
          >
            {value === option.value ? (
              <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
            ) : null}
          </span>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            className="sr-only"
            onChange={() => {
              onChange(option.value);
            }}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function LessonSettingsTextInput({
  id,
  value,
  onChange,
  disabled,
  maxLength,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      className={lessonInputClassName}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

export function LessonSettingsTextarea({
  id,
  value,
  onChange,
  disabled,
  maxLength,
  placeholder,
  rows = 4,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      className={builderTextareaClassName}
      rows={rows}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

export function LessonSettingsInfoHint({ children }: { children: React.ReactNode }) {
  return (
    <p className={`${builderHelperClassName} mt-2 inline-flex items-start gap-1.5`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export {
  inlineLessonGhostButtonClassName,
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
};
