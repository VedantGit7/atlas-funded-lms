"use client";

/**
 * Certificate Studio inspector panels — Properties, Page setup, Align toolbar.
 */

import { observer } from "mobx-react-lite";
import { useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Database,
} from "lucide-react";
import type { DocumentUnit } from "./studio-units";
import {
  type AlignMode,
  type ElementInstance,
  type StudioStoreInstance,
} from "./studio-store";

const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Plus Jakarta Sans", value: '"Plus Jakarta Sans", system-ui, sans-serif' },
  { label: "Cormorant Garamond", value: '"Cormorant Garamond", "Times New Roman", serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
];

const FONT_WEIGHTS: { label: string; value: number }[] = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semibold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Extrabold", value: 800 },
];

const PAGE_PRESETS: {
  label: string;
  width: number;
  height: number;
  unit: DocumentUnit;
  orientation: "landscape" | "portrait";
}[] = [
  { label: "A4 Landscape", width: 297, height: 210, unit: "mm", orientation: "landscape" },
  { label: "A4 Portrait", width: 210, height: 297, unit: "mm", orientation: "portrait" },
  { label: "US Letter", width: 279.4, height: 215.9, unit: "mm", orientation: "landscape" },
];

const ALIGN_ACTIONS: {
  mode: AlignMode;
  label: string;
  icon: typeof AlignStartHorizontal;
}[] = [
  { mode: "left", label: "Align left", icon: AlignStartHorizontal },
  { mode: "center", label: "Align center", icon: AlignCenterHorizontal },
  { mode: "right", label: "Align right", icon: AlignEndHorizontal },
  { mode: "top", label: "Align top", icon: AlignStartVertical },
  { mode: "middle", label: "Align middle", icon: AlignCenterVertical },
  { mode: "bottom", label: "Align bottom", icon: AlignEndVertical },
];

export { FONT_FAMILIES, FONT_WEIGHTS };

export function NumberInput({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const inputId = `insp-num-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <div className="cert-studio__field">
      <label className="cert-studio__field-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        min={min}
        step={step}
        className="cert-studio__input"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          onChange(event.target.valueAsNumber);
        }}
      />
    </div>
  );
}

export const AlignToolbar = observer(function AlignToolbar({
  store,
}: {
  store: StudioStoreInstance;
}) {
  const canDistribute = store.selectedElementIds.length >= 3;
  return (
    <div className="cert-studio__field-group" aria-label="Alignment" style={{ marginBottom: 28 }}>
      <h3 className="cert-studio__label-mono" style={{ marginBottom: 12 }}>
        Alignment
      </h3>
      <div className="cert-studio__align-grid" role="group" aria-label="Align selection">
        {ALIGN_ACTIONS.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              store.alignSelection(mode);
            }}
            aria-label={label}
            title={label}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="cert-studio__row" role="group" aria-label="Distribute selection">
        <button
          type="button"
          className="cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm"
          disabled={!canDistribute}
          title={canDistribute ? undefined : "Select 3+ elements to distribute"}
          onClick={() => {
            store.distributeSelection("horizontal");
          }}
        >
          Distribute H
        </button>
        <button
          type="button"
          className="cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm"
          disabled={!canDistribute}
          title={canDistribute ? undefined : "Select 3+ elements to distribute"}
          onClick={() => {
            store.distributeSelection("vertical");
          }}
        >
          Distribute V
        </button>
      </div>
    </div>
  );
});

export const PageSetupPanel = observer(function PageSetupPanel({
  store,
}: {
  store: StudioStoreInstance;
}) {
  const page = store.doc.page;
  const background = store.doc.background;
  const round = (n: number) => Math.round(n * 100) / 100;

  const [bgMode, setBgMode] = useState<"color" | "image">(
    background.type === "image" ? "image" : "color",
  );
  const [imageUrl, setImageUrl] = useState(
    background.type === "image" ? background.value : "",
  );

  const applyImageUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed.length > 0) {
      store.setBackground({ type: "image", value: trimmed });
    }
  };

  return (
    <div className="cert-studio__inspector">
      <div className="cert-studio__field">
        <span className="cert-studio__field-label">Orientation</span>
        <div className="cert-studio__seg" role="group" aria-label="Page orientation">
          {(["landscape", "portrait"] as const).map((orientation) => (
            <button
              key={orientation}
              type="button"
              className={`cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm${
                page.orientation === orientation ? " is-active" : ""
              }`}
              aria-pressed={page.orientation === orientation}
              onClick={() => {
                store.setPageSetup({ orientation });
              }}
            >
              {orientation === "landscape" ? "Landscape" : "Portrait"}
            </button>
          ))}
        </div>
      </div>

      <div className="cert-studio__field">
        <span className="cert-studio__field-label">Presets</span>
        <div className="cert-studio__preset-list" role="group" aria-label="Page presets">
          {PAGE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="cert-studio__btn cert-studio__btn--sm"
              onClick={() => {
                store.setPageSetup({
                  unit: preset.unit,
                  width: preset.width,
                  height: preset.height,
                  orientation: preset.orientation,
                });
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cert-studio__field-group" aria-label="Custom page size">
        <div className="cert-studio__row">
          <NumberInput
            label="Width"
            value={round(page.width)}
            min={1}
            onChange={(v) => {
              if (v > 0) store.setPageSetup({ width: v });
            }}
          />
          <NumberInput
            label="Height"
            value={round(page.height)}
            min={1}
            onChange={(v) => {
              if (v > 0) store.setPageSetup({ height: v });
            }}
          />
        </div>
        <div className="cert-studio__field">
          <label className="cert-studio__field-label" htmlFor="page-unit">
            Unit
          </label>
          <select
            id="page-unit"
            className="cert-studio__input"
            value={page.unit}
            onChange={(event) => {
              store.setPageSetup({ unit: event.target.value as DocumentUnit });
            }}
          >
            <option value="mm">Millimetres (mm)</option>
            <option value="in">Inches (in)</option>
            <option value="px">Pixels (px)</option>
          </select>
        </div>
      </div>

      <div className="cert-studio__field-group" aria-label="Print guides">
        <div className="cert-studio__row">
          <NumberInput
            label="Bleed (mm)"
            value={page.bleedMm ?? 0}
            min={0}
            onChange={(v) => {
              if (v >= 0) store.setPageSetup({ bleedMm: v });
            }}
          />
          <NumberInput
            label="Safe (mm)"
            value={page.safeMm ?? 0}
            min={0}
            onChange={(v) => {
              if (v >= 0) store.setPageSetup({ safeMm: v });
            }}
          />
        </div>
      </div>

      <div className="cert-studio__field-group" aria-label="Background">
        <span className="cert-studio__field-label">Background</span>
        <div className="cert-studio__seg" role="group" aria-label="Background type">
          {(["color", "image"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm${
                bgMode === mode ? " is-active" : ""
              }`}
              aria-pressed={bgMode === mode}
              onClick={() => {
                setBgMode(mode);
                if (mode === "color" && background.type !== "color") {
                  store.setBackground({ type: "color", value: "#ffffff" });
                }
                if (mode === "image" && background.type !== "image") {
                  applyImageUrl(imageUrl);
                }
              }}
            >
              {mode === "color" ? "Color" : "Image"}
            </button>
          ))}
        </div>

        {bgMode === "image" ? (
          <>
            <div className="cert-studio__field">
              <label className="cert-studio__field-label" htmlFor="page-bg-image">
                Image URL
              </label>
              <input
                id="page-bg-image"
                className="cert-studio__input"
                placeholder="/certificates/backgrounds/…"
                value={imageUrl}
                onChange={(event) => {
                  setImageUrl(event.target.value);
                }}
                onBlur={() => {
                  applyImageUrl(imageUrl);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyImageUrl(imageUrl);
                }}
              />
            </div>
            <button
              type="button"
              className="cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm"
              onClick={() => {
                setImageUrl("");
                setBgMode("color");
                store.setBackground({ type: "color", value: "#ffffff" });
              }}
            >
              Remove image
            </button>
          </>
        ) : (
          <div className="cert-studio__field">
            <label className="cert-studio__field-label" htmlFor="page-bg-color">
              Color
            </label>
            <input
              id="page-bg-color"
              type="color"
              className="cert-studio__input cert-studio__color"
              value={
                background.type === "color" && /^#[0-9a-fA-F]{3,8}$/.test(background.value)
                  ? background.value
                  : "#ffffff"
              }
              onChange={(event) => {
                store.setBackground({ type: "color", value: event.target.value });
              }}
            />
          </div>
        )}
      </div>

      <div className="cert-studio__field-group" aria-label="View options">
        <div className="cert-studio__row">
          <button
            type="button"
            className="cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm"
            aria-pressed={store.showGrid}
            onClick={() => {
              store.toggleGrid();
            }}
          >
            {store.showGrid ? "Hide grid" : "Show grid"}
          </button>
          <button
            type="button"
            className="cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm"
            aria-pressed={store.showGuides}
            onClick={() => {
              store.toggleGuides();
            }}
          >
            {store.showGuides ? "Hide guides" : "Show guides"}
          </button>
        </div>
      </div>
    </div>
  );
});

export const ElementInspector = observer(function ElementInspector({
  store,
  element,
  swatches,
}: {
  store: StudioStoreInstance;
  element: ElementInstance;
  swatches: Array<{ color: string; label: string }>;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;

  const numberPatch = (key: "x" | "y" | "width" | "height", value: number) => {
    if (Number.isNaN(value)) return;
    store.updateElement(element.id, { [key]: value });
  };

  const variables = store.doc.variables ?? [];

  return (
    <div className="cert-studio__inspector">
      <div className="cert-studio__field">
        <label className="cert-studio__field-label" htmlFor="insp-name">
          Name
        </label>
        <input
          id="insp-name"
          className="cert-studio__input"
          value={element.name ?? ""}
          onChange={(event) => {
            store.renameElement(element.id, event.target.value);
          }}
        />
      </div>

      <div className="cert-studio__field-group" aria-label="Position and size">
        <div className="cert-studio__row">
          <NumberInput
            label="X"
            value={round(element.x)}
            onChange={(v) => {
              numberPatch("x", v);
            }}
          />
          <NumberInput
            label="Y"
            value={round(element.y)}
            onChange={(v) => {
              numberPatch("y", v);
            }}
          />
        </div>
        <div className="cert-studio__row">
          <NumberInput
            label="W"
            value={round(element.width)}
            onChange={(v) => {
              numberPatch("width", v);
            }}
          />
          <NumberInput
            label="H"
            value={round(element.height)}
            onChange={(v) => {
              numberPatch("height", v);
            }}
          />
        </div>
      </div>

      {element.type === "text" ? (
        <section className="cert-studio__field-group">
          <h3 className="cert-studio__label-mono">Text style</h3>
          <div className="cert-studio__field">
            <label className="cert-studio__field-label" htmlFor="insp-text">
              Content
            </label>
            <textarea
              id="insp-text"
              className="cert-studio__input cert-studio__textarea"
              rows={2}
              value={element.text}
              onChange={(event) => {
                store.updateElement(element.id, { text: event.target.value });
              }}
            />
          </div>

          <div className="cert-studio__field">
            <label className="cert-studio__field-label" htmlFor="insp-font-family">
              Typeface
            </label>
            <select
              id="insp-font-family"
              className="cert-studio__input"
              value={element.fontFamily}
              onChange={(event) => {
                store.updateElement(element.id, { fontFamily: event.target.value });
              }}
            >
              {FONT_FAMILIES.some((f) => f.value === element.fontFamily) ? null : (
                <option value={element.fontFamily}>{element.fontFamily}</option>
              )}
              {FONT_FAMILIES.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          <div className="cert-studio__row">
            <NumberInput
              label="Size"
              value={element.fontSize}
              min={1}
              onChange={(v) => {
                store.updateElement(element.id, { fontSize: v });
              }}
            />
            <div className="cert-studio__field">
              <label className="cert-studio__field-label" htmlFor="insp-font-weight">
                Weight
              </label>
              <select
                id="insp-font-weight"
                className="cert-studio__input"
                value={String(element.fontWeight)}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  store.updateElement(element.id, {
                    fontWeight: Number.isNaN(parsed) ? event.target.value : parsed,
                  });
                }}
              >
                {FONT_WEIGHTS.some((w) => String(w.value) === String(element.fontWeight))
                  ? null
                  : (
                      <option value={String(element.fontWeight)}>
                        {String(element.fontWeight)}
                      </option>
                    )}
                {FONT_WEIGHTS.map((weight) => (
                  <option key={weight.value} value={String(weight.value)}>
                    {weight.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="cert-studio__row">
            <NumberInput
              label="Letter spacing"
              value={element.letterSpacing ?? 0}
              step={0.1}
              onChange={(v) => {
                store.updateElement(element.id, { letterSpacing: v });
              }}
            />
            <NumberInput
              label="Line height"
              value={element.lineHeight ?? 1.2}
              min={0.5}
              step={0.1}
              onChange={(v) => {
                if (v > 0) store.updateElement(element.id, { lineHeight: v });
              }}
            />
          </div>

          <div className="cert-studio__row">
            <div className="cert-studio__field">
              <label className="cert-studio__field-label" htmlFor="insp-color">
                Color
              </label>
              <input
                id="insp-color"
                type="color"
                className="cert-studio__input cert-studio__color"
                value={element.color}
                onChange={(event) => {
                  store.updateElement(element.id, { color: event.target.value });
                }}
              />
            </div>
            <div className="cert-studio__field">
              <span className="cert-studio__field-label">Direction</span>
              <div className="cert-studio__seg" role="group" aria-label="Text direction">
                {(["ltr", "rtl"] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    className={`cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm${
                      (element.direction ?? "ltr") === direction ? " is-active" : ""
                    }`}
                    aria-pressed={(element.direction ?? "ltr") === direction}
                    onClick={() => {
                      store.updateElement(element.id, { direction });
                    }}
                  >
                    {direction.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="cert-studio__field">
            <span className="cert-studio__field-label">Align</span>
            <div className="cert-studio__seg" role="group" aria-label="Text align">
              {(["left", "center", "right", "justify"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  className={`cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm${
                    element.align === align ? " is-active" : ""
                  }`}
                  aria-pressed={element.align === align}
                  aria-label={`Align ${align}`}
                  onClick={() => {
                    store.updateElement(element.id, { align });
                  }}
                >
                  {align.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="cert-studio__field">
            <label className="cert-studio__field-label" htmlFor="insp-variable">
              Variable binding
            </label>
            {element.variableKey ? (
              <div className="cert-studio__binding" style={{ marginBottom: 8 }}>
                <Database size={14} aria-hidden="true" />
                <span>{element.variableKey}</span>
              </div>
            ) : null}
            <select
              id="insp-variable"
              className="cert-studio__input"
              value={element.variableKey ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                store.setVariableKey(element.id, value.length > 0 ? value : undefined);
              }}
            >
              <option value="">None (static text)</option>
              {variables.map((variable) => (
                <option key={variable.key} value={variable.key}>
                  {variable.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      {element.type === "shape" ? (
        <>
          <div className="cert-studio__row">
            <div className="cert-studio__field">
              <label className="cert-studio__field-label" htmlFor="insp-fill">
                Fill
              </label>
              <input
                id="insp-fill"
                type="color"
                className="cert-studio__input cert-studio__color"
                value={element.fill ?? "#000000"}
                onChange={(event) => {
                  store.updateElement(element.id, { fill: event.target.value });
                }}
              />
            </div>
            <div className="cert-studio__field">
              <label className="cert-studio__field-label" htmlFor="insp-stroke">
                Stroke
              </label>
              <input
                id="insp-stroke"
                type="color"
                className="cert-studio__input cert-studio__color"
                value={element.stroke ?? "#000000"}
                onChange={(event) => {
                  store.updateElement(element.id, { stroke: event.target.value });
                }}
              />
            </div>
          </div>
          <NumberInput
            label="Stroke width"
            value={element.strokeWidth ?? 0}
            min={0}
            onChange={(v) => {
              store.updateElement(element.id, { strokeWidth: v });
            }}
          />
        </>
      ) : null}

      <section>
        <h3 className="cert-studio__label-mono" style={{ marginBottom: 12 }}>
          Brand colors
        </h3>
        <div className="cert-studio__swatches" role="group" aria-label="Apply brand color">
          {swatches.map(({ color, label }) => (
            <button
              key={`insp-${label}-${color}`}
              type="button"
              className="cert-studio__swatch"
              style={{ background: color }}
              title={label}
              aria-label={`Apply ${label}`}
              onClick={() => {
                store.applyColorToSelection(color);
              }}
            />
          ))}
        </div>
      </section>

      <div className="cert-studio__field-group" aria-label="Arrange">
        <div className="cert-studio__row">
          <button
            type="button"
            className="cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm"
            onClick={() => {
              store.bringForward();
            }}
          >
            Forward
          </button>
          <button
            type="button"
            className="cert-studio__btn cert-studio__btn--ghost cert-studio__btn--sm"
            onClick={() => {
              store.sendBackward();
            }}
          >
            Backward
          </button>
        </div>
      </div>
    </div>
  );
});
