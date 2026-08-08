"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import {
  dropdownPanelEnterBottomClassName,
  dropdownPanelEnterClassName,
} from "../lib/dropdown-motion";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  id?: string;
  /** Accessible label for the trigger (used when there is no visible <label>). */
  ariaLabel?: string;
  /** Associates the trigger with an external <label htmlFor>. */
  ariaLabelledby?: string;
  placeholder?: string;
  /** Extra classes for the trigger button (carries theme colors). */
  className?: string;
  /** Extra classes for the portal menu surface. */
  contentClassName?: string;
};

type Placement = "bottom" | "top";
type MenuPosition = { top: number; left: number; width: number; placement: Placement };

const MENU_MAX_HEIGHT = 256;

/**
 * Accessible custom select. The trigger stays inside the themed tree (so it can
 * use scoped CSS variables), while the listbox renders in a portal with a neutral
 * palette — matching DropdownMenu, since portals escape the themed container.
 * The chevron rotates with the open state and the menu animates in (both honor
 * prefers-reduced-motion).
 */
export function Select({
  value,
  onValueChange,
  options,
  disabled = false,
  id,
  ariaLabel,
  ariaLabelledby,
  placeholder = "Select…",
  className,
  contentClassName,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [highlight, setHighlight] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const selectedLabel = selectedOption?.label ?? placeholder;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placement: Placement =
      spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow ? "top" : "bottom";
    setPosition({
      top: placement === "bottom" ? rect.bottom + 6 : rect.top - 6,
      left: rect.left,
      width: rect.width,
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onScroll(event: Event) {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onResize() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = optionRefs.current[highlight];
    node?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const firstEnabledIndex = useCallback(
    (from: number, direction: 1 | -1): number => {
      const count = options.length;
      if (count === 0) return -1;
      let index = from;
      for (let step = 0; step < count; step += 1) {
        index = (index + direction + count) % count;
        if (!options[index]?.disabled) return index;
      }
      return -1;
    },
    [options],
  );

  function openMenu() {
    if (disabled) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    const initial =
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : firstEnabledIndex(-1, 1);
    setHighlight(initial < 0 ? 0 : initial);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        closeMenu();
        break;
      case "Tab":
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setHighlight((current) => {
          const next = firstEnabledIndex(current, 1);
          return next < 0 ? current : next;
        });
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlight((current) => {
          const next = firstEnabledIndex(current, -1);
          return next < 0 ? current : next;
        });
        break;
      case "Home":
        event.preventDefault();
        setHighlight(() => {
          const next = firstEnabledIndex(-1, 1);
          return next < 0 ? 0 : next;
        });
        break;
      case "End":
        event.preventDefault();
        setHighlight(() => {
          const next = firstEnabledIndex(options.length, -1);
          return next < 0 ? 0 : next;
        });
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(highlight);
        break;
      default:
        break;
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && options[highlight] ? `${listboxId}-opt-${highlight}` : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        <span className={cn("truncate", selectedOption ? "" : "opacity-60")}>{selectedLabel}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 ease-out motion-reduce:transition-none",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden="true"
        />
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              tabIndex={-1}
              style={{
                top: position.placement === "bottom" ? position.top : undefined,
                bottom:
                  position.placement === "top"
                    ? window.innerHeight - position.top
                    : undefined,
                left: position.left,
                width: position.width,
                maxHeight: MENU_MAX_HEIGHT,
              }}
              className={cn(
                "fixed z-[80] overflow-auto overscroll-contain rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900",
                position.placement === "top"
                  ? dropdownPanelEnterBottomClassName
                  : dropdownPanelEnterClassName,
                contentClassName,
              )}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlight;
                return (
                  <button
                    key={option.value}
                    id={`${listboxId}-opt-${index}`}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => {
                      commit(index);
                    }}
                    onMouseEnter={() => {
                      if (!option.disabled) setHighlight(index);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      isHighlighted
                        ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                        : "text-neutral-700 dark:text-neutral-200",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-neutral-900 dark:text-neutral-100" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
