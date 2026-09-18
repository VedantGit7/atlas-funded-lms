"use client";

/**
 * Certificate Studio shell — dark canvas editor chrome.
 *
 * Topbar, icon left rail (Elements / Layers / Brand / Page), dotted stage with
 * magic bar, right inspector, and status bar. Konva canvas loads client-only.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { observer } from "mobx-react-lite";
import { onSnapshot } from "mobx-state-tree";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  ArrowLeft,
  ChevronDown,
  CirclePlus,
  Cloud,
  CloudOff,
  Copy,
  Grid3x3,
  Home,
  Image,
  Layers,
  LayoutTemplate,
  Lock,
  LockOpen,
  Maximize2,
  PenLine,
  QrCode,
  Redo2,
  Ruler,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import { clientApi } from "../../../lib/client-api";
import "./studio-chrome.css";
import {
  AlignToolbar,
  ElementInspector,
  FONT_FAMILIES,
  PageSetupPanel,
} from "./studio-shell-inspector";
import {
  STUDIO_DEFAULT_SWATCHES,
  STUDIO_LOGO_URL,
  studioChromeStyleVars,
} from "./studio-visual-system";
import { createStudioStore, type ElementInstance, type StudioStoreInstance } from "./studio-store";
import { StudioDocPreview } from "./studio-doc-preview";
import { formatPageSize } from "./studio-units";
import { STARTER_TEMPLATES, getHomeStarters, type StarterTemplate } from "./starter-templates";

const CertificateStudioCanvas = dynamic(
  () => import("./studio-canvas").then((mod) => ({ default: mod.CertificateStudioCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="cert-studio__canvas-loading cert-studio__muted">Preparing canvas…</div>
    ),
  },
);

type LeftTab = "elements" | "layers" | "brand" | "page";

type SaveStatus = "synced" | "unsaved" | "saving" | "error";

export type CertificateStudioShellProps = {
  initialDocument?: CertificateDesignDocument;
  initialTemplateName?: string;
  brandName?: string;
  templateId?: string;
  /**
   * Stable per-design identity for the local autosave draft. Distinct starters
   * and new sessions must pass distinct ids so their drafts never collide. When
   * omitted, falls back to the template id (or "new").
   */
  autosaveId?: string;
  documentUpdatedAt?: string;
  onSave?: (doc: CertificateDesignDocument, name: string) => void;
  onPublish?: (doc: CertificateDesignDocument, name: string) => void;
  onBackHome?: () => void;
  saveStatus?: SaveStatus;
  /** Fired when the document changes after initial load (parent-owned saveStatus). */
  onDirty?: () => void;
};

const AUTOSAVE_DEBOUNCE_MS = 2000;
const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200] as const;
const HOME_TEMPLATE_PREVIEW_COUNT = 2;

const LEFT_TABS: {
  id: LeftTab;
  label: string;
  icon: typeof LayoutTemplate;
}[] = [
  { id: "elements", label: "Elements", icon: LayoutTemplate },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "brand", label: "Brand", icon: PenLine },
  { id: "page", label: "Page", icon: Maximize2 },
];

type AutosaveDraft = {
  savedAt: number;
  name: string;
  doc: CertificateDesignDocument;
};

type BrandKitSummary = {
  id: string;
  name: string;
  logoUrl: string | null;
  colors: Array<{ name: string; hex: string }>;
};

const ELEMENT_LAYER_ICON: Record<ElementInstance["type"], typeof Type> = {
  text: Type,
  shape: Square,
  image: Image,
  qr: QrCode,
  signature: PenLine,
};

function autosaveStorageKey(draftId: string): string {
  return `certificate-studio:autosave:${draftId}`;
}

function readAutosaveDraft(draftId: string): AutosaveDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(autosaveStorageKey(draftId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<AutosaveDraft>;
    if (typeof candidate.savedAt !== "number" || !candidate.doc) return null;
    return {
      savedAt: candidate.savedAt,
      name: typeof candidate.name === "string" ? candidate.name : "",
      doc: candidate.doc,
    };
  } catch {
    return null;
  }
}

function isModKey(event: KeyboardEvent | React.KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function syncStatusLabel(status: SaveStatus): string {
  switch (status) {
    case "synced":
      return "Synced";
    case "unsaved":
      return "Unsaved changes";
    case "saving":
      return "Saving…";
    case "error":
      return "Save failed";
    default:
      return "Synced";
  }
}

function StarterPaperThumb({
  starter,
  onSelect,
}: {
  starter: StarterTemplate;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="cert-studio__starter-thumb"
      title={starter.description}
      onClick={onSelect}
    >
      <div
        className="cert-studio__starter-thumb-inner"
        style={{ inset: 0, border: "none", padding: 0 }}
      >
        <StudioDocPreview document={starter.document} />
      </div>
      <div className="cert-studio__starter-thumb-title">{starter.name}</div>
    </button>
  );
}

export const CertificateStudioShell = observer(function CertificateStudioShell({
  initialDocument,
  initialTemplateName,
  brandName,
  templateId,
  autosaveId,
  documentUpdatedAt,
  onSave,
  onPublish,
  onBackHome,
  saveStatus: saveStatusProp,
  onDirty,
}: CertificateStudioShellProps) {
  const brandLabel = brandName && brandName.trim().length > 0 ? brandName : "Academy brand";
  const draftId = autosaveId ?? templateId ?? "new";
  const storeRef = useRef<StudioStoreInstance | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createStudioStore(initialDocument);
    if (initialTemplateName) storeRef.current.setTemplateName(initialTemplateName);
  }
  const store = storeRef.current;

  const [activeTab, setActiveTab] = useState<LeftTab>("elements");
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState<SaveStatus>("synced");
  const [brandKits, setBrandKits] = useState<BrandKitSummary[]>([]);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const skipFirstSnapshotRef = useRef(true);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const onDirtyRef = useRef(onDirty);
  onDirtyRef.current = onDirty;

  const rootStyle = useMemo(() => studioChromeStyleVars(), []);
  const effectiveSaveStatus = saveStatusProp ?? localSaveStatus;

  const [preview, setPreview] = useState<{
    open: boolean;
    loading: boolean;
    html: string;
    error: string | null;
  }>({ open: false, loading: false, html: "", error: null });

  const homeStarters = useMemo(() => getHomeStarters(), []);
  const templateList = showAllTemplates
    ? STARTER_TEMPLATES
    : homeStarters.slice(0, HOME_TEMPLATE_PREVIEW_COUNT);
  const canViewAllTemplates = STARTER_TEMPLATES.length > HOME_TEMPLATE_PREVIEW_COUNT;

  const selectedKit = brandKits.find((kit) => kit.id === selectedKitId) ?? null;
  const brandSwatches = useMemo(() => {
    if (selectedKit && selectedKit.colors.length > 0) {
      return selectedKit.colors.map((color) => ({ color: color.hex, label: color.name }));
    }
    return STUDIO_DEFAULT_SWATCHES;
  }, [selectedKit]);
  const brandLogoUrl = selectedKit?.logoUrl ?? STUDIO_LOGO_URL;

  useEffect(() => {
    const draft = readAutosaveDraft(draftId);
    if (!draft) return;
    const loadedAt = documentUpdatedAt ? Date.parse(documentUpdatedAt) : Number.NaN;
    const isNewer = Number.isNaN(loadedAt) || draft.savedAt > loadedAt;
    if (!isNewer) return;
    store.loadDocument(draft.doc);
    if (draft.name) store.setTemplateName(draft.name);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const dispose = onSnapshot(store.doc, () => {
      if (skipFirstSnapshotRef.current) {
        skipFirstSnapshotRef.current = false;
        return;
      }
      if (saveStatusProp === undefined) {
        setLocalSaveStatus("unsaved");
      } else {
        onDirtyRef.current?.();
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const draft: AutosaveDraft = {
          savedAt: Date.now(),
          name: store.templateName,
          doc: store.toDocument(),
        };
        try {
          window.localStorage.setItem(autosaveStorageKey(draftId), JSON.stringify(draft));
        } catch {
          // Best-effort autosave.
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      dispose();
    };
  }, [draftId, saveStatusProp]);

  useEffect(() => {
    let cancelled = false;
    void clientApi
      .get<{ data: BrandKitSummary[] }>("/api/v1/certificate-brand-kits")
      .then((response) => {
        if (cancelled) return;
        setBrandKits(response.data);
        if (response.data.length > 0) {
          setSelectedKitId((current) => {
            if (current) return current;
            const bound = store.doc.brandKitRef;
            if (bound && response.data.some((kit) => kit.id === bound)) return bound;
            return response.data[0]?.id ?? null;
          });
        }
      })
      .catch(() => {
        // Brand kits are optional; fall back to defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!zoomOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(event.target as Node)) {
        setZoomOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [zoomOpen]);

  const selected = store.singleSelected;
  const selectionCount = store.selectedElementIds.length;
  const selectedText = selected?.type === "text" ? selected : undefined;
  const selectedElementLocked = selected?.locked ?? false;
  const zoomPercent = Math.round(store.zoom * 100);

  const handleSave = useCallback(() => {
    const doc = store.toDocument();
    if (onSave) onSave(doc, store.templateName);
    else console.info("[certificate-studio] save", store.templateName, doc);
  }, [onSave, store]);

  const handlePublish = useCallback(() => {
    const doc = store.toDocument();
    if (onPublish) onPublish(doc, store.templateName);
    else console.info("[certificate-studio] publish", store.templateName, doc);
  }, [onPublish, store]);

  const handlePreview = useCallback(() => {
    store.clearSelection();
    const doc = store.toDocument();
    setPreview({ open: true, loading: true, html: "", error: null });
    void (async () => {
      try {
        const { renderCertificatePreviewHtml } = await import("./render/render-certificate");
        const { sampleDataFromVariables } = await import("./render/design-to-html");
        const { html } = await renderCertificatePreviewHtml(doc, sampleDataFromVariables(doc), {
          watermark: true,
          showBleedSafe: store.showGuides,
        });
        setPreview({ open: true, loading: false, html, error: null });
      } catch (error) {
        setPreview({
          open: true,
          loading: false,
          html: "",
          error: error instanceof Error ? error.message : "Failed to render preview.",
        });
      }
    })();
  }, [store]);

  const closePreview = useCallback(() => {
    setPreview({ open: false, loading: false, html: "", error: null });
  }, []);

  const handleAddImage = useCallback(() => {
    const url = window.prompt("Image URL");
    if (url && url.trim().length > 0) store.addImage(url.trim());
  }, [store]);

  const applyStarter = useCallback(
    (starter: StarterTemplate) => {
      const ok =
        store.doc.elements.length === 0 ||
        window.confirm(
          `Replace the current design with “${starter.name}”? Unsaved canvas work will be lost.`,
        );
      if (!ok) return;
      store.loadDocument(starter.document);
      store.setTemplateName(starter.name);
    },
    [store],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable === true;

      if (isModKey(event) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
        return;
      }

      if (isEditable) return;

      if (isModKey(event) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        store.undo();
        return;
      }

      if (isModKey(event) && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        store.redo();
        return;
      }

      if (isModKey(event) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        store.duplicateSelected();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        store.deleteSelected();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        store.clearSelection();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleSave, store]);

  const syncRowClass =
    effectiveSaveStatus === "saving"
      ? "cert-studio__sync-row is-saving"
      : effectiveSaveStatus === "error"
        ? "cert-studio__sync-row is-error"
        : effectiveSaveStatus === "unsaved"
          ? "cert-studio__sync-row is-dirty"
          : "cert-studio__sync-row";

  const syncDotClass =
    effectiveSaveStatus === "error"
      ? "cert-studio__sync-dot is-error"
      : effectiveSaveStatus === "unsaved"
        ? "cert-studio__sync-dot is-dirty"
        : effectiveSaveStatus === "saving"
          ? "cert-studio__sync-dot is-pulse"
          : "cert-studio__sync-dot";

  return (
    <div className="cert-studio" style={rootStyle}>
      {preview.open ? (
        <div
          className="cert-studio__preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Certificate preview"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <div className="cert-studio__preview-modal">
            <div className="cert-studio__preview-header">
              <span>Preview — {store.templateName || "Untitled certificate"}</span>
              <div className="cert-studio__preview-header-actions">
                <button
                  type="button"
                  className="cert-studio__btn cert-studio__btn--ghost"
                  onClick={handlePreview}
                  disabled={preview.loading}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="cert-studio__btn"
                  onClick={closePreview}
                  aria-label="Close preview"
                >
                  Close
                </button>
              </div>
            </div>
            {preview.error ? (
              <p className="cert-studio__preview-error" role="alert">
                {preview.error}
              </p>
            ) : preview.loading ? (
              <div className="cert-studio__canvas-loading cert-studio__muted">
                Rendering preview…
              </div>
            ) : (
              <iframe
                className="cert-studio__preview-frame"
                title="Certificate preview"
                srcDoc={preview.html}
                sandbox=""
              />
            )}
          </div>
        </div>
      ) : null}

      {helpOpen ? (
        <div
          className="cert-studio__help-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
        >
          <div className="cert-studio__help-modal">
            <h2>Keyboard shortcuts</h2>
            <ul className="cert-studio__help-list">
              <li>
                <span>Save</span>
                <kbd>
                  {typeof navigator !== "undefined" && navigator.platform.includes("Mac")
                    ? "⌘"
                    : "Ctrl"}
                  +S
                </kbd>
              </li>
              <li>
                <span>Undo</span>
                <kbd>
                  {typeof navigator !== "undefined" && navigator.platform.includes("Mac")
                    ? "⌘"
                    : "Ctrl"}
                  +Z
                </kbd>
              </li>
              <li>
                <span>Redo</span>
                <kbd>
                  {typeof navigator !== "undefined" && navigator.platform.includes("Mac")
                    ? "⌘"
                    : "Ctrl"}
                  +Shift+Z
                </kbd>
              </li>
              <li>
                <span>Duplicate selection</span>
                <kbd>
                  {typeof navigator !== "undefined" && navigator.platform.includes("Mac")
                    ? "⌘"
                    : "Ctrl"}
                  +D
                </kbd>
              </li>
              <li>
                <span>Delete selection</span>
                <kbd>Delete</kbd>
              </li>
              <li>
                <span>Clear selection</span>
                <kbd>Esc</kbd>
              </li>
            </ul>
            <button
              type="button"
              className="cert-studio__btn cert-studio__btn--block"
              style={{ marginTop: 20 }}
              onClick={() => {
                setHelpOpen(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <header className="cert-studio__topbar">
        <div className="cert-studio__topbar-left">
          {onBackHome ? (
            <>
              <button
                type="button"
                className="cert-studio__icon-hit"
                onClick={onBackHome}
                aria-label="Back to Certificate Studio Home"
              >
                <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="cert-studio__icon-hit"
                onClick={onBackHome}
                aria-label="Go to Home screen"
              >
                <Home size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className="cert-studio__divider-v" aria-hidden="true" />
            </>
          ) : null}
          <div className="cert-studio__title-block">
            <input
              className="cert-studio__name-input"
              aria-label="Template name"
              value={store.templateName}
              onChange={(event) => {
                store.setTemplateName(event.target.value);
              }}
              placeholder="Untitled certificate"
            />
            <div className={syncRowClass}>
              {effectiveSaveStatus === "synced" || effectiveSaveStatus === "saving" ? (
                <Cloud size={12} strokeWidth={2} aria-hidden="true" />
              ) : (
                <CloudOff size={12} strokeWidth={2} aria-hidden="true" />
              )}
              <span className="cert-studio__label-mono">
                {syncStatusLabel(effectiveSaveStatus)}
              </span>
            </div>
          </div>
        </div>

        <div className="cert-studio__topbar-right">
          <div className="cert-studio__undo-cluster" role="group" aria-label="History">
            <button
              type="button"
              className="cert-studio__icon-hit"
              onClick={() => {
                store.undo();
              }}
              disabled={!store.canUndo}
              aria-label="Undo"
            >
              <Undo2 size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cert-studio__icon-hit"
              onClick={() => {
                store.redo();
              }}
              disabled={!store.canRedo}
              aria-label="Redo"
            >
              <Redo2 size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <span className="cert-studio__divider-v" aria-hidden="true" />

          <button
            type="button"
            className="cert-studio__icon-hit"
            aria-pressed={store.showGrid}
            aria-label="Toggle grid"
            onClick={() => {
              store.toggleGrid();
            }}
          >
            <Grid3x3 size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="cert-studio__icon-hit"
            aria-pressed={store.showGuides}
            aria-label="Toggle guides"
            onClick={() => {
              store.toggleGuides();
            }}
          >
            <Ruler size={16} strokeWidth={2} aria-hidden="true" />
          </button>

          <div className="cert-studio__zoom-menu" ref={zoomMenuRef}>
            <button
              type="button"
              className="cert-studio__zoom-trigger"
              aria-expanded={zoomOpen}
              aria-haspopup="listbox"
              onClick={() => {
                setZoomOpen((open) => !open);
              }}
            >
              {store.zoomMode === "fit" ? `Fit · ${zoomPercent}%` : `${zoomPercent}%`}
              <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            {zoomOpen ? (
              <div className="cert-studio__zoom-dropdown" role="listbox" aria-label="Zoom presets">
                <button
                  type="button"
                  role="option"
                  aria-selected={store.zoomMode === "fit"}
                  className={store.zoomMode === "fit" ? "is-active" : undefined}
                  onClick={() => {
                    store.requestFitZoom();
                    setZoomOpen(false);
                  }}
                >
                  Fit to screen
                </button>
                {ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    role="option"
                    aria-selected={store.zoomMode === "fixed" && zoomPercent === preset}
                    className={
                      store.zoomMode === "fixed" && zoomPercent === preset ? "is-active" : undefined
                    }
                    onClick={() => {
                      store.setZoom(preset / 100);
                      setZoomOpen(false);
                    }}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm"
            aria-pressed={store.proofMode}
            onClick={() => {
              store.setProofMode(!store.proofMode);
            }}
            title="Show sample variable values instead of {{tokens}}"
          >
            Proof
          </button>

          <span className="cert-studio__divider-v" aria-hidden="true" />

          <button
            type="button"
            className="cert-studio__btn cert-studio__btn--ghost"
            onClick={handlePreview}
          >
            Preview
          </button>
          <button
            type="button"
            className="cert-studio__btn cert-studio__btn--ghost"
            onClick={handleSave}
          >
            Save
          </button>
          <button
            type="button"
            className="cert-studio__btn cert-studio__btn--primary"
            onClick={handlePublish}
          >
            Publish
          </button>
        </div>
      </header>

      <aside className="cert-studio__left">
        <div className="cert-studio__tabs" role="tablist" aria-label="Left panels">
          {LEFT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`cert-tab-${id}`}
              aria-selected={activeTab === id}
              aria-controls={`cert-panel-${id}`}
              className={`cert-studio__tab${activeTab === id ? " is-active" : ""}`}
              onClick={() => {
                setActiveTab(id);
              }}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div
          className="cert-studio__panel"
          role="tabpanel"
          id={`cert-panel-${activeTab}`}
          aria-labelledby={`cert-tab-${activeTab}`}
        >
          {activeTab === "elements" ? (
            <>
              <div className="cert-studio__panel-body">
                <section className="cert-studio__section">
                  <div className="cert-studio__section-head">
                    <span className="cert-studio__label-mono">Add elements</span>
                  </div>
                  <div className="cert-studio__element-grid" role="group" aria-label="Add elements">
                    <button
                      type="button"
                      className="cert-studio__element-tile"
                      onClick={() => {
                        store.addText();
                      }}
                    >
                      <Type size={18} strokeWidth={1.75} aria-hidden="true" />
                      Text
                    </button>
                    <button
                      type="button"
                      className="cert-studio__element-tile"
                      onClick={() => {
                        store.addShape("rect");
                      }}
                    >
                      <Square size={18} strokeWidth={1.75} aria-hidden="true" />
                      Shape
                    </button>
                    <button
                      type="button"
                      className="cert-studio__element-tile"
                      onClick={handleAddImage}
                    >
                      <Image size={18} strokeWidth={1.75} aria-hidden="true" />
                      Image
                    </button>
                    <button
                      type="button"
                      className="cert-studio__element-tile"
                      onClick={() => {
                        store.addQr();
                      }}
                    >
                      <QrCode size={18} strokeWidth={1.75} aria-hidden="true" />
                      QR
                    </button>
                    <button
                      type="button"
                      className="cert-studio__element-tile"
                      onClick={() => {
                        store.addSignature();
                      }}
                    >
                      <PenLine size={18} strokeWidth={1.75} aria-hidden="true" />
                      Sign
                    </button>
                    <button
                      type="button"
                      className="cert-studio__element-tile"
                      onClick={() => {
                        store.addHeading();
                      }}
                    >
                      <Type size={18} strokeWidth={2} aria-hidden="true" />
                      Heading
                    </button>
                  </div>
                </section>

                <section className="cert-studio__section">
                  <div className="cert-studio__section-head">
                    <span className="cert-studio__label-mono">Templates</span>
                    {canViewAllTemplates ? (
                      <button
                        type="button"
                        className="cert-studio__link-teal"
                        onClick={() => {
                          setShowAllTemplates((value) => !value);
                        }}
                      >
                        {showAllTemplates ? "Show less" : "View all"}
                      </button>
                    ) : null}
                  </div>
                  <div className="cert-studio__starter-list">
                    {templateList.map((starter) => (
                      <StarterPaperThumb
                        key={starter.id}
                        starter={starter}
                        onSelect={() => {
                          applyStarter(starter);
                        }}
                      />
                    ))}
                  </div>
                </section>
              </div>
              <button type="button" className="cert-studio__add-asset" onClick={handleAddImage}>
                <CirclePlus size={18} className="cert-studio__add-asset-icon" aria-hidden="true" />
                Add asset
              </button>
            </>
          ) : null}

          {activeTab === "layers" ? (
            <div className="cert-studio__panel-body">
              {store.layersTopFirst.length === 0 ? (
                <p className="cert-studio__muted">No elements yet.</p>
              ) : (
                <ul className="cert-studio__layers">
                  {store.layersTopFirst.map((element) => {
                    const LayerIcon = ELEMENT_LAYER_ICON[element.type];
                    return (
                      <li
                        key={element.id}
                        className={`cert-studio__layer${
                          store.isSelected(element.id) ? " is-selected" : ""
                        }${element.locked ? " is-locked" : ""}`}
                      >
                        <button
                          type="button"
                          className="cert-studio__layer-name"
                          onClick={() => {
                            store.setSelection([element.id]);
                          }}
                          title={element.name ?? element.type}
                        >
                          <span className="cert-studio__layer-icon" aria-hidden="true">
                            <LayerIcon size={12} strokeWidth={2} />
                          </span>
                          <span className="cert-studio__layer-label">
                            {element.name ?? element.type}
                          </span>
                        </button>
                        <span className="cert-studio__layer-actions">
                          <button
                            type="button"
                            className="cert-studio__icon-hit"
                            aria-pressed={element.hidden ? true : false}
                            aria-label={element.hidden ? "Show element" : "Hide element"}
                            onClick={() => {
                              store.toggleHidden(element.id);
                            }}
                          >
                            {element.hidden ? "◌" : "◉"}
                          </button>
                          <button
                            type="button"
                            className="cert-studio__icon-hit"
                            aria-pressed={element.locked ? true : false}
                            aria-label={element.locked ? "Unlock element" : "Lock element"}
                            onClick={() => {
                              store.toggleLock(element.id);
                            }}
                          >
                            {element.locked ? (
                              <Lock size={14} strokeWidth={2} aria-hidden="true" />
                            ) : (
                              <LockOpen size={14} strokeWidth={2} aria-hidden="true" />
                            )}
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {activeTab === "brand" ? (
            <div className="cert-studio__panel-body">
              <div className="cert-studio__brand-card">
                <img src={brandLogoUrl} alt="" width={40} height={40} />
                <div>
                  <div className="cert-studio__brand-name">{selectedKit?.name ?? brandLabel}</div>
                  <div className="cert-studio__muted">Brand kit</div>
                </div>
              </div>

              {brandKits.length > 0 ? (
                <div className="cert-studio__field" style={{ marginTop: 16 }}>
                  <label className="cert-studio__field-label" htmlFor="brand-kit-select">
                    Kit
                  </label>
                  <select
                    id="brand-kit-select"
                    className="cert-studio__input"
                    value={selectedKitId ?? ""}
                    onChange={(event) => {
                      const nextId = event.target.value || null;
                      setSelectedKitId(nextId);
                      store.setBrandKitRef(nextId);
                    }}
                  >
                    {brandKits.map((kit) => (
                      <option key={kit.id} value={kit.id}>
                        {kit.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <button
                type="button"
                className="cert-studio__btn cert-studio__btn--block"
                style={{ marginTop: 12 }}
                onClick={() => {
                  store.addImage(brandLogoUrl);
                }}
              >
                Apply logo
              </button>

              <div className="cert-studio__swatches" role="group" aria-label="Brand colors">
                {brandSwatches.map(({ color, label }) => (
                  <button
                    key={`brand-${label}-${color}`}
                    type="button"
                    className="cert-studio__swatch"
                    style={{ background: color }}
                    title={`${label} — apply to selection`}
                    aria-label={`Apply ${label} to selection`}
                    onClick={() => {
                      store.applyColorToSelection(color);
                    }}
                  />
                ))}
              </div>

              <Link
                href="/admin/certificates/brand-kit"
                className="cert-studio__link-teal"
                style={{ display: "inline-block", marginTop: 16 }}
              >
                Manage brand kit
              </Link>
            </div>
          ) : null}

          {activeTab === "page" ? (
            <div className="cert-studio__panel-body">
              <PageSetupPanel store={store} />
            </div>
          ) : null}
        </div>
      </aside>

      <section className="cert-studio__stage" aria-label="Certificate canvas">
        {selectedText ? (
          <div className="cert-studio__magic-bar" role="toolbar" aria-label="Quick text edits">
            <div className="cert-studio__magic-seg">
              <select
                aria-label="Font family"
                value={selectedText.fontFamily}
                onChange={(event) => {
                  store.updateElement(selectedText.id, { fontFamily: event.target.value });
                }}
              >
                {FONT_FAMILIES.some((font) => font.value === selectedText.fontFamily) ? null : (
                  <option value={selectedText.fontFamily}>{selectedText.fontFamily}</option>
                )}
                {FONT_FAMILIES.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="cert-studio__magic-seg">
              <input
                type="number"
                aria-label="Font size"
                min={1}
                value={selectedText.fontSize}
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  if (!Number.isNaN(value) && value > 0) {
                    store.updateElement(selectedText.id, { fontSize: value });
                  }
                }}
              />
            </div>
            <div className="cert-studio__magic-seg">
              <input
                type="color"
                className="cert-studio__magic-swatch"
                aria-label="Text color"
                value={selectedText.color}
                onChange={(event) => {
                  store.updateElement(selectedText.id, { color: event.target.value });
                }}
              />
            </div>
            <div className="cert-studio__magic-seg">
              <button
                type="button"
                className="cert-studio__icon-hit"
                aria-pressed={selectedText.align === "center"}
                aria-label="Align center"
                onClick={() => {
                  store.updateElement(selectedText.id, { align: "center" });
                }}
              >
                <AlignCenterHorizontal size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
        <CertificateStudioCanvas store={store} />
      </section>

      <aside className="cert-studio__right">
        <div className="cert-studio__panel">
          <div className="cert-studio__panel-header">Properties</div>
          <div className="cert-studio__inspector-scroll">
            {selectionCount >= 1 ? <AlignToolbar store={store} /> : null}
            {selected ? (
              <ElementInspector store={store} element={selected} swatches={brandSwatches} />
            ) : selectionCount > 1 ? (
              <p className="cert-studio__muted">{selectionCount} elements selected.</p>
            ) : (
              <p className="cert-studio__muted">Select an element to edit its properties.</p>
            )}
          </div>
          <div className="cert-studio__inspector-footer">
            <button
              type="button"
              aria-label="Duplicate selection"
              disabled={selectionCount === 0}
              onClick={() => {
                store.duplicateSelected();
              }}
            >
              <Copy size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="danger"
              aria-label="Delete selection"
              disabled={selectionCount === 0}
              onClick={() => {
                store.deleteSelected();
              }}
            >
              <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={selectedElementLocked ? "Unlock selection" : "Lock selection"}
              disabled={selectionCount === 0}
              onClick={() => {
                if (selectionCount === 1 && selected) {
                  store.toggleLock(selected.id);
                } else {
                  for (const id of store.selectedElementIds) {
                    const element = store.doc.elements.find((item) => item.id === id);
                    if (element && !element.locked) store.toggleLock(id);
                  }
                }
              }}
            >
              {selectedElementLocked ? (
                <Lock size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <LockOpen size={16} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </aside>

      <footer className="cert-studio__statusbar">
        <div className="cert-studio__statusbar-left">
          <span className="cert-studio__label-mono">
            {formatPageSize(store.doc.page)} · {store.doc.page.orientation}
          </span>
          <span className="cert-studio__label-mono cert-studio__statusbar-sel">
            {selectionCount} selected
          </span>
        </div>
        <div className="cert-studio__statusbar-right">
          <span className={syncDotClass} aria-hidden="true" />
          <span className="cert-studio__label-mono">{syncStatusLabel(effectiveSaveStatus)}</span>
          <button
            type="button"
            className="cert-studio__help-btn"
            onClick={() => {
              setHelpOpen(true);
            }}
          >
            Help &amp; shortcuts
          </button>
        </div>
      </footer>
    </div>
  );
});
