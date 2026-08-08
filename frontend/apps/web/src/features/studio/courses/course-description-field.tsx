"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Table,
  Type,
  Underline,
  Video,
} from "lucide-react";
import { textareaClassName } from "./create-course-dialog-shared";

type CourseDescriptionFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

const toolbarButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40";

export function CourseDescriptionField({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
}: CourseDescriptionFieldProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1.5"
        aria-hidden="true"
      >
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Type className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <span className="text-xs font-bold">H1</span>
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--admin-border)]" />
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Bold className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Italic className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Underline className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Strikethrough className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Link2 className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Palette className="h-4 w-4" strokeWidth={2} />
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--admin-border)]" />
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <List className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <ListOrdered className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <AlignLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <AlignCenter className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <AlignRight className="h-4 w-4" strokeWidth={2} />
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--admin-border)]" />
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Image className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Video className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" tabIndex={-1} disabled className={toolbarButtonClassName}>
          <Table className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        disabled={disabled}
        required={required}
        rows={8}
        placeholder="Describe what learners will gain from this course…"
        className={`${textareaClassName} min-h-[180px] border-0 bg-transparent focus:ring-0`}
      />
    </div>
  );
}
