"use client";

/**
 * Certificate Studio state — mobx-state-tree.
 *
 * Holds a live, editable copy of a `CertificateDesignDocument` (schemaVersion 1)
 * plus editor-only state (selection, zoom, pan) and an undo/redo history of
 * document snapshots.
 */

import {
  applySnapshot,
  getSnapshot,
  types,
  type IAnyModelType,
  type Instance,
  type SnapshotIn,
  type SnapshotOut,
} from "mobx-state-tree";
import {
  createEmptyDesignDocument,
  type CertificateDesignDocument,
  type CertificateDesignRule,
  type CertificateDesignVariable,
} from "@atlas/contracts/certificates/certificate-design-document";
import { computeFitZoom, pagePixelSize, toPx, type DocumentUnit } from "./studio-units";

const MAX_HISTORY = 50;

const baseElementProps = {
  id: types.identifier,
  x: types.number,
  y: types.number,
  width: types.number,
  height: types.number,
  rotation: types.maybe(types.number),
  zIndex: types.number,
  locked: types.maybe(types.boolean),
  hidden: types.maybe(types.boolean),
  name: types.maybe(types.string),
};

export const TextElementModel = types.model("TextElement", {
  ...baseElementProps,
  type: types.literal("text"),
  text: types.string,
  fontFamily: types.string,
  fontSize: types.number,
  fontWeight: types.union(types.number, types.string),
  fontStyle: types.maybe(types.string),
  color: types.string,
  align: types.enumeration("TextAlign", ["left", "center", "right", "justify"]),
  letterSpacing: types.maybe(types.number),
  lineHeight: types.maybe(types.number),
  variableKey: types.maybe(types.string),
  direction: types.maybe(types.enumeration("TextDirection", ["ltr", "rtl"])),
  autoFit: types.maybe(types.boolean),
});

export const ImageElementModel = types.model("ImageElement", {
  ...baseElementProps,
  type: types.literal("image"),
  src: types.string,
  opacity: types.maybe(types.number),
  variableKey: types.maybe(types.string),
});

export const ShapeElementModel = types.model("ShapeElement", {
  ...baseElementProps,
  type: types.literal("shape"),
  shape: types.enumeration("ShapeKind", ["rect", "ellipse", "line"]),
  fill: types.maybe(types.string),
  stroke: types.maybe(types.string),
  strokeWidth: types.maybe(types.number),
  cornerRadius: types.maybe(types.number),
});

export const QrElementModel = types.model("QrElement", {
  ...baseElementProps,
  type: types.literal("qr"),
  valueSource: types.enumeration("QrValueSource", ["verification_url", "credential_id", "custom"]),
  customValue: types.maybe(types.string),
});

export const SignatureElementModel = types.model("SignatureElement", {
  ...baseElementProps,
  type: types.literal("signature"),
  imageSrc: types.maybe(types.string),
  labelVariableKey: types.maybe(types.string),
  titleVariableKey: types.maybe(types.string),
});

export const ElementModel = types.union(
  {
    dispatcher(snapshot: { type: string }): IAnyModelType {
      switch (snapshot.type) {
        case "text":
          return TextElementModel;
        case "image":
          return ImageElementModel;
        case "shape":
          return ShapeElementModel;
        case "qr":
          return QrElementModel;
        case "signature":
          return SignatureElementModel;
        default:
          return TextElementModel;
      }
    },
  },
  TextElementModel,
  ImageElementModel,
  ShapeElementModel,
  QrElementModel,
  SignatureElementModel,
);

const PageModel = types.model("Page", {
  width: types.number,
  height: types.number,
  unit: types.enumeration("PageUnit", ["px", "mm", "in"]),
  orientation: types.enumeration("PageOrientation", ["landscape", "portrait"]),
  bleedMm: types.maybe(types.number),
  safeMm: types.maybe(types.number),
});

const BackgroundModel = types.model("Background", {
  type: types.enumeration("BackgroundType", ["color", "image", "gradient"]),
  value: types.string,
});

const DocumentModel = types.model("Document", {
  schemaVersion: types.literal(1),
  page: PageModel,
  background: BackgroundModel,
  elements: types.array(ElementModel),
  variables: types.maybe(types.frozen<CertificateDesignVariable[]>()),
  rules: types.maybe(types.frozen<CertificateDesignRule[]>()),
  brandKitRef: types.maybeNull(types.string),
  locale: types.maybe(types.string),
});

export type ElementInstance = Instance<typeof ElementModel>;
export type TextElementInstance = Instance<typeof TextElementModel>;
export type ShapeElementInstance = Instance<typeof ShapeElementModel>;
export type ImageElementInstance = Instance<typeof ImageElementModel>;
export type DocumentInstance = Instance<typeof DocumentModel>;

type DocSnapshot = SnapshotOut<typeof DocumentModel>;
type TextSnapshot = SnapshotIn<typeof TextElementModel>;
type ImageSnapshot = SnapshotIn<typeof ImageElementModel>;
type ShapeSnapshot = SnapshotIn<typeof ShapeElementModel>;

/** Broad, fully-optional patch usable against any element type. */
export type ElementPatch = Partial<
  Omit<TextSnapshot, "id" | "type"> &
    Omit<ImageSnapshot, "id" | "type"> &
    Omit<ShapeSnapshot, "id" | "type">
>;

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";

export type DistributeAxis = "horizontal" | "vertical";

export type PageSetupPatch = {
  width?: number;
  height?: number;
  unit?: DocumentUnit;
  orientation?: "landscape" | "portrait";
  bleedMm?: number;
  safeMm?: number;
};

export type AddTextOptions = Partial<
  Pick<
    TextSnapshot,
    | "text"
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "color"
    | "align"
    | "x"
    | "y"
    | "width"
    | "height"
    | "variableKey"
    | "name"
  >
>;

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function evaluateRule(
  rule: CertificateDesignRule,
  variables: CertificateDesignVariable[],
): boolean {
  const variable = variables.find((item) => item.key === rule.when.variableKey);
  const raw = variable?.sampleValue ?? "";
  const { op, value } = rule.when;
  if (op === "eq") return raw === String(value);
  if (op === "contains") return raw.includes(String(value));
  const left = Number(raw);
  const right = Number(value);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  if (op === "gte") return left >= right;
  return left <= right;
}

export const StudioStore = types
  .model("StudioStore", {
    doc: DocumentModel,
    templateName: types.optional(types.string, "Untitled certificate"),
    selectedElementIds: types.array(types.string),
    zoom: types.optional(types.number, 0.55),
    /** `fit` keeps the paper sized to the stage; `fixed` is a user-chosen zoom. */
    zoomMode: types.optional(types.enumeration("ZoomMode", ["fit", "fixed"]), "fit"),
    panX: types.optional(types.number, 0),
    panY: types.optional(types.number, 0),
    showGrid: types.optional(types.boolean, false),
    showGuides: types.optional(types.boolean, true),
    /** When true, canvas shows sample variable values and applies conditional rules. */
    proofMode: types.optional(types.boolean, false),
    past: types.array(types.frozen<DocSnapshot>()),
    future: types.array(types.frozen<DocSnapshot>()),
  })
  .views((self) => ({
    /** Elements sorted bottom-to-top by z-index. */
    get orderedElements(): ElementInstance[] {
      return [...self.doc.elements].sort((a, b) => a.zIndex - b.zIndex);
    },
    /** Elements sorted top-to-bottom (for a layers list). */
    get layersTopFirst(): ElementInstance[] {
      return [...self.doc.elements].sort((a, b) => b.zIndex - a.zIndex);
    },
    elementById(id: string): ElementInstance | undefined {
      return self.doc.elements.find((el) => el.id === id);
    },
    get selectedElements(): ElementInstance[] {
      return self.doc.elements.filter((el) => self.selectedElementIds.includes(el.id));
    },
    get singleSelected(): ElementInstance | undefined {
      if (self.selectedElementIds.length !== 1) return undefined;
      return self.doc.elements.find((el) => el.id === self.selectedElementIds[0]);
    },
    isSelected(id: string): boolean {
      return self.selectedElementIds.includes(id);
    },
    get canUndo(): boolean {
      return self.past.length > 0;
    },
    get canRedo(): boolean {
      return self.future.length > 0;
    },
    get variables(): CertificateDesignVariable[] {
      return self.doc.variables ? [...self.doc.variables] : [];
    },
    get rules(): CertificateDesignRule[] {
      return self.doc.rules ? [...self.doc.rules] : [];
    },
    variableByKey(key: string): CertificateDesignVariable | undefined {
      return self.doc.variables?.find((variable) => variable.key === key);
    },
    /** Resolved text for canvas: placeholders, proof samples, or raw text. */
    displayTextFor(element: ElementInstance): string {
      if (element.type !== "text") return "";
      const textEl = element;
      if (self.proofMode && textEl.variableKey) {
        const variable = self.doc.variables?.find((v) => v.key === textEl.variableKey);
        if (variable?.sampleValue) return variable.sampleValue;
      }
      if (!self.proofMode && textEl.variableKey) {
        return `{{${textEl.variableKey}}}`;
      }
      if (self.proofMode && textEl.text.includes("{{")) {
        return textEl.text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
          const variable = self.doc.variables?.find((v) => v.key === key);
          return variable?.sampleValue ?? `{{${key}}}`;
        });
      }
      return textEl.text;
    },
    /** Whether an element should render in the current mode (rules + hidden). */
    isElementVisible(element: ElementInstance): boolean {
      if (!self.proofMode) return !element.hidden;

      const rules = self.doc.rules ?? [];
      let visible = !element.hidden;
      for (const rule of rules) {
        if (rule.then.elementId !== element.id) continue;
        const matched = evaluateRule(rule, self.doc.variables ?? []);
        if (rule.then.action === "show") {
          visible = matched;
        } else if (rule.then.action === "hide") {
          if (matched) visible = false;
        }
      }
      return visible;
    },
    /** Plain, serializable design document for saving/preview. */
    toDocument(): CertificateDesignDocument {
      return JSON.parse(JSON.stringify(getSnapshot(self.doc))) as CertificateDesignDocument;
    },
  }))
  .actions((self) => {
    function pushHistory(): void {
      self.past.push(getSnapshot(self.doc));
      if (self.past.length > MAX_HISTORY) {
        self.past.splice(0, self.past.length - MAX_HISTORY);
      }
      self.future.clear();
    }

    function nextZIndex(): number {
      return self.doc.elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1;
    }

    function select(id: string): void {
      self.selectedElementIds.replace([id]);
    }

    return {
      setTemplateName(name: string): void {
        self.templateName = name;
      },

      addText(options: AddTextOptions = {}): string {
        pushHistory();
        const id = genId("text");
        const element: TextSnapshot = {
          id,
          type: "text",
          x: options.x ?? 40,
          y: options.y ?? 40,
          width: options.width ?? 240,
          height: options.height ?? 40,
          zIndex: nextZIndex(),
          name: options.name ?? "Text",
          text: options.text ?? "New text",
          fontFamily: options.fontFamily ?? "Georgia, serif",
          fontSize: options.fontSize ?? 18,
          fontWeight: options.fontWeight ?? 400,
          color: options.color ?? "#1a1f26",
          align: options.align ?? "left",
          variableKey: options.variableKey,
        };
        self.doc.elements.push(element);
        select(id);
        return id;
      },

      addHeading(): string {
        return this.addText({
          text: "Certificate of Completion",
          fontSize: 34,
          fontWeight: 700,
          align: "center",
          width: 420,
          height: 56,
          name: "Heading",
        });
      },

      addShape(shape: "rect" | "ellipse" | "line"): string {
        pushHistory();
        const id = genId(shape);
        const element: ShapeSnapshot = {
          id,
          type: "shape",
          shape,
          x: 60,
          y: 60,
          width: shape === "line" ? 200 : 160,
          height: shape === "line" ? 2 : 120,
          zIndex: nextZIndex(),
          name: shape === "rect" ? "Rectangle" : shape === "ellipse" ? "Ellipse" : "Line",
          fill: shape === "line" ? undefined : "#2e6bff",
          stroke: shape === "line" ? "#1a1f26" : undefined,
          strokeWidth: shape === "line" ? 2 : 0,
          cornerRadius: shape === "rect" ? 8 : 0,
        };
        self.doc.elements.push(element);
        select(id);
        return id;
      },

      addImage(src: string): string {
        pushHistory();
        const id = genId("image");
        const element: ImageSnapshot = {
          id,
          type: "image",
          src,
          x: 60,
          y: 60,
          width: 160,
          height: 120,
          zIndex: nextZIndex(),
          name: "Image",
          opacity: 1,
        };
        self.doc.elements.push(element);
        select(id);
        return id;
      },

      addQr(): string {
        pushHistory();
        const id = genId("qr");
        self.doc.elements.push({
          id,
          type: "qr",
          valueSource: "verification_url",
          x: 60,
          y: 60,
          width: 96,
          height: 96,
          zIndex: nextZIndex(),
          name: "Verification QR",
        });
        select(id);
        return id;
      },

      addSignature(): string {
        pushHistory();
        const id = genId("signature");
        self.doc.elements.push({
          id,
          type: "signature",
          x: 60,
          y: 60,
          width: 200,
          height: 80,
          zIndex: nextZIndex(),
          name: "Signature",
        });
        select(id);
        return id;
      },

      updateElement(id: string, patch: ElementPatch): void {
        const element = self.doc.elements.find((el) => el.id === id);
        if (!element) return;
        pushHistory();
        const target = element as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(patch)) {
          if (value !== undefined && key in target) {
            target[key] = value;
          }
        }
      },

      /** Live geometry update without recording history (used mid-transform). */
      setGeometry(
        id: string,
        geometry: Partial<Pick<ElementInstance, "x" | "y" | "width" | "height" | "rotation">>,
      ): void {
        const element = self.doc.elements.find((el) => el.id === id);
        if (!element) return;
        if (geometry.x !== undefined) element.x = geometry.x;
        if (geometry.y !== undefined) element.y = geometry.y;
        if (geometry.width !== undefined) element.width = geometry.width;
        if (geometry.height !== undefined) element.height = geometry.height;
        if (geometry.rotation !== undefined) element.rotation = geometry.rotation;
      },

      /** Snapshot the current document so the next live edit can be undone. */
      beginInteraction(): void {
        pushHistory();
      },

      deleteSelected(): void {
        const ids = self.selectedElementIds.filter((id) => {
          const el = self.doc.elements.find((e) => e.id === id);
          return el != null && !el.locked;
        });
        if (ids.length === 0) return;
        pushHistory();
        for (const id of ids) {
          const idx = self.doc.elements.findIndex((el) => el.id === id);
          if (idx >= 0) self.doc.elements.splice(idx, 1);
        }
        self.selectedElementIds.clear();
      },

      duplicateSelected(): void {
        const selected = self.doc.elements.filter((el) => self.selectedElementIds.includes(el.id));
        if (selected.length === 0) return;
        pushHistory();
        const newIds: string[] = [];
        for (const el of selected) {
          const snapshot = getSnapshot(el);
          const id = genId(snapshot.type);
          self.doc.elements.push({
            ...snapshot,
            id,
            x: snapshot.x + 12,
            y: snapshot.y + 12,
            zIndex: nextZIndex(),
          });
          newIds.push(id);
        }
        self.selectedElementIds.replace(newIds);
      },

      bringForward(): void {
        if (self.selectedElementIds.length === 0) return;
        pushHistory();
        for (const id of self.selectedElementIds) {
          const el = self.doc.elements.find((e) => e.id === id);
          if (!el) continue;
          const above = self.doc.elements
            .filter((e) => e.zIndex > el.zIndex)
            .sort((a, b) => a.zIndex - b.zIndex)[0];
          if (above) {
            const z = el.zIndex;
            el.zIndex = above.zIndex;
            above.zIndex = z;
          }
        }
      },

      sendBackward(): void {
        if (self.selectedElementIds.length === 0) return;
        pushHistory();
        for (const id of self.selectedElementIds) {
          const el = self.doc.elements.find((e) => e.id === id);
          if (!el) continue;
          const below = self.doc.elements
            .filter((e) => e.zIndex < el.zIndex)
            .sort((a, b) => b.zIndex - a.zIndex)[0];
          if (below) {
            const z = el.zIndex;
            el.zIndex = below.zIndex;
            below.zIndex = z;
          }
        }
      },

      reorderZ(id: string, zIndex: number): void {
        const el = self.doc.elements.find((e) => e.id === id);
        if (!el) return;
        pushHistory();
        el.zIndex = zIndex;
      },

      setSelection(ids: string[]): void {
        self.selectedElementIds.replace(ids);
      },

      toggleInSelection(id: string): void {
        if (self.selectedElementIds.includes(id)) {
          self.selectedElementIds.remove(id);
        } else {
          self.selectedElementIds.push(id);
        }
      },

      clearSelection(): void {
        self.selectedElementIds.clear();
      },

      nudgeSelected(dx: number, dy: number): void {
        if (self.selectedElementIds.length === 0) return;
        pushHistory();
        for (const id of self.selectedElementIds) {
          const el = self.doc.elements.find((e) => e.id === id);
          if (el && !el.locked) {
            el.x += dx;
            el.y += dy;
          }
        }
      },

      /** Align every unlocked selected element relative to the page bounds. */
      alignSelection(mode: AlignMode): void {
        const elements = self.doc.elements.filter(
          (el) => self.selectedElementIds.includes(el.id) && !el.locked,
        );
        if (elements.length === 0) return;
        pushHistory();
        const pageWidth = self.doc.page.width;
        const pageHeight = self.doc.page.height;
        for (const el of elements) {
          switch (mode) {
            case "left":
              el.x = 0;
              break;
            case "center":
              el.x = (pageWidth - el.width) / 2;
              break;
            case "right":
              el.x = pageWidth - el.width;
              break;
            case "top":
              el.y = 0;
              break;
            case "middle":
              el.y = (pageHeight - el.height) / 2;
              break;
            case "bottom":
              el.y = pageHeight - el.height;
              break;
            default:
              break;
          }
        }
      },

      /** Evenly distribute 3+ unlocked selected elements along an axis. */
      distributeSelection(axis: DistributeAxis): void {
        const elements = self.doc.elements.filter(
          (el) => self.selectedElementIds.includes(el.id) && !el.locked,
        );
        if (elements.length < 3) return;
        pushHistory();
        if (axis === "horizontal") {
          const sorted = [...elements].sort((a, b) => a.x - b.x);
          const start = Math.min(...sorted.map((e) => e.x));
          const end = Math.max(...sorted.map((e) => e.x + e.width));
          const totalWidth = sorted.reduce((sum, e) => sum + e.width, 0);
          const gap = (end - start - totalWidth) / (sorted.length - 1);
          let cursor = start;
          for (const el of sorted) {
            el.x = cursor;
            cursor += el.width + gap;
          }
        } else {
          const sorted = [...elements].sort((a, b) => a.y - b.y);
          const start = Math.min(...sorted.map((e) => e.y));
          const end = Math.max(...sorted.map((e) => e.y + e.height));
          const totalHeight = sorted.reduce((sum, e) => sum + e.height, 0);
          const gap = (end - start - totalHeight) / (sorted.length - 1);
          let cursor = start;
          for (const el of sorted) {
            el.y = cursor;
            cursor += el.height + gap;
          }
        }
      },

      /**
       * Update page geometry. A unit change converts the page and every
       * element so the physical size on paper is preserved. An orientation
       * change without explicit dimensions swaps width/height.
       */
      setPageSetup(patch: PageSetupPatch): void {
        pushHistory();
        const page = self.doc.page;
        if (patch.unit && patch.unit !== page.unit) {
          const factor = toPx(1, page.unit) / toPx(1, patch.unit);
          page.width *= factor;
          page.height *= factor;
          for (const el of self.doc.elements) {
            el.x *= factor;
            el.y *= factor;
            el.width *= factor;
            el.height *= factor;
          }
          page.unit = patch.unit;
        }
        if (patch.width !== undefined && patch.width > 0) page.width = patch.width;
        if (patch.height !== undefined && patch.height > 0) page.height = patch.height;
        if (patch.bleedMm !== undefined) page.bleedMm = patch.bleedMm;
        if (patch.safeMm !== undefined) page.safeMm = patch.safeMm;
        if (patch.orientation && patch.orientation !== page.orientation) {
          page.orientation = patch.orientation;
          const mismatched =
            (patch.orientation === "landscape" && page.width < page.height) ||
            (patch.orientation === "portrait" && page.width > page.height);
          if (mismatched && patch.width === undefined && patch.height === undefined) {
            const w = page.width;
            page.width = page.height;
            page.height = w;
          }
        } else if (patch.orientation === undefined) {
          page.orientation = page.width >= page.height ? "landscape" : "portrait";
        }
      },

      toggleGrid(): void {
        self.showGrid = !self.showGrid;
      },

      toggleGuides(): void {
        self.showGuides = !self.showGuides;
      },

      /** Apply a brand color to the selection: text color, or shape fill/stroke. */
      applyColorToSelection(color: string): void {
        const elements = self.doc.elements.filter(
          (el) => self.selectedElementIds.includes(el.id) && !el.locked,
        );
        if (elements.length === 0) return;
        pushHistory();
        for (const el of elements) {
          if (el.type === "text") {
            el.color = color;
          } else if (el.type === "shape") {
            if (el.shape === "line") el.stroke = color;
            else el.fill = color;
          }
        }
      },

      /** Bind or clear the variable key on a text/image element. */
      setVariableKey(id: string, key: string | undefined): void {
        const el = self.doc.elements.find((e) => e.id === id);
        if (!el || (el.type !== "text" && el.type !== "image")) return;
        pushHistory();
        el.variableKey = key;
      },

      toggleLock(id?: string): void {
        const ids = id ? [id] : [...self.selectedElementIds];
        if (ids.length === 0) return;
        pushHistory();
        for (const elementId of ids) {
          const el = self.doc.elements.find((e) => e.id === elementId);
          if (el) el.locked = !el.locked;
        }
      },

      toggleHidden(id?: string): void {
        const ids = id ? [id] : [...self.selectedElementIds];
        if (ids.length === 0) return;
        pushHistory();
        for (const elementId of ids) {
          const el = self.doc.elements.find((e) => e.id === elementId);
          if (el) el.hidden = !el.hidden;
        }
      },

      renameElement(id: string, name: string): void {
        const el = self.doc.elements.find((e) => e.id === id);
        if (!el) return;
        pushHistory();
        el.name = name;
      },

      bindTextVariable(id: string, key: string | null): void {
        const el = self.doc.elements.find((e) => e.id === id);
        if (!el || el.type !== "text") return;
        pushHistory();
        if (key && key.length > 0) {
          el.variableKey = key;
          el.text = `{{${key}}}`;
        } else {
          el.variableKey = undefined;
        }
      },

      setZoom(zoom: number): void {
        self.zoom = Math.min(3, Math.max(0.1, zoom));
        self.zoomMode = "fixed";
      },

      /** Lock zoom to fit-mode; canvas ResizeObserver will call `fitToViewport`. */
      requestFitZoom(): void {
        self.zoomMode = "fit";
      },

      /**
       * Size the paper so it fits the stage viewport (no scrollbars).
       * Only updates when the computed zoom meaningfully changes.
       */
      fitToViewport(viewportWidth: number, viewportHeight: number): void {
        if (viewportWidth < 40 || viewportHeight < 40) return;
        const paper = pagePixelSize(self.doc.page);
        const bleedPx = toPx(self.doc.page.bleedMm ?? 0, "mm");
        const next = computeFitZoom({
          viewportWidth,
          viewportHeight,
          paperWidthPx: paper.width,
          paperHeightPx: paper.height,
          bleedPx,
          marginPx: 12,
          minZoom: 0.1,
          maxZoom: 3,
        });
        self.zoomMode = "fit";
        if (Math.abs(next - self.zoom) > 0.002) {
          self.zoom = next;
        }
      },

      setPan(x: number, y: number): void {
        self.panX = x;
        self.panY = y;
      },

      setProofMode(enabled: boolean): void {
        self.proofMode = enabled;
        if (enabled) self.selectedElementIds.clear();
      },

      setBrandKitRef(brandKitId: string | null): void {
        pushHistory();
        self.doc.brandKitRef = brandKitId;
      },

      /** Set the page background (solid color, image URL, or CSS gradient). */
      setBackground(background: { type: "color" | "image" | "gradient"; value: string }): void {
        pushHistory();
        self.doc.background.type = background.type;
        self.doc.background.value = background.value;
      },

      addVariable(variable: CertificateDesignVariable): void {
        pushHistory();
        const current = self.doc.variables ? [...self.doc.variables] : [];
        if (current.some((item) => item.key === variable.key)) return;
        self.doc.variables = [...current, variable];
      },

      updateVariable(key: string, patch: Partial<CertificateDesignVariable>): void {
        if (!self.doc.variables) return;
        pushHistory();
        self.doc.variables = self.doc.variables.map((variable) =>
          variable.key === key ? { ...variable, ...patch, key: variable.key } : variable,
        );
      },

      removeVariable(key: string): void {
        if (!self.doc.variables) return;
        pushHistory();
        self.doc.variables = self.doc.variables.filter((variable) => variable.key !== key);
      },

      addRule(rule: CertificateDesignRule): void {
        pushHistory();
        const current = self.doc.rules ? [...self.doc.rules] : [];
        self.doc.rules = [...current, rule];
      },

      removeRule(id: string): void {
        if (!self.doc.rules) return;
        pushHistory();
        self.doc.rules = self.doc.rules.filter((rule) => rule.id !== id);
      },

      loadDocument(doc: CertificateDesignDocument): void {
        applySnapshot(self.doc, doc);
        self.selectedElementIds.clear();
        self.past.clear();
        self.future.clear();
      },

      undo(): void {
        if (self.past.length === 0) return;
        const current = getSnapshot(self.doc);
        const previous = self.past[self.past.length - 1];
        self.past.splice(self.past.length - 1, 1);
        self.future.unshift(current);
        applySnapshot(self.doc, previous);
      },

      redo(): void {
        if (self.future.length === 0) return;
        const current = getSnapshot(self.doc);
        const next = self.future[0];
        self.future.splice(0, 1);
        self.past.push(current);
        applySnapshot(self.doc, next);
      },
    };
  });

export type StudioStoreInstance = Instance<typeof StudioStore>;

export function createStudioStore(doc?: CertificateDesignDocument): StudioStoreInstance {
  return StudioStore.create({
    doc: (doc ?? createEmptyDesignDocument()) as SnapshotIn<typeof DocumentModel>,
    selectedElementIds: [],
  });
}
