"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { Search, User, BookOpen, Pencil, Copy, Trash2, Menu, X, ChevronLeft } from "lucide-react";
import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import { TenantBrandMark } from "../../../components/patterns/TenantBrandMark";
import { ClientApiError } from "../../../lib/api/errors";
import { clientApi } from "../../../lib/client-api";
import {
  GALLERY_CATEGORY_CHIPS,
  type GalleryCategory,
  type StarterTemplate,
  getGalleryStarters,
  getHomeStarters,
} from "./starter-templates";
import {
  deleteTemplateDesign,
  duplicateTemplateDesign,
  isDesignDocument,
  listTemplates,
} from "./studio-template-api";
import { STUDIO_NAV_ITEMS } from "./studio-nav";
import { CERTIFICATE_STUDIO_TEMPLATES } from "./studio-routes";
import { StudioPaperPreview } from "./studio-paper-preview";
import { StudioDocPreview } from "./studio-doc-preview";
import "./studio-home.css";

const studioSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-studio-sans",
});

const studioDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  variable: "--font-studio-display",
});

const studioMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-studio-mono",
});

type TemplateStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

type RecentTemplate = {
  id: string;
  name: string;
  status: TemplateStatus;
  updatedAt: string;
  pageLabel: string;
  previewKind: StarterTemplate["previewKind"];
  document?: CertificateDesignDocument;
};

type BrandKitSummary = {
  name: string;
  logoUrl: string | null;
  colors: Array<{ name: string; hex: string }>;
};

type CertificateStudioHomeProps = {
  publicName: string;
  onOpenStudio: (args: {
    templateId?: string;
    name: string;
    document?: CertificateDesignDocument;
    updatedAt?: string;
    starterId?: string;
  }) => void;
};

const GALLERY_CHIPS = GALLERY_CATEGORY_CHIPS;

// No logo here: a shared default put tenant #1's monogram in every academy's
// brand kit. `TenantBrandMark` renders the tenant's own initials instead.
const DEFAULT_BRAND: BrandKitSummary = {
  name: "Default brand kit",
  logoUrl: null,
  colors: [
    { name: "Teal", hex: "#10D9A3" },
    { name: "Blue", hex: "#2E6BFF" },
    { name: "Gold", hex: "#D4AF37" },
  ],
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Edited recently";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Edited just now";
  if (mins < 60) return `Edited ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${new Date(iso).toLocaleDateString()}`;
}

function pageLabelFromDoc(doc: CertificateDesignDocument | undefined): string {
  if (!doc?.page) return "297x210mm";
  const { width, height, unit } = doc.page;
  return `${width}x${height}${unit}`;
}

function inferPreviewKind(
  doc: CertificateDesignDocument | undefined,
): StarterTemplate["previewKind"] {
  if (!doc) return "classic";
  const bg = doc.background.type === "color" ? doc.background.value.toLowerCase() : "";
  if (bg === "#0f1419") return "branded";
  const texts = doc.elements
    .filter((e) => e.type === "text")
    .map((e) => ("text" in e ? e.text.toLowerCase() : ""));
  if (texts.some((t) => t.includes("mastery"))) return "mastery";
  if (texts.some((t) => t.includes("legacy"))) return "legacy";
  if (texts.some((t) => t.includes("completion"))) return "completion";
  if (texts.some((t) => t.includes("participation"))) return "participation";
  if (texts.some((t) => t.includes("excellence"))) return "excellence";
  if (texts.some((t) => t.includes("recognition") || t.includes("appreciation")))
    return "recognition";
  if (texts.some((t) => t.includes("assessment") || t.includes("skill check"))) return "assessment";
  if (texts.some((t) => t.includes("learning path") || t.includes("track"))) return "path";
  if (texts.some((t) => t.includes("achievement"))) return "achievement";
  if (doc.elements.length === 0) return "blank";
  return "classic";
}

function statusBadgeClass(status: TemplateStatus): string {
  switch (status) {
    case "PUBLISHED":
      return "cert-home__badge cert-home__badge--published";
    case "REVIEW":
      return "cert-home__badge cert-home__badge--review";
    case "ARCHIVED":
      return "cert-home__badge cert-home__badge--archived";
    default:
      return "cert-home__badge cert-home__badge--draft";
  }
}

function statusLabel(status: TemplateStatus): string {
  switch (status) {
    case "PUBLISHED":
      return "Published";
    case "REVIEW":
      return "Review";
    case "ARCHIVED":
      return "Archived";
    default:
      return "Draft";
  }
}

export function CertificateStudioHome({ publicName, onOpenStudio }: CertificateStudioHomeProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [galleryFilter, setGalleryFilter] = useState<GalleryCategory>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recent, setRecent] = useState<RecentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKitSummary>(DEFAULT_BRAND);

  const fontClass = `${studioSans.variable} ${studioDisplay.variable} ${studioMono.variable}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templates, kitsRes] = await Promise.all([
        listTemplates(),
        clientApi
          .get<{
            data: Array<{
              name: string;
              logoUrl: string | null;
              colors: Array<{ name: string; hex: string }>;
            }>;
          }>("/api/v1/certificate-brand-kits")
          .catch(() => null),
      ]);

      const mapped: RecentTemplate[] = templates
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((t) => {
          const doc = isDesignDocument(t.templateJson) ? t.templateJson : undefined;
          return {
            id: t.id,
            name: t.name,
            status: t.status,
            updatedAt: t.updatedAt,
            pageLabel: pageLabelFromDoc(doc),
            previewKind: inferPreviewKind(doc),
            ...(doc ? { document: doc } : {}),
          };
        });
      setRecent(mapped);

      const firstKit = kitsRes?.data[0];
      if (firstKit) {
        setBrandKit({
          name: firstKit.name || DEFAULT_BRAND.name,
          logoUrl: firstKit.logoUrl || null,
          colors: firstKit.colors.length > 0 ? firstKit.colors.slice(0, 3) : DEFAULT_BRAND.colors,
        });
      }
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Failed to load studio designs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRecent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recent.slice(0, 6);
    return recent.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 12);
  }, [recent, search]);

  const homeStarters = useMemo(() => getHomeStarters(), []);
  const gallery = useMemo(() => getGalleryStarters(galleryFilter), [galleryFilter]);

  const openBlank = useCallback(() => {
    const blank = homeStarters.find((s) => s.id === "blank-canvas");
    onOpenStudio({
      name: `${publicName} certificate`,
      starterId: "blank-canvas",
      ...(blank?.document ? { document: blank.document } : {}),
    });
  }, [homeStarters, onOpenStudio, publicName]);

  const openStarter = useCallback(
    (starter: StarterTemplate) => {
      onOpenStudio({
        name: starter.name,
        starterId: starter.id,
        document: starter.document,
      });
    },
    [onOpenStudio],
  );

  const openRecent = useCallback(
    (item: RecentTemplate) => {
      onOpenStudio({
        templateId: item.id,
        name: item.name,
        ...(item.document ? { document: item.document } : {}),
        updatedAt: item.updatedAt,
      });
    },
    [onOpenStudio],
  );

  const handleDuplicate = useCallback(
    async (item: RecentTemplate) => {
      setBusyId(item.id);
      setError(null);
      try {
        const templates = await listTemplates();
        const source = templates.find((t) => t.id === item.id);
        if (!source) throw new Error("Template not found");
        const created = await duplicateTemplateDesign(source);
        await refresh();
        onOpenStudio({
          templateId: created.data.id,
          name: created.data.name,
          ...(isDesignDocument(created.data.templateJson)
            ? { document: created.data.templateJson }
            : {}),
          updatedAt: created.data.updatedAt,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Duplicate failed");
      } finally {
        setBusyId(null);
      }
    },
    [onOpenStudio, refresh],
  );

  const handleDelete = useCallback(
    async (item: RecentTemplate) => {
      if (!window.confirm(`Delete “${item.name}”? This cannot be undone.`)) return;
      setBusyId(item.id);
      setError(null);
      try {
        await deleteTemplateDesign(item.id);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return (
    <div className={`cert-home ${fontClass}`} style={{ fontFamily: "var(--ch-font-sans)" }}>
      <header className="cert-home__topbar">
        <div className="cert-home__topbar-left">
          <button
            type="button"
            className="cert-home__menu-btn"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            onClick={() => {
              setSidebarOpen((o) => !o);
            }}
          >
            {sidebarOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
          </button>
          <h1 className="cert-home__brand-title">Certificate Studio</h1>
          <label className="cert-home__search">
            <Search className="cert-home__search-icon" size={20} strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Search templates</span>
            <input
              className="cert-home__search-input"
              type="search"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
          </label>
        </div>
        <div className="cert-home__topbar-actions">
          <Link href="/admin/certificates" className="cert-home__back">
            <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
            Back
          </Link>
          <button type="button" className="cert-home__cta" onClick={openBlank}>
            Create new certificate
          </button>
          <Link
            href="/settings"
            className="cert-home__avatar"
            aria-label="Account settings"
            title={publicName}
          >
            <User size={20} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      </header>

      <div
        className="cert-home__backdrop"
        data-open={sidebarOpen ? "true" : "false"}
        onClick={() => {
          setSidebarOpen(false);
        }}
        aria-hidden
      />

      <aside className="cert-home__sidebar" data-open={sidebarOpen ? "true" : "false"}>
        <div className="cert-home__chrome">
          <div className="cert-home__chrome-icon">
            <BookOpen size={22} strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <div className="cert-home__chrome-title">Studio Chrome</div>
            <div className="cert-home__chrome-sub">Professional Edition</div>
          </div>
        </div>

        <nav className="cert-home__nav" aria-label="Certificate studio">
          {STUDIO_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                className="cert-home__nav-link"
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

        <div className="cert-home__brand-panel">
          <div className="cert-home__brand-label">{brandKit.name}</div>
          <div className="cert-home__swatches" aria-label="Brand colors">
            {brandKit.colors.map((c) => (
              <div
                key={`${c.name}-${c.hex}`}
                className="cert-home__swatch"
                style={{ background: c.hex }}
                title={c.name}
              />
            ))}
          </div>
          <div className="cert-home__logo-well">
            <TenantBrandMark logoUrl={brandKit.logoUrl} name={publicName} size={64} />
          </div>
        </div>
      </aside>

      <main className="cert-home__main">
        {error ? (
          <div className="cert-home__error" role="alert">
            {error}
          </div>
        ) : null}

        <section className="cert-home__section" aria-labelledby="start-design-heading">
          <div className="cert-home__section-head">
            <h2 id="start-design-heading" className="cert-home__h2">
              Start a new design
            </h2>
          </div>
          <div className="cert-home__paper-grid">
            {homeStarters.map((starter) => (
              <button
                key={starter.id}
                type="button"
                className="cert-home__paper-card"
                onClick={() => {
                  openStarter(starter);
                }}
              >
                <div className="cert-home__paper">
                  <StudioDocPreview document={starter.document} />
                </div>
                <div className="cert-home__paper-label">{starter.name}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="cert-home__section" aria-labelledby="recent-heading">
          <div className="cert-home__section-head">
            <h2 id="recent-heading" className="cert-home__h2">
              Recent Designs
            </h2>
            <Link href={CERTIFICATE_STUDIO_TEMPLATES} className="cert-home__link-btn">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="cert-home__recent-grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="cert-home__skeleton" aria-hidden />
              ))}
            </div>
          ) : filteredRecent.length === 0 ? (
            <div className="cert-home__empty">
              <p>
                {search.trim()
                  ? "No designs match your search."
                  : "No designs yet. Start from a blank canvas or a starter above."}
              </p>
              {!search.trim() ? (
                <button type="button" className="cert-home__cta" onClick={openBlank}>
                  Create new certificate
                </button>
              ) : null}
            </div>
          ) : (
            <div className="cert-home__recent-grid">
              {filteredRecent.map((item) => (
                <article key={item.id} className="cert-home__recent-card">
                  <div className="cert-home__recent-paper">
                    {item.document ? (
                      <StudioDocPreview document={item.document} />
                    ) : (
                      <StudioPaperPreview kind={item.previewKind} />
                    )}
                    <div className="cert-home__recent-overlay">
                      <button
                        type="button"
                        className="cert-home__icon-btn cert-home__icon-btn--primary"
                        aria-label={`Edit ${item.name}`}
                        disabled={busyId === item.id}
                        onClick={() => {
                          openRecent(item);
                        }}
                      >
                        <Pencil size={18} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="cert-home__icon-btn cert-home__icon-btn--muted"
                        aria-label={`Duplicate ${item.name}`}
                        disabled={busyId === item.id}
                        onClick={() => void handleDuplicate(item)}
                      >
                        <Copy size={18} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="cert-home__icon-btn cert-home__icon-btn--danger"
                        aria-label={`Delete ${item.name}`}
                        disabled={busyId === item.id}
                        onClick={() => void handleDelete(item)}
                      >
                        <Trash2 size={18} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="cert-home__recent-meta">
                    <div>
                      <h3 className="cert-home__recent-name">{item.name}</h3>
                      <div className="cert-home__recent-sub">
                        {formatRelativeTime(item.updatedAt)} · {item.pageLabel}
                      </div>
                    </div>
                    <span className={statusBadgeClass(item.status)}>
                      {statusLabel(item.status)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="cert-home__section" aria-labelledby="gallery-heading">
          <div className="cert-home__section-head">
            <h2 id="gallery-heading" className="cert-home__h2">
              Template Gallery
            </h2>
            <div className="cert-home__chips" role="tablist" aria-label="Gallery categories">
              {GALLERY_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={galleryFilter === chip.id}
                  className="cert-home__chip"
                  data-active={galleryFilter === chip.id ? "true" : "false"}
                  onClick={() => {
                    setGalleryFilter(chip.id);
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <div className="cert-home__paper-grid">
            {gallery.map((starter) => (
              <button
                key={starter.id}
                type="button"
                className="cert-home__paper-card"
                data-gallery="true"
                onClick={() => {
                  openStarter(starter);
                }}
              >
                <div className="cert-home__paper">
                  <StudioDocPreview document={starter.document} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
