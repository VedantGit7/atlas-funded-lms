/**
 * Unit helpers for the certificate studio.
 *
 * The design document stores page + element geometry in the document unit
 * (usually millimetres). Konva works in device-independent pixels, so we
 * convert using a fixed 96dpi factor: 1in = 25.4mm = 96px.
 */

import type { CertificateDesignPage } from "@atlas/contracts/certificates/certificate-design-document";

/** Pixels per millimetre at 96dpi. */
export const PX_PER_MM = 96 / 25.4; // ≈ 3.779527559

/** Pixels per inch at 96dpi. */
export const PX_PER_IN = 96;

export type DocumentUnit = CertificateDesignPage["unit"];

/** Convert a value in the given document unit to CSS/Konva pixels. */
export function toPx(value: number, unit: DocumentUnit): number {
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

/** Convert a pixel value back into the given document unit. */
export function fromPx(value: number, unit: DocumentUnit): number {
  switch (unit) {
    case "mm":
      return value / PX_PER_MM;
    case "in":
      return value / PX_PER_IN;
    case "px":
    default:
      return value;
  }
}

/** Paper dimensions of a page, in pixels. */
export function pagePixelSize(page: Pick<CertificateDesignPage, "width" | "height" | "unit">): {
  width: number;
  height: number;
} {
  return {
    width: toPx(page.width, page.unit),
    height: toPx(page.height, page.unit),
  };
}

/** Human-readable page label, e.g. `297 × 210 mm`. */
export function formatPageSize(
  page: Pick<CertificateDesignPage, "width" | "height" | "unit">,
): string {
  const round = (n: number) => String(Math.round(n * 100) / 100);
  return `${round(page.width)} × ${round(page.height)} ${page.unit}`;
}

/** Ruler strip thickness used by the Konva stage (must match studio-canvas). */
export const STUDIO_RULER_PX = 22;
/** Breathing room between rulers and paper (must match studio-canvas). */
export const STUDIO_PAPER_PAD_PX = 20;

/**
 * Zoom that fits paper + rulers into a viewport (GrapesJS / Excalidraw style).
 * `scale = min(availW / contentW, availH / contentH)`, clamped.
 */
export function computeFitZoom(args: {
  viewportWidth: number;
  viewportHeight: number;
  paperWidthPx: number;
  paperHeightPx: number;
  bleedPx?: number;
  /** Extra inset inside the viewport so the paper is not flush to the edges. */
  marginPx?: number;
  minZoom?: number;
  maxZoom?: number;
}): number {
  const bleed = Math.max(0, args.bleedPx ?? 0);
  const margin = Math.max(0, args.marginPx ?? 16);
  const minZoom = args.minZoom ?? 0.1;
  const maxZoom = args.maxZoom ?? 3;

  const availW = Math.max(0, args.viewportWidth - margin * 2);
  const availH = Math.max(0, args.viewportHeight - margin * 2);

  // stage = ruler + pad + (paper + 2*bleed) * zoom + pad
  const fixedChrome = STUDIO_RULER_PX + STUDIO_PAPER_PAD_PX * 2;
  const contentW = args.paperWidthPx + bleed * 2;
  const contentH = args.paperHeightPx + bleed * 2;

  const scaleX = contentW > 0 ? (availW - fixedChrome) / contentW : minZoom;
  const scaleY = contentH > 0 ? (availH - fixedChrome) / contentH : minZoom;
  const zoom = Math.min(scaleX, scaleY);

  if (!Number.isFinite(zoom) || zoom <= 0) return minZoom;
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}
