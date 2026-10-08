/**
 * Shared HTML renderer for CertificateDesignDocument.
 *
 * Geometry uses the same 96dpi mm→px conversion as the studio canvas.
 * QR codes require the async entry point (`QRCode.toDataURL`).
 */

import QRCode from "qrcode";
import type {
  CertificateDesignDocument,
  CertificateDesignElement,
  CertificateDesignPage,
  CertificateDesignRule,
  CertificateQrElement,
  CertificateTextElement,
} from "./certificate-design-document";

/** Pixels per millimetre at 96dpi — mirrors studio-units. */
const PX_PER_MM = 96 / 25.4;
const PX_PER_IN = 96;

type DocumentUnit = CertificateDesignPage["unit"];

function toPx(value: number, unit: DocumentUnit): number {
  switch (unit) {
    case "mm":
      return value * PX_PER_MM;
    case "in":
      return value * PX_PER_IN;
    case "px":
    default:
      return value;
  }
}

function pagePixelSize(page: Pick<CertificateDesignPage, "width" | "height" | "unit">): {
  width: number;
  height: number;
} {
  return {
    width: toPx(page.width, page.unit),
    height: toPx(page.height, page.unit),
  };
}

/**
 * Physical page size as CSS lengths in the document's own unit (e.g. "297mm").
 * Shared by the `@page` rule and the PDF renderer so printed output matches the
 * on-screen page box. Width/height are authoritative — the studio derives
 * `orientation` from them — and bleed sits outside the trim box in the studio,
 * so it does not enlarge the page.
 */
export function pageCssSize(page: Pick<CertificateDesignPage, "width" | "height" | "unit">): {
  width: string;
  height: string;
} {
  return {
    width: `${page.width}${page.unit}`,
    height: `${page.height}${page.unit}`,
  };
}

export type DesignToHtmlOptions = {
  watermark?: boolean;
  verificationUrl?: string;
  /** Draw bleed / safe area outlines for print preview. */
  showBleedSafe?: boolean;
};

/** Build sample merge data from document variable definitions. */
export function sampleDataFromVariables(doc: CertificateDesignDocument): Record<string, string> {
  const data: Record<string, string> = {};
  for (const variable of doc.variables ?? []) {
    data[variable.key] = variable.sampleValue ?? variable.label;
  }
  if (!data["verification_url"]) {
    data["verification_url"] = "https://verify.example.com/preview";
  }
  if (!data["credential_id"]) {
    data["credential_id"] = "CRED-PREVIEW-0001";
  }
  return data;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveTextContent(
  element: CertificateTextElement,
  data: Record<string, string>,
  doc: CertificateDesignDocument,
): string {
  if (element.variableKey) {
    const fromData = data[element.variableKey];
    if (fromData != null && fromData.length > 0) return fromData;
    const sample = doc.variables?.find((v) => v.key === element.variableKey)?.sampleValue;
    if (sample != null && sample.length > 0) return sample;
  }

  return element.text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    if (data[key] != null) return data[key];
    const sample = doc.variables?.find((v) => v.key === key)?.sampleValue;
    return sample ?? "";
  });
}

function evaluateRule(rule: CertificateDesignRule, data: Record<string, string>): boolean {
  const raw = data[rule.when.variableKey] ?? "";
  const expected = rule.when.value;

  switch (rule.when.op) {
    case "eq":
      return raw === String(expected);
    case "contains":
      return raw.includes(String(expected));
    case "gte": {
      const n = Number(raw);
      const e = typeof expected === "number" ? expected : Number(expected);
      return Number.isFinite(n) && Number.isFinite(e) && n >= e;
    }
    case "lte": {
      const n = Number(raw);
      const e = typeof expected === "number" ? expected : Number(expected);
      return Number.isFinite(n) && Number.isFinite(e) && n <= e;
    }
    default:
      return false;
  }
}

/** Resolve which element ids are hidden after applying rules + element.hidden. */
export function resolveHiddenElementIds(
  doc: CertificateDesignDocument,
  data: Record<string, string>,
): Set<string> {
  const hidden = new Set<string>();
  for (const el of doc.elements) {
    if (el.hidden) hidden.add(el.id);
  }

  for (const rule of doc.rules ?? []) {
    if (!evaluateRule(rule, data)) continue;
    if (rule.then.action === "hide") {
      hidden.add(rule.then.elementId);
    } else if (rule.then.action === "show") {
      hidden.delete(rule.then.elementId);
    }
  }

  return hidden;
}

function qrPayload(
  element: CertificateQrElement,
  data: Record<string, string>,
  options?: DesignToHtmlOptions,
): string {
  switch (element.valueSource) {
    case "verification_url":
      return (
        options?.verificationUrl ?? data["verification_url"] ?? "https://verify.example.com/preview"
      );
    case "credential_id":
      return data["credential_id"] ?? "CRED-PREVIEW-0001";
    case "custom":
      return element.customValue ?? data["qr_custom"] ?? "";
    default:
      return "";
  }
}

function backgroundCss(doc: CertificateDesignDocument): string {
  const bg = doc.background;
  if (bg.type === "color") {
    return `background-color:${escapeHtml(bg.value)};`;
  }
  if (bg.type === "image") {
    return `background-image:url("${escapeHtml(bg.value)}");background-size:cover;background-position:center;`;
  }
  // gradient — value is expected to be a CSS gradient
  return `background:${escapeHtml(bg.value)};`;
}

function elementBaseStyle(element: CertificateDesignElement, unit: DocumentUnit): string {
  const left = toPx(element.x, unit);
  const top = toPx(element.y, unit);
  const width = toPx(element.width, unit);
  const height = toPx(element.height, unit);
  const rotation = element.rotation ?? 0;
  const transform =
    rotation !== 0 ? `transform:rotate(${rotation}deg);transform-origin:top left;` : "";
  return [
    "position:absolute",
    `left:${left}px`,
    `top:${top}px`,
    `width:${width}px`,
    `height:${height}px`,
    `z-index:${element.zIndex}`,
    "box-sizing:border-box",
    "overflow:hidden",
    transform,
  ]
    .filter(Boolean)
    .join(";");
}

function renderTextElement(
  element: CertificateTextElement,
  doc: CertificateDesignDocument,
  data: Record<string, string>,
  unit: DocumentUnit,
): string {
  const content = escapeHtml(resolveTextContent(element, data, doc));
  const lineHeight = element.lineHeight ?? 1.2;
  const letterSpacing = element.letterSpacing != null ? `${element.letterSpacing}px` : "normal";
  const fontWeight =
    typeof element.fontWeight === "number"
      ? String(element.fontWeight)
      : escapeHtml(element.fontWeight);
  const fontStyle = element.fontStyle ? escapeHtml(element.fontStyle) : "normal";
  const direction = element.direction === "rtl" ? "rtl" : "ltr";

  const style = [
    elementBaseStyle(element, unit),
    `font-family:${escapeHtml(element.fontFamily)}`,
    `font-size:${element.fontSize}px`,
    `font-weight:${fontWeight}`,
    `font-style:${fontStyle}`,
    `color:${escapeHtml(element.color)}`,
    `text-align:${element.align}`,
    `line-height:${lineHeight}`,
    `letter-spacing:${letterSpacing}`,
    `direction:${direction}`,
    "white-space:pre-wrap",
    "word-wrap:break-word",
  ].join(";");

  return `<div data-element-id="${escapeHtml(element.id)}" data-type="text" style="${style}">${content}</div>`;
}

function renderShapeElement(
  element: Extract<CertificateDesignElement, { type: "shape" }>,
  unit: DocumentUnit,
): string {
  const base = elementBaseStyle(element, unit);
  if (element.shape === "ellipse") {
    const style = [
      base,
      `background:${escapeHtml(element.fill ?? "transparent")}`,
      `border:${element.strokeWidth ?? 0}px solid ${escapeHtml(element.stroke ?? "transparent")}`,
      "border-radius:50%",
    ].join(";");
    return `<div data-element-id="${escapeHtml(element.id)}" data-type="shape" style="${style}"></div>`;
  }
  if (element.shape === "line") {
    const stroke = escapeHtml(element.stroke ?? "#1a1f26");
    const sw = element.strokeWidth ?? 2;
    const style = [base, "display:flex", "align-items:center"].join(";");
    return `<div data-element-id="${escapeHtml(element.id)}" data-type="shape" style="${style}"><div style="width:100%;height:0;border-top:${sw}px solid ${stroke};"></div></div>`;
  }
  const radius = element.cornerRadius ?? 0;
  const style = [
    base,
    `background:${escapeHtml(element.fill ?? "transparent")}`,
    `border:${element.strokeWidth ?? 0}px solid ${escapeHtml(element.stroke ?? "transparent")}`,
    `border-radius:${radius}px`,
  ].join(";");
  return `<div data-element-id="${escapeHtml(element.id)}" data-type="shape" style="${style}"></div>`;
}

function renderImageElement(
  element: Extract<CertificateDesignElement, { type: "image" }>,
  data: Record<string, string>,
  unit: DocumentUnit,
): string {
  const src = (element.variableKey ? data[element.variableKey] : undefined) ?? element.src;
  const opacity = element.opacity ?? 1;
  const style = [elementBaseStyle(element, unit), `opacity:${opacity}`].join(";");
  return `<img data-element-id="${escapeHtml(element.id)}" data-type="image" src="${escapeHtml(src)}" alt="" style="${style};object-fit:contain;display:block;" />`;
}

function renderQrPlaceholder(element: CertificateQrElement, unit: DocumentUnit): string {
  const style = [
    elementBaseStyle(element, unit),
    "background:#fff",
    "border:1px solid #1a1f26",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-family:sans-serif",
    "font-size:12px",
    "font-weight:700",
    "color:#1a1f26",
  ].join(";");
  return `<div data-element-id="${escapeHtml(element.id)}" data-type="qr" style="${style}">QR</div>`;
}

function renderQrWithDataUrl(
  element: CertificateQrElement,
  dataUrl: string,
  unit: DocumentUnit,
): string {
  const style = [elementBaseStyle(element, unit), "background:#fff"].join(";");
  return `<img data-element-id="${escapeHtml(element.id)}" data-type="qr" src="${escapeHtml(dataUrl)}" alt="QR" style="${style};object-fit:contain;display:block;" />`;
}

function renderSignatureElement(
  element: Extract<CertificateDesignElement, { type: "signature" }>,
  data: Record<string, string>,
  unit: DocumentUnit,
): string {
  const label = (element.labelVariableKey ? data[element.labelVariableKey] : undefined) ?? "";
  const title = (element.titleVariableKey ? data[element.titleVariableKey] : undefined) ?? "";
  const style = elementBaseStyle(element, unit);
  const img = element.imageSrc
    ? `<img src="${escapeHtml(element.imageSrc)}" alt="" style="max-width:100%;max-height:70%;object-fit:contain;display:block;margin:0 auto;" />`
    : "";
  const meta = [
    label ? `<div style="font-size:12px;text-align:center;">${escapeHtml(label)}</div>` : "",
    title
      ? `<div style="font-size:11px;text-align:center;opacity:0.7;">${escapeHtml(title)}</div>`
      : "",
  ].join("");
  return `<div data-element-id="${escapeHtml(element.id)}" data-type="signature" style="${style};display:flex;flex-direction:column;justify-content:flex-end;border-bottom:1.5px solid #1a1f26;">${img}${meta}</div>`;
}

type QrDataUrls = Map<string, string>;

function renderElements(
  doc: CertificateDesignDocument,
  data: Record<string, string>,
  hidden: Set<string>,
  unit: DocumentUnit,
  qrDataUrls?: QrDataUrls,
): string {
  const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
  const parts: string[] = [];

  for (const element of sorted) {
    if (hidden.has(element.id)) continue;

    switch (element.type) {
      case "text":
        parts.push(renderTextElement(element, doc, data, unit));
        break;
      case "shape":
        parts.push(renderShapeElement(element, unit));
        break;
      case "image":
        parts.push(renderImageElement(element, data, unit));
        break;
      case "qr": {
        const url = qrDataUrls?.get(element.id);
        parts.push(
          url ? renderQrWithDataUrl(element, url, unit) : renderQrPlaceholder(element, unit),
        );
        break;
      }
      case "signature":
        parts.push(renderSignatureElement(element, data, unit));
        break;
      default:
        break;
    }
  }

  return parts.join("\n");
}

function bleedSafeOverlays(
  doc: CertificateDesignDocument,
  pageWidthPx: number,
  pageHeightPx: number,
): string {
  const parts: string[] = [];
  if (doc.page.bleedMm != null && doc.page.bleedMm > 0) {
    const b = doc.page.bleedMm * PX_PER_MM;
    parts.push(
      `<div data-overlay="bleed" style="position:absolute;inset:0;border:${b}px solid rgba(239,68,68,0.35);pointer-events:none;box-sizing:border-box;z-index:9998;"></div>`,
    );
  }
  if (doc.page.safeMm != null && doc.page.safeMm > 0) {
    const s = doc.page.safeMm * PX_PER_MM;
    parts.push(
      `<div data-overlay="safe" style="position:absolute;left:${s}px;top:${s}px;width:${pageWidthPx - s * 2}px;height:${pageHeightPx - s * 2}px;border:1px dashed rgba(46,107,255,0.55);pointer-events:none;box-sizing:border-box;z-index:9998;"></div>`,
    );
  }
  return parts.join("\n");
}

function wrapDocumentHtml(
  doc: CertificateDesignDocument,
  bodyInner: string,
  options?: DesignToHtmlOptions,
): string {
  const { width, height } = pagePixelSize(doc.page);
  const pageSize = pageCssSize(doc.page);
  const watermark =
    options?.watermark === true
      ? `<div data-watermark="preview" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999;overflow:hidden;"><span style="font-family:system-ui,sans-serif;font-size:${Math.round(Math.min(width, height) * 0.12)}px;font-weight:800;letter-spacing:0.12em;color:rgba(0,0,0,0.08);transform:rotate(-28deg);user-select:none;">PREVIEW</span></div>`
      : "";

  const overlays = options?.showBleedSafe === true ? bleedSafeOverlays(doc, width, height) : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(doc.locale ?? "en")}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Certificate Preview</title>
<style>
  html, body { margin: 0; padding: 0; background: #e8ecf1; }
  .cert-page {
    position: relative;
    width: ${width}px;
    height: ${height}px;
    margin: 24px auto;
    overflow: hidden;
    ${backgroundCss(doc)}
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  }
  @page { size: ${pageSize.width} ${pageSize.height}; margin: 0; }
  @media print {
    html, body { background: #fff; }
    /* Size containment stops elements lying wholly off the page (e.g. after an
       orientation flip) from widening the layout, which makes Chromium shrink
       the whole certificate to fit the PDF page. */
    .cert-page { margin: 0; box-shadow: none; contain: strict; }
  }
</style>
</head>
<body>
<div class="cert-page" data-schema-version="${doc.schemaVersion}">
${bodyInner}
${overlays}
${watermark}
</div>
</body>
</html>`;
}

/**
 * Synchronous HTML render. QR elements render as placeholders —
 * use `designDocumentToHtmlAsync` for real QR data URLs.
 */
export function designDocumentToHtml(
  doc: CertificateDesignDocument,
  data: Record<string, string>,
  options?: DesignToHtmlOptions,
): string {
  const unit = doc.page.unit;
  const hidden = resolveHiddenElementIds(doc, data);
  const elementsHtml = renderElements(doc, data, hidden, unit);
  return wrapDocumentHtml(doc, elementsHtml, options);
}

/** Async HTML render with QR codes as PNG data URLs. */
export async function designDocumentToHtmlAsync(
  doc: CertificateDesignDocument,
  data: Record<string, string>,
  options?: DesignToHtmlOptions,
): Promise<string> {
  const unit = doc.page.unit;
  const hidden = resolveHiddenElementIds(doc, data);
  const qrDataUrls: QrDataUrls = new Map();

  await Promise.all(
    doc.elements
      .filter((el): el is CertificateQrElement => el.type === "qr" && !hidden.has(el.id))
      .map(async (el) => {
        const payload = qrPayload(el, data, options);
        if (!payload) return;
        const sizePx = Math.max(64, Math.round(toPx(Math.min(el.width, el.height), unit)));
        const dataUrl = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: sizePx,
          type: "image/png",
        });
        qrDataUrls.set(el.id, dataUrl);
      }),
  );

  const elementsHtml = renderElements(doc, data, hidden, unit, qrDataUrls);
  return wrapDocumentHtml(doc, elementsHtml, options);
}
