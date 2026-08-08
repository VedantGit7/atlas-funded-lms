"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import {
  DropdownField,
  dropdownFooterButtonClassName,
  dropdownFooterClassName,
  dropdownItemClassName,
  slugifyCategoryLabel,
} from "./admin-form-dropdown-shared";
import { dropdownLabelClassName, fieldClassName, primaryButtonClassName } from "./create-course-dialog-shared";

export type CategoryOption = {
  value: string;
  label: string;
};

export const DEFAULT_CATEGORIES: CategoryOption[] = [
  { value: "business", label: "Business" },
  { value: "design", label: "Design" },
  { value: "finance", label: "Finance" },
  { value: "framework", label: "Framework" },
  { value: "frontend", label: "Frontend" },
  { value: "personal-development", label: "Personal Development" },
  { value: "trading", label: "Trading" },
  { value: "web-development", label: "Web Development" },
];

type CreateCourseCategoryPickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function CreateCourseCategoryPicker({
  value,
  onChange,
  disabled = false,
}: CreateCourseCategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);
  const [newCategoryName, setNewCategoryName] = useState("");

  const selected = categories.find((option) => option.value === value) ?? null;

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.label.localeCompare(b.label)),
    [categories],
  );

  function closeDropdown() {
    setOpen(false);
    setMode("list");
    setNewCategoryName("");
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    closeDropdown();
  }

  function handleClear() {
    onChange("");
    closeDropdown();
  }

  function handleCreateCategory() {
    const label = newCategoryName.trim();
    if (!label) return;

    const slug = slugifyCategoryLabel(label);
    if (!slug) return;

    const existing = categories.find((option) => option.value === slug);
    if (existing) {
      onChange(existing.value);
    } else {
      const created = { value: slug, label };
      setCategories((current) => [...current, created]);
      onChange(created.value);
    }

    closeDropdown();
  }

  return (
    <DropdownField
      label={<span className={dropdownLabelClassName}>Category</span>}
      labelId="new-course-category"
      open={open}
      disabled={disabled}
      portalZIndex={85}
      panelAriaLabel="Course categories"
      onToggle={() => {
        if (disabled) return;
        setOpen((current) => {
          if (current) {
            setMode("list");
            setNewCategoryName("");
          }
          return !current;
        });
      }}
      triggerContent={
        <span className={selected ? "text-[var(--admin-on-surface)]" : "text-[var(--admin-on-surface-variant)]"}>
          {selected?.label ?? "Select option"}
        </span>
      }
    >
        {mode === "list" ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {sortedCategories.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      handleSelect(option.value);
                    }}
                    className={[
                      dropdownItemClassName,
                      active ? "bg-[var(--admin-surface-high)] font-medium" : "",
                    ].join(" ")}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {active ? (
                      <Check className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
                    ) : (
                      <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className={dropdownFooterClassName}>
              <button
                type="button"
                onClick={handleClear}
                className={dropdownFooterButtonClassName}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("create");
                  setNewCategoryName("");
                }}
                className={`${dropdownFooterButtonClassName} inline-flex items-center gap-1`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create New
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 p-2">
            <button
              type="button"
              aria-label="Back to category list"
              onClick={() => {
                setMode("list");
                setNewCategoryName("");
              }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="text"
              value={newCategoryName}
              onChange={(event) => {
                setNewCategoryName(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreateCategory();
                }
              }}
              placeholder="Enter…"
              className={`${fieldClassName} min-w-0 flex-1 rounded-xl py-2`}
              autoFocus
            />
            <button
              type="button"
              disabled={newCategoryName.trim().length === 0}
              onClick={handleCreateCategory}
              className={`${primaryButtonClassName} rounded-xl px-4 py-2`}
            >
              Create
            </button>
          </div>
        )}
    </DropdownField>
  );
}
