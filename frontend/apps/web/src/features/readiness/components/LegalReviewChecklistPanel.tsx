"use client";

import { Check, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import {
  checklistRowClassName,
  fieldClassName,
  panelAddButtonClassName,
  panelBodyClassName,
  panelHeaderClassName,
} from "../readiness-admin-shared";

type LegalReviewChecklistPanelProps = {
  items: string[];
  checked: Record<number, boolean>;
  disabled?: boolean;
  onItemsChange: (items: string[]) => void;
  onCheckedChange: (checked: Record<number, boolean>) => void;
};

export function LegalReviewChecklistPanel({
  items,
  checked,
  disabled,
  onItemsChange,
  onCheckedChange,
}: LegalReviewChecklistPanelProps) {
  const resolvedCount = items.filter((_, index) => checked[index]).length;

  return (
    <section
      className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
      aria-labelledby="legal-review-heading"
    >
      <div
        className={`${panelHeaderClassName} items-start border-[color-mix(in_srgb,var(--admin-primary)_15%,var(--admin-border))] bg-transparent`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3 pr-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-primary)] text-[var(--admin-on-primary)]">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="legal-review-heading"
              className="text-base font-semibold text-[var(--admin-on-surface)]"
            >
              Legal Review Checklist
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
              Policy changes cannot be published until all compliance items are verified.
              {items.length > 0 ? (
                <span className="ml-1 font-medium text-[var(--admin-primary)]">
                  {resolvedCount} of {items.length} resolved
                </span>
              ) : null}
            </p>
          </div>
        </div>
        {disabled ? null : (
          <button
            type="button"
            className={panelAddButtonClassName}
            onClick={() => {
              onItemsChange([...items, ""]);
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Add item
          </button>
        )}
      </div>

      <div className={`${panelBodyClassName} space-y-2`}>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Add checklist items that must be acknowledged before publishing.
          </p>
        ) : (
          items.map((item, index) => {
            const isChecked = Boolean(checked[index]);
            const rowHighlight = isChecked
              ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
              : "border-[var(--admin-border)] bg-[var(--admin-surface)]";

            return (
              <div
                key={`checklist-${String(index)}`}
                className={`${checklistRowClassName} ${rowHighlight}`}
              >
                <button
                  type="button"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-[border-color,background-color,transform] duration-200 motion-safe:active:scale-95 ${
                    isChecked
                      ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] bg-transparent hover:border-[var(--admin-primary)]"
                  }`}
                  disabled={disabled || !item.trim()}
                  aria-pressed={isChecked}
                  aria-label={`Mark item ${String(index + 1)} as ${isChecked ? "incomplete" : "complete"}`}
                  onClick={() => {
                    onCheckedChange({ ...checked, [index]: !isChecked });
                  }}
                >
                  {isChecked ? (
                    <Check
                      className="h-3.5 w-3.5 text-[var(--admin-on-primary)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>

                {disabled ? (
                  <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--admin-on-surface)]">
                    {item.trim() || "Empty checklist item"}
                  </p>
                ) : (
                  <input
                    className={`${fieldClassName} min-w-0 flex-1 border-transparent bg-transparent px-2 py-1.5 shadow-none focus:border-[var(--admin-primary)]`}
                    value={item}
                    placeholder="Compliance acknowledgment statement"
                    aria-label={`Checklist item ${String(index + 1)}`}
                    onChange={(event) => {
                      onItemsChange(
                        items.map((entry, idx) => (idx === index ? event.target.value : entry)),
                      );
                      if (!event.target.value.trim() && checked[index]) {
                        onCheckedChange({ ...checked, [index]: false });
                      }
                    }}
                  />
                )}

                {!disabled ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-2 text-[var(--admin-danger)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))]"
                    aria-label="Remove checklist item"
                    onClick={() => {
                      onItemsChange(items.filter((_, idx) => idx !== index));
                      const nextChecked: Record<number, boolean> = {};
                      items.forEach((_, idx) => {
                        if (idx === index) return;
                        const target = idx > index ? idx - 1 : idx;
                        if (checked[idx]) nextChecked[target] = true;
                      });
                      onCheckedChange(nextChecked);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
