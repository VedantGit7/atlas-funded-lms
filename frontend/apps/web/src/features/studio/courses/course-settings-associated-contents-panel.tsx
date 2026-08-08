"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import { builderHelperClassName } from "./course-builder-shared";
import { courseSettingsCardClassName } from "./course-settings-shared";
import { inlineLessonGhostButtonClassName } from "./inline-lesson-editor/inline-lesson-editor-shared";
import type { NewsfeedPostDto } from "../../admin/grow/newsfeed-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type AssociatedContentKind = "products" | "segments" | "categories" | "newsfeeds";

type AssociatedContentRow = {
  id: AssociatedContentKind;
  title: string;
  description: string;
  count: number;
};

type AssociatedContentsView = "main" | AssociatedContentKind;

type CourseSettingsAssociatedContentsPanelProps = {
  course: CourseDetail;
};

function AssociatedContentNavigationRow({
  title,
  description,
  count,
  onClick,
}: {
  title: string;
  description: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        courseSettingsCardClassName,
        "group flex w-full items-center gap-4 text-left transition-[border-color,background-color,transform] duration-200",
        "hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)] motion-safe:hover:-translate-y-px",
      ].join(" ")}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {description}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--admin-on-surface)]">
        {count}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--admin-on-surface)]"
        strokeWidth={2}
        aria-hidden="true"
      />
    </button>
  );
}

function NewsfeedsAssociatedPanel({
  courseId,
  onBack,
}: {
  courseId: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsfeedPostDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        productId: courseId,
        status: "ALL",
        limit: "50",
      });
      const response = await clientApi.get<{ data: { items: NewsfeedPostDto[] } }>(
        `/api/v1/marketing/newsfeeds?${params.toString()}`,
        "course-associated-newsfeeds",
      );
      setItems(response.data.items);
    } catch (caught) {
      setItems([]);
      toast.error(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not load associated newsfeeds.",
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-w-0 w-full">
      <button
        type="button"
        className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Back
      </button>

      <header className="mb-8 border-b border-[var(--admin-border)] pb-6">
        <h2 className="text-xl font-bold text-[var(--admin-on-surface)] md:text-2xl">Newsfeeds</h2>
        <p className={`${builderHelperClassName} mt-2 text-sm leading-relaxed`}>
          Promo newsfeed posts that embed this product.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
      ) : items.length === 0 ? (
        <p
          className={`${builderHelperClassName} rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-8 text-center`}
        >
          No newsfeeds associated with this course yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/marketing/newsfeed/${item.id}`}
                prefetch={false}
                className="flex items-center justify-between gap-3 border border-[var(--admin-outline)] px-4 py-3 text-sm hover:border-[var(--admin-primary)]"
              >
                <span className="font-medium text-[var(--admin-on-surface)]">{item.title}</span>
                <span className="text-[var(--admin-on-surface-variant)]">{item.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssociatedContentDetailPanel({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="min-w-0 w-full">
      <button
        type="button"
        className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Back
      </button>

      <header className="mb-8 border-b border-[var(--admin-border)] pb-6">
        <h2 className="text-xl font-bold text-[var(--admin-on-surface)] md:text-2xl">{title}</h2>
        <p className={`${builderHelperClassName} mt-2 text-sm leading-relaxed`}>
          Manage associations for this course. Association management will be available here soon.
        </p>
      </header>

      <p
        className={`${builderHelperClassName} rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-8 text-center`}
      >
        No {title.toLowerCase()} associated with this course yet.
      </p>
    </div>
  );
}

export function CourseSettingsAssociatedContentsPanel({
  course,
}: CourseSettingsAssociatedContentsPanelProps) {
  const [view, setView] = useState<AssociatedContentsView>("main");
  const [newsfeedCount, setNewsfeedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({
          productId: course.id,
          status: "ALL",
          limit: "100",
        });
        const response = await clientApi.get<{ data: { items: NewsfeedPostDto[] } }>(
          `/api/v1/marketing/newsfeeds?${params.toString()}`,
          "course-associated-newsfeeds-count",
        );
        if (!cancelled) setNewsfeedCount(response.data.items.length);
      } catch {
        if (!cancelled) setNewsfeedCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [course.id]);

  const rows: AssociatedContentRow[] = [
    {
      id: "products",
      title: "Products",
      description: "View all products this course is associated to and manage association.",
      count: 0,
    },
    {
      id: "segments",
      title: "Segments",
      description: "View all segments this product is associated to and manage association.",
      count: 0,
    },
    {
      id: "categories",
      title: "Categories",
      description: "View all categories this product is associated to and manage association.",
      count: 0,
    },
    {
      id: "newsfeeds",
      title: "Newsfeeds",
      description: "View all newsfeeds this product is associated to and manage association.",
      count: newsfeedCount,
    },
  ];

  if (view === "newsfeeds") {
    return (
      <NewsfeedsAssociatedPanel
        courseId={course.id}
        onBack={() => {
          setView("main");
        }}
      />
    );
  }

  if (view !== "main") {
    const row = rows.find((item) => item.id === view);
    return (
      <AssociatedContentDetailPanel
        title={row?.title ?? "Associated contents"}
        onBack={() => {
          setView("main");
        }}
      />
    );
  }

  return (
    <div className={`space-y-4 ${inlineExpandClassName}`}>
      {rows.map((row) => (
        <AssociatedContentNavigationRow
          key={row.id}
          title={row.title}
          description={row.description}
          count={row.count}
          onClick={() => {
            setView(row.id);
          }}
        />
      ))}
    </div>
  );
}
