"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  ClipboardList,
  Dumbbell,
  Eye,
  EyeOff,
  FolderOpen,
  Inbox,
  Info,
  Layers,
  LayoutPanelLeft,
  Link2,
  Pencil,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import { primaryButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import { createClientUuid } from "../../../lib/client-api";
import { QuestionPickerDialog, questionTypeName } from "./question-picker-dialog";
import {
  STATUS_CONFIG,
  STATUS_LABELS,
  badgeClassName,
  inputClass,
  insetFormInnerClassName,
  insetFormShellClassName,
  labelClass,
  panelClassName,
  panelScrollClassName,
  secondaryButtonClassName,
  sectionHeaderClassName,
} from "../../learning-paths/learning-path-studio-shared";
import {
  formatItemRegistryApiError,
  itemRegistryApi,
  type CollectionItemEntry,
  type ItemCollectionDto,
  type ItemDto,
} from "../api";

/**
 * The question types Practice shows from a deck (practice.repository.ts);
 * other types in a deck are kept but never reach learners there.
 */
export const PRACTICE_ITEM_TYPES = new Set(["swipe", "matching", "mcq_single", "true_false"]);

const COLLECTION_TYPE_CONFIG = {
  deck: {
    label: "Deck",
    icon: Layers,
    className:
      "bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-on-primary-container)]",
    chipSelected:
      "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--admin-primary)_20%,transparent)]",
  },
  quiz_bank: {
    label: "Quiz bank",
    icon: ClipboardList,
    className:
      "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
    chipSelected:
      "border-[color-mix(in_srgb,var(--admin-warning)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
  },
  practice_set: {
    label: "Practice set",
    icon: Dumbbell,
    className:
      "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]",
    chipSelected:
      "border-[color-mix(in_srgb,var(--admin-success)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]",
  },
} as const;

const ITEM_TYPE_BADGE: Record<string, string> = {
  mcq_single:
    "bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-on-primary-container)]",
  mcq_multi:
    "bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-on-primary-container)]",
  true_false: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  fill_blank:
    "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
  short_answer: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  long_answer: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  matching:
    "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]",
  ordering:
    "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
  file_upload: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  swipe:
    "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
};

const collectionsPanelClassName = `${panelClassName} flex h-full min-h-0 flex-col`;

const typeSegmentGroupClassName =
  "grid grid-cols-3 gap-1 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1";

const typeSegmentButtonBase =
  "flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-200 motion-safe:active:scale-[0.98]";

const collectionRowClassName = (isSelected: boolean) =>
  [
    "relative w-full rounded-lg px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-200 motion-safe:active:scale-[0.995]",
    isSelected
      ? "bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--admin-primary)_16%,transparent)]"
      : "hover:bg-[var(--admin-surface-low)]",
  ].join(" ");

function itemTypeBadgeClassName(itemTypeKey: string): string {
  return (
    ITEM_TYPE_BADGE[itemTypeKey] ??
    "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
  );
}

function collectionTypeSegmentButtonClassName(isSelected: boolean): string {
  if (isSelected) {
    return `${typeSegmentButtonBase} bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm`;
  }
  return `${typeSegmentButtonBase} text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]`;
}

type ItemCollectionsTableProps = {
  collections: ItemCollectionDto[];
};

export function ItemCollectionsTable({
  collections: initialCollections,
}: ItemCollectionsTableProps) {
  const [collections, setCollections] = useState(initialCollections);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [collectionType, setCollectionType] = useState<"deck" | "quiz_bank" | "practice_set">(
    "deck",
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialCollections[0]?.id ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editType, setEditType] = useState<"deck" | "quiz_bank" | "practice_set">("deck");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [collectionItems, setCollectionItems] = useState<CollectionItemEntry[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    if (!selectedCollectionId) {
      setCollectionItems([]);
      return;
    }

    let cancelled = false;
    setItemsLoading(true);

    void itemRegistryApi
      .listCollectionItems(selectedCollectionId)
      .then((response) => {
        if (!cancelled) {
          setCollectionItems(response.data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(formatItemRegistryApiError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setItemsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCollectionId]);

  const removeItemMutation = useMutation({
    mutationFn: ({ collectionId, itemId }: { collectionId: string; itemId: string }) =>
      itemRegistryApi.removeItemFromCollection(collectionId, itemId),
    onMutate: ({ itemId }) => {
      const previousItems = collectionItems;
      setCollectionItems((current) => current.filter((entry) => entry.itemId !== itemId));
      setCollections((current) =>
        current.map((collection) =>
          collection.id === selectedCollectionId
            ? { ...collection, itemCount: Math.max(0, (collection.itemCount ?? 1) - 1) }
            : collection,
        ),
      );
      return { previousItems };
    },
    onError: (err, _input, context) => {
      if (context?.previousItems) {
        setCollectionItems(context.previousItems);
      }
      setError(formatItemRegistryApiError(err));
    },
  });

  async function onCreateCollection() {
    setPending(true);
    setError(null);

    try {
      const response = await itemRegistryApi.createItemCollection({ slug, title, collectionType });
      setCollections((current) => [...current, response.data]);
      setSelectedCollectionId(response.data.id);
      setSlug("");
      setTitle("");
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setPending(false);
    }
  }

  /** Adds the picked questions at the end of the collection (QA review 1 C8). */
  async function onAddItems(picked: ItemDto[]) {
    if (!selectedCollectionId || picked.length === 0) return;

    setPending(true);
    setPickerError(null);
    setNotice(null);

    try {
      const response = await itemRegistryApi.addItemsToCollection(
        selectedCollectionId,
        picked.map((item) => item.id),
      );
      const added = response.data.added.length;
      setCollectionItems((current) => [...current, ...response.data.added]);
      setCollections((current) =>
        current.map((collection) =>
          collection.id === selectedCollectionId
            ? { ...collection, itemCount: (collection.itemCount ?? 0) + added }
            : collection,
        ),
      );
      setPickerOpen(false);
      setNotice(
        `Added ${String(added)} question${added === 1 ? "" : "s"}.` +
          (response.data.skipped > 0
            ? ` ${String(response.data.skipped)} ${response.data.skipped === 1 ? "was" : "were"} already in this collection.`
            : ""),
      );
    } catch (err) {
      setPickerError(formatItemRegistryApiError(err));
    } finally {
      setPending(false);
    }
  }

  /**
   * Publishes the draft questions in the collection (QA review 1 M51: a draft
   * question in a deck never reaches learners, with no hint why).
   */
  async function onPublishDrafts(itemIds: string[]) {
    if (itemIds.length === 0) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await itemRegistryApi.bulkSetItemStatus(
        { status: "PUBLISHED", itemIds },
        createClientUuid(),
      );
      const refreshed = await itemRegistryApi.listCollectionItems(selectedCollectionId);
      setCollectionItems(refreshed.data);
      const { updated, skipped } = response.data;
      setNotice(
        `Published ${String(updated)} question${updated === 1 ? "" : "s"}.` +
          (skipped > 0
            ? ` ${String(skipped)} belong${skipped === 1 ? "s" : ""} to another author and ${skipped === 1 ? "is" : "are"} still a draft.`
            : ""),
      );
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setPending(false);
    }
  }

  /** Publishes or unpublishes the collection (QA review 1 M51: there was no control). */
  async function onSetCollectionStatus(collectionId: string, status: "PUBLISHED" | "DRAFT") {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await itemRegistryApi.updateItemCollection(
        collectionId,
        { status },
        // The page says what publishing does for learners.
        { silent: true },
      );
      setCollections((current) =>
        current.map((collection) =>
          collection.id === collectionId ? { ...collection, ...response.data } : collection,
        ),
      );
      const isDeck = response.data.collectionType === "deck";
      setNotice(
        status === "PUBLISHED"
          ? isDeck
            ? "Published. Learners now see this deck in Practice."
            : "Published."
          : isDeck
            ? "Unpublished. Learners no longer see this deck in Practice."
            : "Unpublished.",
      );
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setPending(false);
    }
  }

  function startEdit(collection: ItemCollectionDto) {
    setEditingId(collection.id);
    setEditTitle(collection.title);
    setEditSlug(collection.slug);
    setEditType(collection.collectionType);
    setError(null);
  }

  async function saveEdit() {
    if (!editingId) return;

    setPending(true);
    setError(null);

    try {
      const response = await itemRegistryApi.updateItemCollection(editingId, {
        title: editTitle,
        slug: editSlug,
        collectionType: editType,
      });
      setCollections((current) =>
        current.map((collection) => (collection.id === editingId ? response.data : collection)),
      );
      setEditingId(null);
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onDeleteCollection(id: string) {
    setPending(true);
    setError(null);

    try {
      await itemRegistryApi.deleteItemCollection(id);
      setCollections((current) => {
        const remaining = current.filter((collection) => collection.id !== id);
        setSelectedCollectionId((selected) =>
          selected === id ? (remaining[0]?.id ?? "") : selected,
        );
        return remaining;
      });
      setPendingDeleteId(null);
      if (editingId === id) {
        setEditingId(null);
      }
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {error && (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 motion-safe:animate-[admin-banner-in_0.22s_ease-out] dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {notice ? (
        <p
          role="status"
          className="shrink-0 rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-2.5 text-sm text-[var(--admin-on-surface)]"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <div className={`${collectionsPanelClassName} min-w-0`}>
          <div className={sectionHeaderClassName}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Collections
            </h2>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-primary)]">
              {collections.length}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={`${panelScrollClassName} space-y-1 px-2 py-2`}>
              {collections.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                    <FolderOpen
                      className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      No collections yet
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                      Create your first collection below
                    </p>
                  </div>
                </div>
              ) : (
                collections.map((collection) => {
                  const typeCfg = COLLECTION_TYPE_CONFIG[collection.collectionType];
                  const TypeIcon = typeCfg.icon;
                  const isSelected = selectedCollectionId === collection.id;
                  return (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => {
                        setSelectedCollectionId(collection.id);
                      }}
                      className={collectionRowClassName(isSelected)}
                    >
                      {isSelected ? (
                        <span
                          className="absolute bottom-2 left-1.5 top-2 w-0.5 rounded-full bg-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="flex items-center justify-between gap-2 pl-1">
                        <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                          {collection.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] text-[var(--admin-on-surface-variant)]">
                          {collection.itemCount ?? 0} items
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-1">
                        <span className={`${badgeClassName} ${typeCfg.className}`}>
                          <TypeIcon className="h-3 w-3" aria-hidden="true" />
                          {typeCfg.label}
                        </span>
                        <span
                          className={`${badgeClassName} ${STATUS_CONFIG[collection.status] ?? ""}`}
                        >
                          {STATUS_LABELS[collection.status] ?? collection.status}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                          <Link2 className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden="true" />
                          {collection.slug}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className={insetFormShellClassName}>
              <div className={insetFormInnerClassName}>
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  New collection
                </p>
                <div className="space-y-2.5">
                  <div>
                    <label className={labelClass} htmlFor="collection-title">
                      Title
                    </label>
                    <input
                      id="collection-title"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                      }}
                      className={inputClass}
                      placeholder="Price Action Basics"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="collection-slug">
                      Slug
                    </label>
                    <input
                      id="collection-slug"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                      }}
                      className={`${inputClass} font-mono`}
                      placeholder="price-action-basics"
                    />
                    <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                      Lowercase letters, numbers, and hyphens only.
                    </p>
                  </div>
                  <div>
                    <span className={labelClass}>Type</span>
                    <div
                      className={typeSegmentGroupClassName}
                      role="group"
                      aria-label="Collection type"
                    >
                      {(["deck", "quiz_bank", "practice_set"] as const).map((type) => {
                        const cfg = COLLECTION_TYPE_CONFIG[type];
                        const Icon = cfg.icon;
                        const isSelected = collectionType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setCollectionType(type);
                            }}
                            className={collectionTypeSegmentButtonClassName(isSelected)}
                          >
                            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={pending || !title.trim() || !slug.trim()}
                    onClick={() => {
                      void onCreateCollection();
                    }}
                    className={`${primaryButtonClassName} w-full justify-center py-2.5`}
                  >
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    Create collection
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${collectionsPanelClassName} min-w-0`}>
          {!selectedCollectionId ? (
            collections.length === 0 ? (
              <div
                className={`${panelScrollClassName} flex flex-col items-center justify-center gap-5 p-6 text-center`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))_70%,var(--admin-surface))]">
                  <Layers className="h-6 w-6 text-[var(--admin-primary)]" aria-hidden="true" />
                </div>
                <div className="max-w-sm space-y-1.5">
                  <p className="text-base font-bold text-[var(--admin-on-surface)]">
                    Build your first collection
                  </p>
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    Group questions into decks, practice sets or quiz banks. A published deck shows
                    to learners in Practice.
                  </p>
                </div>
                <ol className="w-full max-w-xs space-y-2.5 text-left text-sm">
                  {[
                    { step: "1", text: "Name and type your collection on the left" },
                    { step: "2", text: "Add questions from your Question bank" },
                    { step: "3", text: "Publish it so learners see it in Practice" },
                  ].map(({ step, text }) => (
                    <li
                      key={step}
                      className="flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_90%,var(--admin-surface))] px-3 py-2.5"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-xs font-bold text-[var(--admin-primary)]">
                        {step}
                      </span>
                      <span className="pt-0.5 text-[var(--admin-on-surface-variant)]">{text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div
                className={`${panelScrollClassName} flex flex-col items-center justify-center gap-3 p-8 text-center`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                  <LayoutPanelLeft
                    className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Select a collection
                </p>
                <p className="max-w-xs text-sm text-[var(--admin-on-surface-variant)]">
                  Choose a collection on the left to view and manage its items.
                </p>
              </div>
            )
          ) : (
            (() => {
              const selected = collections.find((c) => c.id === selectedCollectionId);
              if (!selected) return null;
              const typeCfg = COLLECTION_TYPE_CONFIG[selected.collectionType];
              const TypeIcon = typeCfg.icon;
              return (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold tracking-tight text-[var(--admin-on-surface)]">
                          {selected.title}
                        </h2>
                        <span className={`${badgeClassName} ${typeCfg.className}`}>
                          <TypeIcon className="h-3 w-3" aria-hidden="true" />
                          {typeCfg.label}
                        </span>
                        <span
                          className={`${badgeClassName} ${STATUS_CONFIG[selected.status] ?? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"}`}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
                            aria-hidden="true"
                          />
                          {STATUS_LABELS[selected.status] ?? selected.status}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          <Link2 className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                          {selected.slug}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            startEdit(selected);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-border)] px-2 py-0.5 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          Edit
                        </button>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {selected.status === "PUBLISHED" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            void onSetCollectionStatus(selected.id, "DRAFT");
                          }}
                          className={secondaryButtonClassName}
                        >
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                          Unpublish
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending || collectionItems.length === 0}
                          title={collectionItems.length === 0 ? "Add questions first" : undefined}
                          onClick={() => {
                            void onSetCollectionStatus(selected.id, "PUBLISHED");
                          }}
                          className={primaryButtonClassName}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Publish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDeleteId(selected.id);
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-destructive/10 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                  <CollectionNotices
                    collectionType={selected.collectionType}
                    entries={collectionItems}
                    pending={pending}
                    onPublishDrafts={(ids) => {
                      void onPublishDrafts(ids);
                    }}
                  />

                  <div className={sectionHeaderClassName}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Items in this collection
                    </h3>
                    <span className="rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">
                      {collectionItems.length} items
                    </span>
                  </div>

                  <div className={panelScrollClassName}>
                    {itemsLoading ? (
                      <div className="space-y-2 p-4">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-12 animate-pulse rounded-lg bg-[var(--admin-surface-high)]"
                          />
                        ))}
                      </div>
                    ) : collectionItems.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                          <Inbox
                            className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                            No items in this collection
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                            Use &ldquo;Add questions&rdquo; below to pick them from your Item Bank.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 overflow-x-auto">
                        <table className="w-full table-fixed text-sm">
                          <thead className="sticky top-0 z-[1] border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                            <tr>
                              <th className="w-12 px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                                #
                              </th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                                Question / content
                              </th>
                              <th className="w-28 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                                Type
                              </th>
                              <th className="w-10 px-2 py-2.5" aria-label="Actions" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--admin-border)]">
                            {collectionItems.map((entry) => {
                              const itemData = entry.item ?? null;
                              const stem = itemData
                                ? (itemData.stem ?? "Question with no text")
                                : "Removed from the Question bank";
                              const typeKey = itemData?.itemTypeKey ?? "";
                              return (
                                <tr
                                  key={entry.id}
                                  className="group transition-colors hover:bg-[var(--admin-surface-low)]"
                                >
                                  <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                    {String(entry.position).padStart(2, "0")}
                                  </td>
                                  <td className="max-w-0 px-3 py-3">
                                    <p className="truncate text-[var(--admin-on-surface)]">
                                      {stem}
                                    </p>
                                    {itemData && itemData.status !== "PUBLISHED" ? (
                                      <span
                                        className={`${badgeClassName} mt-1 ${STATUS_CONFIG[itemData.status] ?? ""}`}
                                      >
                                        {STATUS_LABELS[itemData.status] ?? itemData.status}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-3">
                                    {itemData ? (
                                      <span
                                        className={`${badgeClassName} ${itemTypeBadgeClassName(typeKey)}`}
                                      >
                                        {questionTypeName(typeKey)}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <button
                                      type="button"
                                      aria-label="Remove item from collection"
                                      disabled={removeItemMutation.isPending}
                                      onClick={() => {
                                        removeItemMutation.mutate({
                                          collectionId: selectedCollectionId,
                                          itemId: entry.itemId,
                                        });
                                      }}
                                      className="rounded p-1 text-[var(--admin-on-surface-variant)] opacity-70 transition-[opacity,background-color,color] hover:bg-destructive/10 hover:text-destructive-text group-hover:opacity-100 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                    >
                                      <X className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className={insetFormShellClassName}>
                    <div className={insetFormInnerClassName}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          Search the whole Item Bank and add several questions at once. New
                          questions go to the end.
                        </p>
                        <button
                          type="button"
                          disabled={pending || !selectedCollectionId}
                          onClick={() => {
                            setPickerError(null);
                            setPickerOpen(true);
                          }}
                          className={primaryButtonClassName}
                        >
                          <PlusCircle className="h-4 w-4" aria-hidden="true" />
                          Add questions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      <QuestionPickerDialog
        open={pickerOpen}
        title="Add questions to this collection"
        addedIds={new Set(collectionItems.map((entry) => entry.itemId))}
        busy={pending}
        error={pickerError}
        note={
          collections.find((c) => c.id === selectedCollectionId)?.collectionType === "deck"
            ? "Practice shows true/false, single-choice, matching and swipe questions from a deck, once they are published."
            : null
        }
        onCancel={() => {
          setPickerOpen(false);
        }}
        onConfirm={(picked) => {
          void onAddItems(picked);
        }}
      />

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-collection-title"
            className="w-full max-w-md rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-lg motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                id="edit-collection-title"
                className="text-lg font-bold text-[var(--admin-on-surface)]"
              >
                Edit collection
              </h2>
              <button
                type="button"
                aria-label="Close edit dialog"
                onClick={() => {
                  setEditingId(null);
                }}
                className="rounded-full p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="edit-collection-title-input">
                  Title
                </label>
                <input
                  id="edit-collection-title-input"
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-collection-slug-input">
                  Slug
                </label>
                <input
                  id="edit-collection-slug-input"
                  value={editSlug}
                  onChange={(e) => {
                    setEditSlug(e.target.value);
                  }}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <span className={labelClass}>Type</span>
                <div
                  className={typeSegmentGroupClassName}
                  role="group"
                  aria-label="Collection type"
                >
                  {(["deck", "quiz_bank", "practice_set"] as const).map((type) => {
                    const cfg = COLLECTION_TYPE_CONFIG[type];
                    const Icon = cfg.icon;
                    const isSelected = editType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setEditType(type);
                        }}
                        className={collectionTypeSegmentButtonClassName(isSelected)}
                      >
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                }}
                className="rounded-lg border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void saveEdit();
                }}
                className={primaryButtonClassName}
              >
                {pending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-collection-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-lg motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
            <h2
              id="delete-collection-title"
              className="mb-2 text-lg font-bold text-[var(--admin-on-surface)]"
            >
              Delete this collection?
            </h2>
            <p className="mb-6 text-sm text-[var(--admin-on-surface-variant)]">
              This permanently removes the collection and all its item assignments. The items
              themselves are not deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteId(null);
                }}
                className="rounded-lg border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void onDeleteCollection(pendingDeleteId);
                }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Deleting..." : "Delete collection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * What keeps questions in this collection from learners: drafts (with a
 * button to publish them) and, in a deck, types Practice doesn't show
 * (QA review 1 M41, M51).
 */
export function CollectionNotices({
  collectionType,
  entries,
  pending,
  onPublishDrafts,
}: {
  collectionType: string;
  entries: CollectionItemEntry[];
  pending: boolean;
  onPublishDrafts: (itemIds: string[]) => void;
}) {
  const drafts = entries.filter((entry) => entry.item && entry.item.status !== "PUBLISHED");
  const unsupported =
    collectionType === "deck"
      ? entries.filter((entry) => entry.item && !PRACTICE_ITEM_TYPES.has(entry.item.itemTypeKey))
      : [];
  if (drafts.length === 0 && unsupported.length === 0) return null;

  return (
    <div className="shrink-0 space-y-2 border-b border-[var(--admin-border)] px-5 py-3">
      {drafts.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--admin-on-surface)]">
          <p className="flex items-start gap-2">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            {drafts.length === 1 ? "1 question is" : `${String(drafts.length)} questions are`} not
            published. Learners only see published questions.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              onPublishDrafts(drafts.map((entry) => entry.itemId));
            }}
            className={secondaryButtonClassName}
          >
            Publish {drafts.length === 1 ? "it" : `these ${String(drafts.length)}`}
          </button>
        </div>
      ) : null}
      {unsupported.length > 0 ? (
        <p className="flex items-start gap-2 text-sm text-[var(--admin-on-surface)]">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          {unsupported.length === 1 ? "1 question" : `${String(unsupported.length)} questions`}{" "}
          won&apos;t show in Practice: decks use true/false, single-choice, matching and swipe
          questions.
        </p>
      ) : null}
    </div>
  );
}
