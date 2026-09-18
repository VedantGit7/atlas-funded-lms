"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Archive,
  Check,
  ChevronDown,
  Copy,
  FileStack,
  Layers,
  ListChecks,
  MoreVertical,
  Send,
  UserPlus,
} from "lucide-react";
import {
  catalogueCheckboxClassName,
  catalogueIconButtonClassName,
  catalogueItemChipClassName,
  catalogueRowClassName,
  catalogueRowSelectedClassName,
  catalogueSlugChipClassName,
  catalogueTableHeadCellClassName,
  catalogueTableShellClassName,
  formatUpdatedAt,
  itemKindLabel,
  statusChipClassName,
  statusLabel,
  type ProductRow,
} from "./learner-products-shared";
import { manageDropdownItemClassName } from "../manage/manage-ui-shared";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";

type LearnerProductsTableProps = {
  rows: ProductRow[];
  /** URL segment for the detail route each row links to. */
  typeSlug: string;
  selectedIds: Set<string>;
  /** Products with no contents list (mock tests) never render an expander. */
  expandable: boolean;
  busyIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onEnrol: (row: ProductRow) => void;
  onChangeStatus: (row: ProductRow, status: string) => void;
  onCopySlug: (slug: string) => void;
};

const ITEM_KIND_ICON: Record<string, typeof Layers> = {
  course: FileStack,
  mock_test: ListChecks,
  test_series: Layers,
  bundle: Layers,
};

export function LearnerProductsTable({
  rows,
  typeSlug,
  selectedIds,
  expandable,
  busyIds,
  onToggleRow,
  onToggleAll,
  onEnrol,
  onChangeStatus,
  onCopySlug,
}: LearnerProductsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const someSelected = rows.some((row) => selectedIds.has(row.id));

  useEffect(() => {
    // `indeterminate` is a DOM property with no React attribute; a partial
    // selection that renders as an empty box reads as "nothing is selected".
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  useEffect(() => {
    if (!menuId) return;
    function onPointerDown() {
      setMenuId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuId]);

  return (
    <div className={catalogueTableShellClassName}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <thead className="bg-[color-mix(in_srgb,var(--admin-surface-high)_55%,transparent)]">
            <tr>
              <th scope="col" className="w-12 px-4 py-3">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className={catalogueCheckboxClassName}
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label={allSelected ? "Clear selection" : "Select all rows on this page"}
                />
              </th>
              {expandable ? <th scope="col" className="w-8 px-0 py-3" /> : null}
              <th scope="col" className={catalogueTableHeadCellClassName}>
                Title &amp; slug
              </th>
              <th scope="col" className={catalogueTableHeadCellClassName}>
                Contents
              </th>
              <th scope="col" className={`${catalogueTableHeadCellClassName} w-32`}>
                Status
              </th>
              <th scope="col" className={`${catalogueTableHeadCellClassName} w-32`}>
                Updated
              </th>
              <th scope="col" className={`${catalogueTableHeadCellClassName} w-28 text-right`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = selectedIds.has(row.id);
              const expanded = expandedId === row.id;
              const busy = busyIds.has(row.id);
              const canExpand = expandable && row.items.length > 0;

              return [
                <tr
                  key={row.id}
                  className={[
                    catalogueRowClassName,
                    selected ? catalogueRowSelectedClassName : "",
                    busy ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-4 align-top">
                    <input
                      type="checkbox"
                      className={catalogueCheckboxClassName}
                      checked={selected}
                      onChange={() => {
                        onToggleRow(row.id);
                      }}
                      aria-label={`Select ${row.title}`}
                    />
                  </td>

                  {expandable ? (
                    <td className="py-4 pl-0 pr-1 align-top">
                      {canExpand ? (
                        <button
                          type="button"
                          className={catalogueIconButtonClassName}
                          aria-expanded={expanded}
                          aria-label={
                            expanded
                              ? `Hide contents of ${row.title}`
                              : `Show contents of ${row.title}`
                          }
                          onClick={() => {
                            setExpandedId(expanded ? null : row.id);
                          }}
                        >
                          <ChevronDown
                            className={[
                              "h-4 w-4 transition-transform duration-200",
                              expanded ? "rotate-180" : "rotate-0",
                            ].join(" ")}
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                    </td>
                  ) : null}

                  <td className="px-4 py-4 align-top">
                    <Link
                      href={`/admin/manage/learner-products/${typeSlug}/${row.id}`}
                      className="block text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
                    >
                      {row.title}
                    </Link>
                    <span className={`${catalogueSlugChipClassName} mt-1`}>{row.slug}</span>
                  </td>

                  <td className="px-4 py-4 align-top text-sm text-[var(--admin-on-surface-variant)]">
                    {row.detail}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className={statusChipClassName(row.status)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {statusLabel(row.status)}
                    </span>
                  </td>

                  <td className="font-data px-4 py-4 align-top text-xs text-[var(--admin-on-surface-variant)]">
                    {formatUpdatedAt(row.updatedAt)}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className={catalogueIconButtonClassName}
                        title={`Enrol a learner into ${row.title}`}
                        aria-label={`Enrol a learner into ${row.title}`}
                        disabled={busy}
                        onClick={() => {
                          onEnrol(row);
                        }}
                      >
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <RowActionsMenu
                        row={row}
                        open={menuId === row.id}
                        disabled={busy}
                        onToggle={() => {
                          setMenuId(menuId === row.id ? null : row.id);
                        }}
                        onClose={() => {
                          setMenuId(null);
                        }}
                        onChangeStatus={onChangeStatus}
                        onCopySlug={onCopySlug}
                      />
                    </div>
                  </td>
                </tr>,

                canExpand && expanded ? (
                  <tr key={`${row.id}-contents`} className="border-t border-[var(--admin-border)]">
                    <td
                      colSpan={7}
                      className="bg-[color-mix(in_srgb,var(--admin-surface-high)_35%,transparent)] px-4 py-5"
                    >
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        <Layers className="h-4 w-4" aria-hidden="true" />
                        Contents ({row.items.length})
                      </h4>
                      <ul className="flex flex-wrap gap-2">
                        {row.items.map((item) => {
                          const Icon = ITEM_KIND_ICON[item.kind] ?? Layers;
                          const missing = item.title === null;
                          return (
                            <li
                              key={item.id}
                              className={[
                                catalogueItemChipClassName,
                                missing
                                  ? "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] text-[var(--admin-danger)]"
                                  : "",
                              ].join(" ")}
                              title={itemKindLabel(item.kind)}
                            >
                              <Icon
                                className={[
                                  "h-3.5 w-3.5",
                                  missing
                                    ? "text-[var(--admin-danger)]"
                                    : "text-[var(--admin-primary)]",
                                ].join(" ")}
                                aria-hidden="true"
                              />
                              {item.title ?? `${itemKindLabel(item.kind)} (deleted)`}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
                        Shown in the order learners receive them. Open the product for the full
                        contents list.
                      </p>
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Row action menu, rendered through a portal.
 *
 * The table scrolls horizontally on narrow viewports, and an `overflow-x: auto`
 * ancestor clips in both axes — an absolutely positioned menu on the last row
 * was cut off by the container it lived in. Portaling to `document.body` and
 * positioning from the trigger's rect is the same escape hatch `DropdownField`
 * uses, which is why the panel carries `admin-theme admin-dropdown-panel`: the
 * `--admin-*` tokens do not reach outside the shell on their own.
 */
function RowActionsMenu({
  row,
  open,
  disabled,
  onToggle,
  onClose,
  onChangeStatus,
  onCopySlug,
}: {
  row: ProductRow;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChangeStatus: (row: ProductRow, status: string) => void;
  onCopySlug: (slug: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const panelWidth = 200;
      const panelHeight = 190;
      const gap = 6;
      const openUpward = window.innerHeight - rect.bottom < panelHeight + gap;
      setStyle({
        position: "fixed",
        width: panelWidth,
        left: Math.max(12, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 12)),
        zIndex: 100,
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      });
    }

    reposition();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={catalogueIconButtonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${row.title}`}
        disabled={disabled}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={onToggle}
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && mounted
        ? createPortal(
            <div
              role="menu"
              aria-label={`Actions for ${row.title}`}
              style={style}
              className={`admin-theme admin-dropdown-panel ${dropdownPanelSurfaceClassName} p-1.5`}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
            >
              <StatusMenuItem
                current={row.status}
                target="PUBLISHED"
                icon={Send}
                label="Publish"
                onSelect={() => {
                  onClose();
                  onChangeStatus(row, "PUBLISHED");
                }}
              />
              <StatusMenuItem
                current={row.status}
                target="DRAFT"
                icon={FileStack}
                label="Move to draft"
                onSelect={() => {
                  onClose();
                  onChangeStatus(row, "DRAFT");
                }}
              />
              <StatusMenuItem
                current={row.status}
                target="ARCHIVED"
                icon={Archive}
                label="Archive"
                onSelect={() => {
                  onClose();
                  onChangeStatus(row, "ARCHIVED");
                }}
              />
              <div className="my-1 h-px bg-[var(--admin-border)]" />
              <button
                type="button"
                role="menuitem"
                className={manageDropdownItemClassName}
                onClick={() => {
                  onClose();
                  onCopySlug(row.slug);
                }}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy slug
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function StatusMenuItem({
  current,
  target,
  icon: Icon,
  label,
  onSelect,
}: {
  current: string;
  target: string;
  icon: typeof Layers;
  label: string;
  onSelect: () => void;
}) {
  const isCurrent = current.toUpperCase() === target;
  return (
    <button
      type="button"
      role="menuitem"
      disabled={isCurrent}
      className={manageDropdownItemClassName}
      onClick={onSelect}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {isCurrent ? (
        <Check className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
      ) : null}
    </button>
  );
}
