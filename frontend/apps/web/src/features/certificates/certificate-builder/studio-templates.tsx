"use client";

/**
 * Certificate Studio Templates — Use a template gallery.
 *
 * Design read: Dark studio chrome + cream paper artifacts for academy admins.
 * Teal primary. Favorites + local usage (no fake “Used 2.4k” stats).
 */

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User, Menu, X, Plus, Star, ChevronDown, LayoutTemplate } from "lucide-react";
import {
  GALLERY_CATEGORY_CHIPS,
  type GalleryCategory,
  type StarterTemplate,
  getGalleryStarters,
  STARTER_TEMPLATES,
} from "./starter-templates";
import { STUDIO_NAV_ITEMS } from "./studio-nav";
import { StudioDocPreview } from "./studio-doc-preview";
import {
  bumpTemplateUsage,
  formatUsageLabel,
  loadTemplateFavorites,
  loadTemplateUsage,
  saveTemplateFavorites,
} from "./studio-template-prefs";
import "./studio-home.css";
import "./studio-templates.css";

type FilterId = GalleryCategory | "most-used" | "favorites";

type CertificateStudioTemplatesProps = {
  publicName: string;
  onUseTemplate: (starter: StarterTemplate) => void;
  onBlank: () => void;
};

const FILTER_CHIPS: Array<{ id: FilterId; label: string }> = [
  ...GALLERY_CATEGORY_CHIPS,
  { id: "most-used", label: "Most used" },
  { id: "favorites", label: "Favorites" },
];

const PAGE_SIZE = 10;

export function CertificateStudioTemplates({
  publicName,
  onUseTemplate,
  onBlank,
}: CertificateStudioTemplatesProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});

  const fontClass = `font-plus-jakarta-sans font-cormorant font-jetbrains-mono`;

  useEffect(() => {
    setFavorites(loadTemplateFavorites());
    setUsage(loadTemplateUsage());
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, search]);

  const gallery = useMemo(() => {
    let list: StarterTemplate[];

    if (filter === "favorites") {
      list = STARTER_TEMPLATES.filter((s) => favorites.includes(s.id));
    } else if (filter === "most-used") {
      list = STARTER_TEMPLATES.filter((s) => (usage[s.id] ?? 0) > 0).sort(
        (a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0),
      );
    } else if (filter === "all") {
      const blank = STARTER_TEMPLATES.find((s) => s.id === "blank-canvas");
      const rest = getGalleryStarters("all");
      list = blank ? [blank, ...rest] : rest;
    } else {
      list = getGalleryStarters(filter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, search, favorites, usage]);

  const visible = gallery.slice(0, visibleCount);
  const canLoadMore = visibleCount < gallery.length;

  const toggleFavorite = useCallback((event: MouseEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveTemplateFavorites(next);
      return next;
    });
  }, []);

  const handleUse = useCallback(
    (starter: StarterTemplate) => {
      setUsage(bumpTemplateUsage(starter.id));
      onUseTemplate(starter);
    },
    [onUseTemplate],
  );

  return (
    <div className={`cert-tpl ${fontClass}`}>
      <button
        type="button"
        className="cert-tpl__menu-btn"
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={sidebarOpen}
        onClick={() => {
          setSidebarOpen((o) => !o);
        }}
      >
        {sidebarOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
      </button>

      <div
        className="cert-tpl__backdrop"
        data-open={sidebarOpen ? "true" : "false"}
        onClick={() => {
          setSidebarOpen(false);
        }}
        aria-hidden
      />

      <aside className="cert-tpl__aside" data-open={sidebarOpen ? "true" : "false"}>
        <div className="cert-tpl__brand">
          <h1 className="cert-tpl__brand-title">Studio Chrome</h1>
          <p className="cert-tpl__brand-sub">Professional Edition</p>
        </div>

        <nav className="cert-tpl__nav" aria-label="Certificate studio">
          {STUDIO_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                className="cert-tpl__nav-link"
                data-active={active ? "true" : "false"}
                onClick={() => {
                  setSidebarOpen(false);
                }}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link href="/settings" className="cert-tpl__account" title="Account settings">
          <span className="cert-tpl__account-avatar" aria-hidden>
            <User size={22} strokeWidth={1.75} />
          </span>
          <span>
            <p className="cert-tpl__account-name">{publicName || "Academy admin"}</p>
            <p className="cert-tpl__account-role">Team Admin</p>
          </span>
        </Link>
      </aside>

      <main className="cert-tpl__main">
        <header className="cert-tpl__header">
          <div>
            <h2 className="cert-tpl__title">Templates</h2>
            <p className="cert-tpl__subtitle">Choose a blueprint or start from scratch.</p>
          </div>
          <div className="cert-tpl__header-actions">
            <label className="cert-tpl__search">
              <Search className="cert-tpl__search-icon" size={18} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">Search templates</span>
              <input
                className="cert-tpl__search-input"
                type="search"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
              />
            </label>
            <button type="button" className="cert-tpl__blank-btn" onClick={onBlank}>
              <Plus size={18} strokeWidth={2.25} aria-hidden />
              Create blank
            </button>
          </div>
        </header>

        <div className="cert-tpl__chips" role="tablist" aria-label="Template categories">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={filter === chip.id}
              className="cert-tpl__chip"
              data-active={filter === chip.id ? "true" : "false"}
              onClick={() => {
                setFilter(chip.id);
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="cert-tpl__empty">
            <LayoutTemplate size={32} strokeWidth={1.5} aria-hidden />
            <p>
              {filter === "favorites"
                ? "No favorites yet. Star a template to keep it here."
                : filter === "most-used"
                  ? "No usage yet. Open a template to build this list."
                  : "No templates match your search."}
            </p>
          </div>
        ) : (
          <div className="cert-tpl__grid">
            {visible.map((starter) => {
              const isFav = favorites.includes(starter.id);
              const usageLabel = formatUsageLabel(usage[starter.id]);
              return (
                <article key={starter.id} className="cert-tpl__card">
                  <div
                    className="cert-tpl__artifact"
                    onClick={() => {
                      handleUse(starter);
                    }}
                  >
                    <div className="cert-tpl__preview">
                      <StudioDocPreview document={starter.document} />
                    </div>
                    <button
                      type="button"
                      className="cert-tpl__fav"
                      data-active={isFav ? "true" : "false"}
                      aria-label={isFav ? `Unfavorite ${starter.name}` : `Favorite ${starter.name}`}
                      aria-pressed={isFav}
                      onClick={(e) => {
                        toggleFavorite(e, starter.id);
                      }}
                    >
                      <Star
                        size={18}
                        strokeWidth={1.75}
                        fill={isFav ? "currentColor" : "none"}
                        aria-hidden
                      />
                    </button>
                    <div className="cert-tpl__overlay">
                      <button
                        type="button"
                        className="cert-tpl__use-btn"
                        onClick={() => {
                          handleUse(starter);
                        }}
                      >
                        Use template
                      </button>
                    </div>
                  </div>
                  <div className="cert-tpl__meta">
                    <div className="cert-tpl__meta-row">
                      <h3 className="cert-tpl__meta-name">
                        <button
                          type="button"
                          style={{
                            all: "unset",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            handleUse(starter);
                          }}
                        >
                          {starter.name}
                        </button>
                      </h3>
                      {usageLabel ? (
                        <span className="cert-tpl__meta-usage">{usageLabel}</span>
                      ) : (
                        <span className="cert-tpl__meta-usage">{starter.category}</span>
                      )}
                    </div>
                    <p className="cert-tpl__meta-desc">{starter.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {canLoadMore ? (
          <div className="cert-tpl__load-more">
            <button
              type="button"
              className="cert-tpl__load-more-btn"
              onClick={() => {
                setVisibleCount((n) => n + PAGE_SIZE);
              }}
            >
              Load more templates
              <ChevronDown size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
