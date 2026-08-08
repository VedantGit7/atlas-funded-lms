"use client";

/**
 * Real thumbnail of a CertificateDesignDocument, drawn as a scalable SVG.
 *
 * The SVG `viewBox` is the page in pixels, so the preview scales to fit any
 * card with no per-card measuring. Geometry is converted from the document
 * unit to 96dpi pixels (matching the studio canvas and HTML export); variable
 * placeholders are resolved to their sample values.
 */

import type {
  CertificateDesignDocument,
  CertificateDesignElement,
  CertificateTextElement,
} from "@atlas/contracts/certificates/certificate-design-document";
import { pagePixelSize, toPx, type DocumentUnit } from "./studio-units";

function resolveText(
  element: CertificateTextElement,
  doc: CertificateDesignDocument,
): string {
  const sampleFor = (key: string): string | undefined =>
    doc.variables?.find((v) => v.key === key)?.sampleValue;

  if (element.variableKey) {
    const sample = sampleFor(element.variableKey);
    if (sample) return sample;
  }
  const resolved = element.text.replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
    (_match, key: string) => sampleFor(key) ?? "",
  );
  // Collapse newlines — the SVG preview renders a single line per element.
  return resolved.replace(/\s*\n\s*/g, " ").trim();
}

function textAnchorFor(align: CertificateTextElement["align"]): {
  x: (x: number, w: number) => number;
  anchor: "start" | "middle" | "end";
} {
  switch (align) {
    case "center":
      return { x: (x, w) => x + w / 2, anchor: "middle" };
    case "right":
      return { x: (x, w) => x + w, anchor: "end" };
    case "left":
    case "justify":
    default:
      return { x: (x) => x, anchor: "start" };
  }
}

function ElementNode({
  element,
  doc,
  unit,
}: {
  element: CertificateDesignElement;
  doc: CertificateDesignDocument;
  unit: DocumentUnit;
}) {
  if (element.hidden) return null;

  const x = toPx(element.x, unit);
  const y = toPx(element.y, unit);
  const w = toPx(element.width, unit);
  const h = toPx(element.height, unit);
  const rotate = element.rotation
    ? `rotate(${String(element.rotation)} ${String(x)} ${String(y)})`
    : undefined;

  switch (element.type) {
    case "text": {
      const { x: anchorX, anchor } = textAnchorFor(element.align);
      return (
        <text
          x={anchorX(x, w)}
          y={y + element.fontSize * 0.82}
          fontFamily={element.fontFamily}
          fontSize={element.fontSize}
          fontWeight={element.fontWeight}
          fontStyle={element.fontStyle ?? "normal"}
          fill={element.color}
          textAnchor={anchor}
          {...(element.letterSpacing ? { letterSpacing: element.letterSpacing } : {})}
          {...(rotate ? { transform: rotate } : {})}
        >
          {resolveText(element, doc)}
        </text>
      );
    }
    case "shape": {
      if (element.shape === "ellipse") {
        return (
          <ellipse
            cx={x + w / 2}
            cy={y + h / 2}
            rx={w / 2}
            ry={h / 2}
            fill={element.fill ?? "transparent"}
            stroke={element.stroke ?? "none"}
            strokeWidth={element.strokeWidth ?? 0}
            {...(rotate ? { transform: rotate } : {})}
          />
        );
      }
      if (element.shape === "line") {
        return (
          <line
            x1={x}
            y1={y + h / 2}
            x2={x + w}
            y2={y + h / 2}
            stroke={element.stroke ?? "#1a1f26"}
            strokeWidth={element.strokeWidth ?? 2}
            {...(rotate ? { transform: rotate } : {})}
          />
        );
      }
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={element.cornerRadius ?? 0}
          fill={element.fill ?? "transparent"}
          stroke={element.stroke ?? "none"}
          strokeWidth={element.strokeWidth ?? 0}
          {...(rotate ? { transform: rotate } : {})}
        />
      );
    }
    case "image":
      return (
        <image
          href={element.src}
          x={x}
          y={y}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid meet"
          opacity={element.opacity ?? 1}
          {...(rotate ? { transform: rotate } : {})}
        />
      );
    case "qr":
      return (
        <g {...(rotate ? { transform: rotate } : {})}>
          <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke="#1a1f26" strokeWidth={1} />
          <text
            x={x + w / 2}
            y={y + h / 2 + w * 0.06}
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize={Math.max(6, w * 0.28)}
            fontWeight={700}
            fill="#1a1f26"
          >
            QR
          </text>
        </g>
      );
    case "signature":
      return (
        <line
          x1={x}
          y1={y + h}
          x2={x + w}
          y2={y + h}
          stroke="#1a1f26"
          strokeWidth={1.5}
          {...(rotate ? { transform: rotate } : {})}
        />
      );
    default:
      return null;
  }
}

export function StudioDocPreview({
  document: doc,
  className,
}: {
  document: CertificateDesignDocument;
  className?: string;
}) {
  const unit = doc.page.unit;
  const { width, height } = pagePixelSize(doc.page);
  const ordered = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
  const bg = doc.background;
  const gradientId = "cert-preview-grad";
  const gradientColors =
    bg.type === "gradient"
      ? (bg.value.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g) ?? [])
      : [];

  return (
    <svg
      className={className}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      role="img"
      aria-label="Certificate preview"
      style={{ display: "block" }}
    >
      {bg.type === "gradient" && gradientColors.length >= 2 ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {gradientColors.map((color, index) => (
              <stop
                key={`${color}-${String(index)}`}
                offset={index / (gradientColors.length - 1)}
                stopColor={color}
              />
            ))}
          </linearGradient>
        </defs>
      ) : null}

      {bg.type === "image" ? (
        <>
          <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
          <image
            href={bg.value}
            x={0}
            y={0}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={
            bg.type === "gradient" && gradientColors.length >= 2
              ? `url(#${gradientId})`
              : bg.type === "color"
                ? bg.value
                : "#ffffff"
          }
        />
      )}

      {ordered.map((element) => (
        <ElementNode key={element.id} element={element} doc={doc} unit={unit} />
      ))}
    </svg>
  );
}
