"use client";

import Link from "next/link";
import { Check, ChevronRight, Copy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  fieldClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "./course-builder-shared";
import { inlineLessonSecondaryButtonClassName } from "./inline-lesson-editor/inline-lesson-editor-shared";

export const courseSettingsNavItemClassName = (active: boolean, disabled?: boolean) =>
  [
    "group relative flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
    active
      ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary-strong)]"
      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
    disabled ? "opacity-70" : "",
  ].join(" ");

export const courseSettingsFieldStackClassName = "flex flex-col gap-2";

export const courseSettingsSectionStackClassName = "space-y-10";

export const courseSettingsRichEditorShellClassName = (disabled: boolean) =>
  [
    "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm",
    disabled ? "opacity-60" : "",
  ].join(" ");

export const courseSettingsStickyFooterClassName =
  "sticky bottom-0 z-10 -mx-4 mt-10 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-4 py-4 backdrop-blur-sm md:-mx-8 md:px-8";

type CourseSettingsFormFooterProps = {
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
  saveLabel?: string;
};

export function CourseSettingsFormFooter({
  onSave,
  onCancel,
  saving = false,
  saveDisabled = false,
  cancelDisabled = false,
  saveLabel = "Save",
}: CourseSettingsFormFooterProps) {
  return (
    <div className={courseSettingsStickyFooterClassName}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className={`${primaryButtonClassName} min-w-[7.5rem]`}
          disabled={saveDisabled || saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : saveLabel}
        </button>
        <button
          type="button"
          className={inlineLessonSecondaryButtonClassName}
          disabled={cancelDisabled || saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

type CourseSettingsMediaUploadProps = {
  label: string;
  helper: string;
  hint?: string;
  emptyIcon: LucideIcon;
  previewUrl: string | null;
  previewKind?: "image" | "video" | "text";
  disabled?: boolean;
  uploading?: boolean;
  onPickFile: () => void;
  onRemove: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onFileChange: (file: File | null) => void;
};

export function CourseSettingsMediaUpload({
  label,
  helper,
  hint,
  emptyIcon: EmptyIcon,
  previewUrl,
  previewKind = "image",
  disabled = false,
  uploading = false,
  onPickFile,
  onRemove,
  inputRef,
  accept,
  onFileChange,
}: CourseSettingsMediaUploadProps) {
  return (
    <div className={courseSettingsFieldStackClassName}>
      <div>
        <p className="text-sm font-semibold text-[var(--admin-on-surface)]">{label}</p>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{helper}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div
          className={[
            "relative flex aspect-video w-full items-center justify-center overflow-hidden bg-[var(--admin-surface-low)]",
            !previewUrl
              ? "border-b border-dashed border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_4%,var(--admin-surface-low))]"
              : "",
          ].join(" ")}
        >
          {previewUrl ? (
            previewKind === "video" && previewUrl.startsWith("blob:") ? (
              <video
                src={previewUrl}
                controls
                className="h-full w-full object-contain"
              />
            ) : previewKind === "image" ? (
              <img src={previewUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <p className="max-w-md truncate px-6 text-sm text-[var(--admin-on-surface-variant)]">
                {previewUrl}
              </p>
            )
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] shadow-sm">
                <EmptyIcon className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No file selected
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
          <button
            type="button"
            className={outlineButtonClassName}
            disabled={disabled || uploading || !previewUrl}
            onClick={onRemove}
          >
            Remove
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(event) => {
              onFileChange(event.target.files?.[0] ?? null);
            }}
          />
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={disabled || uploading}
            onClick={onPickFile}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      {hint ? (
        <p className="inline-flex items-start gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--admin-primary)]" aria-hidden="true" />
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  );
}

export function CourseSettingsInfoBanner({ children }: { children: ReactNode }) {
  return (
    <p
      className={`${statusBannerClassName} border-[var(--admin-primary)]/25 bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] text-[var(--admin-on-surface)]`}
    >
      {children}
    </p>
  );
}

export function courseSettingsCounterTone(current: number, max: number): string {
  if (current >= max) return "text-[var(--admin-danger)]";
  if (current >= max * 0.9) return "text-[var(--admin-warning)]";
  return "text-[var(--admin-on-surface-variant)]";
}

type CourseSettingsSectionBlockProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function CourseSettingsSectionBlock({
  title,
  description,
  children,
}: CourseSettingsSectionBlockProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-[var(--admin-on-surface)]">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

type CourseSettingsCheckboxFieldProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function CourseSettingsCheckboxField({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: CourseSettingsCheckboxFieldProps) {
  return (
    <label
      htmlFor={id}
      className={[
        "flex cursor-pointer items-start gap-3 rounded-xl transition-opacity",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-[border-color,background-color] duration-200",
          checked
            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
            : "border-[var(--admin-outline)] bg-[var(--admin-surface)]",
        ].join(" ")}
        aria-hidden="true"
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">{label}</span>
        {description ? (
          <span className="mt-1 block text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            {description}
          </span>
        ) : null}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </label>
  );
}

type CourseSettingsSlugUrlFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  baseUrl: string;
  value: string;
  maxLength: number;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function CourseSettingsSlugUrlField({
  id,
  label,
  required = false,
  baseUrl,
  value,
  maxLength,
  disabled = false,
  onChange,
}: CourseSettingsSlugUrlFieldProps) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${baseUrl}${value}`;

  async function handleCopy() {
    if (!fullUrl.trim()) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={courseSettingsFieldStackClassName}>
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-[var(--admin-on-surface)]">
          {label}
          {required ? <span className="text-[var(--admin-danger)]">*</span> : null}
        </label>
        <span
          className={`shrink-0 text-xs font-medium tabular-nums ${courseSettingsCounterTone(value.length, maxLength)}`}
        >
          {value.length}/{maxLength}
        </span>
      </div>
      <div className="flex overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/25">
        <span className="hidden shrink-0 items-center border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5 text-xs text-[var(--admin-on-surface-variant)] sm:flex">
          {baseUrl}
        </span>
        <input
          id={id}
          className={`${fieldClassName} min-w-0 flex-1 rounded-none border-0 bg-[var(--admin-surface-low)] shadow-none focus:ring-0`}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          placeholder="course-slug"
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center border-l border-[var(--admin-border)] px-3 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          disabled={disabled || value.trim().length === 0}
          aria-label={copied ? "URL copied" : "Copy full URL"}
          onClick={() => {
            void handleCopy();
          }}
        >
          {copied ? (
            <Check className="h-4 w-4 text-[var(--admin-success)]" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>
      <p className="text-xs text-[var(--admin-on-surface-variant)] sm:hidden">{baseUrl}</p>
    </div>
  );
}

export const courseSettingsCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 shadow-sm md:px-5 md:py-5";

type CourseSettingsSwitchProps = {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
};

export function CourseSettingsSwitch({
  id,
  checked,
  disabled = false,
  onChange,
  ariaLabel,
}: CourseSettingsSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-high)]",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <span
        className={[
          "inline-block h-5 w-5 rounded-full bg-[var(--admin-surface)] shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
  );
}

type CourseSettingsToggleCardProps = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function CourseSettingsToggleCard({
  id,
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: CourseSettingsToggleCardProps) {
  return (
    <div
      className={[
        courseSettingsCardClassName,
        "transition-[border-color,box-shadow] duration-200",
        checked
          ? "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--admin-primary)_12%,transparent)]"
          : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--admin-on-surface)]">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            {description}
          </p>
        </div>
        <CourseSettingsSwitch
          id={id}
          checked={checked}
          disabled={disabled}
          ariaLabel={`${title} ${checked ? "enabled" : "disabled"}`}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

type CourseSettingsNavigationRowProps = {
  title: string;
  description: string;
  disabled?: boolean;
  href?: string;
  /** When true with href, opens the destination in a new browser tab. */
  openInNewTab?: boolean;
  onClick?: () => void;
};

export function CourseSettingsNavigationRow({
  title,
  description,
  disabled = false,
  href,
  openInNewTab = false,
  onClick,
}: CourseSettingsNavigationRowProps) {
  const className = [
    courseSettingsCardClassName,
    "group flex w-full items-center gap-4 text-left transition-[border-color,background-color,transform] duration-200",
    disabled
      ? "cursor-not-allowed opacity-60"
      : "hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)] motion-safe:hover:-translate-y-px",
  ].join(" ");

  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {description}
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--admin-on-surface)]"
        strokeWidth={2}
        aria-hidden="true"
      />
    </>
  );

  if (href && !disabled) {
    if (openInNewTab) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {content}
        </a>
      );
    }

    return (
      <Link href={href} prefetch={false} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {content}
    </button>
  );
}
