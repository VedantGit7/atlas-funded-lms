"use client";

import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import type { z } from "zod";
import { ItemResponseRenderer } from "../../item-registry/components/renderers/item-response-renderer";
import { getItemTypeVisual } from "../../item-registry/components/item-type-config";
import type { assessmentDetailSchema } from "../assessment-response-schemas";
import {
  cardSectionTitleClassName,
  itemDisplayTitle,
  panelClassName,
  sectionHeaderClassName,
} from "../assessment-studio-shared";

type AssessmentItem = z.infer<typeof assessmentDetailSchema>["items"][number];

type AssessmentBuilderPreviewProps = {
  title: string;
  description: string;
  items: AssessmentItem[];
};

function readStem(contentJson: Record<string, unknown> | undefined): string {
  if (!contentJson) return "Question";
  if (typeof contentJson.stem === "string" && contentJson.stem.trim()) {
    return contentJson.stem.trim();
  }
  return itemDisplayTitle(contentJson);
}

export function AssessmentBuilderPreview({
  title,
  description,
  items,
}: AssessmentBuilderPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((current) => {
      if (items.length === 0) return 0;
      return Math.min(current, items.length - 1);
    });
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border-2 border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-8 text-center">
        <div className="text-[var(--admin-on-surface-variant)]">
          <Eye className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden="true" />
          <p className="text-xs font-medium">Add items to preview how learners will see this assessment</p>
        </div>
      </div>
    );
  }

  const activeItem = items[activeIndex]!;
  const itemTypeKey = activeItem.itemTypeKey ?? "mcq_single";
  const typeVisual = getItemTypeVisual(itemTypeKey);
  const stem = readStem(activeItem.contentJson);

  return (
    <div className={panelClassName}>
      <div className={`${sectionHeaderClassName} flex-wrap gap-2`}>
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
          <h3 className={cardSectionTitleClassName}>Learner preview</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous question"
            disabled={activeIndex === 0}
            onClick={() => {
              setActiveIndex((current) => Math.max(0, current - 1));
            }}
            className="rounded-lg border border-[var(--admin-border)] p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
            {activeIndex + 1} / {items.length}
          </span>
          <button
            type="button"
            aria-label="Next question"
            disabled={activeIndex >= items.length - 1}
            onClick={() => {
              setActiveIndex((current) => Math.min(items.length - 1, current + 1));
            }}
            className="rounded-lg border border-[var(--admin-border)] p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <p className="text-base font-semibold text-[var(--admin-on-surface)]">
            {title.trim() || "Untitled assessment"}
          </p>
          {description.trim() ? (
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{description.trim()}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--admin-on-surface-variant)]">
              Question {activeIndex + 1}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${typeVisual.badgeClassName}`}
            >
              {itemTypeKey.replaceAll("_", " ")}
            </span>
            <span className="text-xs text-[var(--admin-on-surface-variant)]">
              {activeItem.points} point{activeItem.points === 1 ? "" : "s"}
            </span>
          </div>

          <ItemResponseRenderer
            key={`${activeItem.itemId}-${String(activeItem.position)}`}
            itemTypeKey={itemTypeKey}
            stem={stem}
            options={activeItem.options?.map((option) => ({
              id: option.id,
              optionJson: option.optionJson,
              isCorrect: "isCorrect" in option ? (option.isCorrect ?? null) : null,
              position: option.position,
            }))}
            mode="preview"
            disabled={false}
            showStem={itemTypeKey !== "swipe"}
          />
        </div>
      </div>
    </div>
  );
}
