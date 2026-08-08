"use client";

/**
 * Certificate Studio canvas — react-konva stage.
 *
 * Renders mm rulers along the top/left, the certificate paper with optional
 * grid and bleed/safe guides, every visible element, smart snap guides while
 * dragging, and a Transformer for the current (unlocked) selection. Element
 * geometry is stored in the document unit (mm) and converted to pixels for
 * rendering; the paper layer is scaled by the store zoom.
 */

import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Shape,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  fromPx,
  pagePixelSize,
  toPx,
  PX_PER_MM,
  STUDIO_PAPER_PAD_PX,
  STUDIO_RULER_PX,
  type DocumentUnit,
} from "./studio-units";
import {
  collectSnapTargets,
  computeSnappedPosition,
  type SnapGuide,
} from "./studio-snapping";
import type {
  ElementInstance,
  ImageElementInstance,
  StudioStoreInstance,
} from "./studio-store";

const MIN_ELEMENT_PX = 6;
/** Snap threshold in screen pixels (converted to paper px by zoom). */
const SNAP_THRESHOLD_PX = 6;
/** Candidate minor-tick steps for the rulers, in millimetres. */
const RULER_STEPS_MM = [1, 2, 5, 10, 25, 50, 100];
const RULER_PX = STUDIO_RULER_PX;
const PAPER_PAD_PX = STUDIO_PAPER_PAD_PX;

type StudioCanvasProps = {
  store: StudioStoreInstance;
};

function fontStyleFor(element: {
  fontWeight: number | string;
  fontStyle?: string | undefined;
}): string {
  const numeric =
    typeof element.fontWeight === "number"
      ? element.fontWeight
      : Number.parseInt(element.fontWeight, 10) || 400;
  const bold = numeric >= 600 || element.fontWeight === "bold";
  const italic = element.fontStyle === "italic";
  const style = [bold ? "bold" : "", italic ? "italic" : ""].join(" ").trim();
  return style.length > 0 ? style : "normal";
}

const ElementImageNode = observer(function ElementImageNode({
  element,
  unit,
}: {
  element: ImageElementInstance;
  unit: DocumentUnit;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!element.src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    const handleLoad = () => { setImage(img); };
    img.addEventListener("load", handleLoad);
    img.src = element.src;
    return () => {
      img.removeEventListener("load", handleLoad);
    };
  }, [element.src]);

  return (
    <KonvaImage
      image={image ?? undefined}
      width={toPx(element.width, unit)}
      height={toPx(element.height, unit)}
      opacity={element.opacity ?? 1}
    />
  );
});

const ElementChildren = observer(function ElementChildren({
  element,
  store,
  unit,
}: {
  element: ElementInstance;
  store: StudioStoreInstance;
  unit: DocumentUnit;
}) {
  const w = toPx(element.width, unit);
  const h = toPx(element.height, unit);

  switch (element.type) {
    case "text":
      return (
        <Text
          text={store.displayTextFor(element)}
          width={w}
          fontSize={element.fontSize}
          fontFamily={element.fontFamily}
          fontStyle={fontStyleFor(element)}
          fill={element.color}
          align={element.align}
          lineHeight={element.lineHeight ?? 1.2}
          letterSpacing={element.letterSpacing ?? 0}
          wrap="word"
          listening
        />
      );
    case "shape":
      if (element.shape === "ellipse") {
        return (
          <Ellipse
            x={w / 2}
            y={h / 2}
            radiusX={w / 2}
            radiusY={h / 2}
            fill={element.fill ?? "transparent"}
            stroke={element.stroke ?? "transparent"}
            strokeWidth={element.strokeWidth ?? 0}
          />
        );
      }
      if (element.shape === "line") {
        return (
          <Line
            points={[0, h / 2, w, h / 2]}
            stroke={element.stroke ?? "#1a1f26"}
            strokeWidth={element.strokeWidth ?? 2}
            lineCap="round"
          />
        );
      }
      return (
        <Rect
          width={w}
          height={h}
          fill={element.fill ?? "transparent"}
          stroke={element.stroke ?? "transparent"}
          strokeWidth={element.strokeWidth ?? 0}
          cornerRadius={element.cornerRadius ?? 0}
        />
      );
    case "image":
      return <ElementImageNode element={element} unit={unit} />;
    case "qr":
      return (
        <>
          <Rect width={w} height={h} fill="#ffffff" stroke="#1a1f26" strokeWidth={1} />
          <Rect
            x={w * 0.14}
            y={h * 0.14}
            width={w * 0.72}
            height={h * 0.72}
            stroke="#1a1f26"
            strokeWidth={1}
            dash={[4, 3]}
          />
          <Text
            text="QR"
            width={w}
            y={h / 2 - 8}
            align="center"
            fontSize={13}
            fontStyle="bold"
            fill="#1a1f26"
          />
        </>
      );
    case "signature":
      return (
        <>
          <Line
            points={[0, h - 18, w, h - 18]}
            stroke="#1a1f26"
            strokeWidth={1.5}
            lineCap="round"
          />
          <Text
            text="Signature"
            width={w}
            y={h - 14}
            align="center"
            fontSize={12}
            fontStyle="italic"
            fill="#8b95a5"
          />
        </>
      );
    default:
      return null;
  }
});

const ElementNode = observer(function ElementNode({
  element,
  store,
  unit,
  registerNode,
  onSnapDragMove,
  onSnapDragEnd,
}: {
  element: ElementInstance;
  store: StudioStoreInstance;
  unit: DocumentUnit;
  registerNode: (id: string, node: Konva.Group | null) => void;
  onSnapDragMove: (id: string, node: Konva.Node) => void;
  onSnapDragEnd: () => void;
}) {
  if (!store.isElementVisible(element)) {
    registerNode(element.id, null);
    return null;
  }

  const draggable = !element.locked;

  const handleSelect = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    event.cancelBubble = true;
    const additive = event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey;
    if (additive) {
      store.toggleInSelection(element.id);
    } else {
      store.setSelection([element.id]);
    }
  };

  const handleDragMove = (event: KonvaEventObject<DragEvent>) => {
    onSnapDragMove(element.id, event.target);
  };

  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    const node = event.target;
    store.setGeometry(element.id, {
      x: fromPx(node.x(), unit),
      y: fromPx(node.y(), unit),
    });
    onSnapDragEnd();
  };

  const handleTransformEnd = (event: KonvaEventObject<Event>) => {
    const node = event.target as Konva.Group;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const nextWidthPx = Math.max(MIN_ELEMENT_PX, toPx(element.width, unit) * scaleX);
    const nextHeightPx = Math.max(MIN_ELEMENT_PX, toPx(element.height, unit) * scaleY);
    store.setGeometry(element.id, {
      x: fromPx(node.x(), unit),
      y: fromPx(node.y(), unit),
      width: fromPx(nextWidthPx, unit),
      height: fromPx(nextHeightPx, unit),
      rotation: node.rotation(),
    });
  };

  return (
    <Group
      ref={(node) => { registerNode(element.id, node); }}
      x={toPx(element.x, unit)}
      y={toPx(element.y, unit)}
      rotation={element.rotation ?? 0}
      draggable={draggable}
      onMouseDown={handleSelect}
      onTap={handleSelect}
      onDragStart={() => { store.beginInteraction(); }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformStart={() => { store.beginInteraction(); }}
      onTransformEnd={handleTransformEnd}
    >
      <ElementChildren element={element} store={store} unit={unit} />
    </Group>
  );
});

/** Extract 2+ colors from a CSS gradient string for an approximate preview. */
function extractGradientColorStops(value: string): (number | string)[] | null {
  const colors = value.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)/g);
  if (!colors || colors.length < 2) return null;
  const stops: (number | string)[] = [];
  colors.forEach((color, index) => {
    stops.push(index / (colors.length - 1), color);
  });
  return stops;
}

/**
 * Paper background: solid color, a cover-fitted image, or an approximate
 * vertical gradient. The base Rect also carries the paper drop shadow.
 * Element geometry already accounts for the paper; this fills 0,0 → w,h.
 */
const PaperBackground = observer(function PaperBackground({
  background,
  width,
  height,
}: {
  background: { type: "color" | "image" | "gradient"; value: string };
  width: number;
  height: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const src = background.type === "image" ? background.value : "";

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    const handleLoad = () => { setImage(img); };
    img.addEventListener("load", handleLoad);
    img.src = src;
    return () => {
      img.removeEventListener("load", handleLoad);
    };
  }, [src]);

  const solidFill = background.type === "color" ? background.value : "#ffffff";
  const gradientStops =
    background.type === "gradient" ? extractGradientColorStops(background.value) : null;

  // Cover-fit crop so the artwork fills the paper without distortion.
  let crop: { x: number; y: number; width: number; height: number } | undefined;
  if (image) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    if (iw > 0 && ih > 0) {
      const targetRatio = width / height;
      const imageRatio = iw / ih;
      if (imageRatio > targetRatio) {
        const cropW = ih * targetRatio;
        crop = { x: (iw - cropW) / 2, y: 0, width: cropW, height: ih };
      } else {
        const cropH = iw / targetRatio;
        crop = { x: 0, y: (ih - cropH) / 2, width: iw, height: cropH };
      }
    }
  }

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        {...(gradientStops
          ? {
              fillLinearGradientStartPoint: { x: 0, y: 0 },
              fillLinearGradientEndPoint: { x: 0, y: height },
              fillLinearGradientColorStops: gradientStops,
            }
          : { fill: solidFill })}
        shadowColor="rgba(0, 0, 0, 0.55)"
        shadowBlur={28}
        shadowOffsetY={10}
        listening={false}
      />
      {image ? (
        <KonvaImage
          image={image}
          x={0}
          y={0}
          width={width}
          height={height}
          {...(crop ? { crop } : {})}
          listening={false}
        />
      ) : null}
    </>
  );
});

/** mm ruler strips along the top and left stage edges (unscaled layer). */
function StudioRulers({
  zoom,
  originX,
  originY,
  stageWidth,
  stageHeight,
}: {
  zoom: number;
  originX: number;
  originY: number;
  stageWidth: number;
  stageHeight: number;
}) {
  const sceneFunc = useCallback(
    (context: Konva.Context) => {
      const c = context._context;
      const pxPerMm = PX_PER_MM * zoom;
      const minor = RULER_STEPS_MM.find((s) => s * pxPerMm >= 7) ?? 100;
      const major = minor * 5;

      c.fillStyle = "#0f1419";
      c.fillRect(0, 0, stageWidth, RULER_PX);
      c.fillRect(0, 0, RULER_PX, stageHeight);
      c.fillStyle = "rgba(255,255,255,0.08)";
      c.fillRect(0, RULER_PX - 1, stageWidth, 1);
      c.fillRect(RULER_PX - 1, 0, 1, stageHeight);

      c.font = '9px "Plus Jakarta Sans", system-ui, sans-serif';
      c.textBaseline = "alphabetic";

      // Top ruler.
      const startXmm = Math.floor((RULER_PX - originX) / pxPerMm / minor) * minor;
      const endXmm = Math.ceil((stageWidth - originX) / pxPerMm / minor) * minor;
      for (let mm = startXmm; mm <= endXmm; mm += minor) {
        const sx = Math.round(originX + mm * pxPerMm);
        if (sx < RULER_PX) continue;
        const isMajor = mm % major === 0;
        c.fillStyle = isMajor ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)";
        c.fillRect(sx, RULER_PX - (isMajor ? 9 : 5), 1, isMajor ? 9 : 5);
        if (isMajor) {
          c.fillStyle = "#8b95a5";
          c.fillText(String(mm), sx + 3, 9);
        }
      }

      // Left ruler (labels rotated 90° CCW).
      const startYmm = Math.floor((RULER_PX - originY) / pxPerMm / minor) * minor;
      const endYmm = Math.ceil((stageHeight - originY) / pxPerMm / minor) * minor;
      for (let mm = startYmm; mm <= endYmm; mm += minor) {
        const sy = Math.round(originY + mm * pxPerMm);
        if (sy < RULER_PX) continue;
        const isMajor = mm % major === 0;
        c.fillStyle = isMajor ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)";
        c.fillRect(RULER_PX - (isMajor ? 9 : 5), sy, isMajor ? 9 : 5, 1);
        if (isMajor) {
          c.fillStyle = "#8b95a5";
          c.save();
          c.translate(9, sy - 3);
          c.rotate(-Math.PI / 2);
          c.fillText(String(mm), 0, 0);
          c.restore();
        }
      }

      // Corner square with the unit label.
      c.fillStyle = "#161c24";
      c.fillRect(0, 0, RULER_PX - 1, RULER_PX - 1);
      c.fillStyle = "#8b95a5";
      c.fillText("mm", 3, 13);
    },
    [zoom, originX, originY, stageWidth, stageHeight],
  );

  return (
    <Layer listening={false}>
      <Shape sceneFunc={sceneFunc} />
    </Layer>
  );
}

export const CertificateStudioCanvas = observer(function CertificateStudioCanvas({
  store,
}: StudioCanvasProps) {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Group>>(new Map());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const snapSignatureRef = useRef("");

  const { doc, zoom, zoomMode } = store;
  const unit = doc.page.unit;
  const paper = pagePixelSize(doc.page);
  const bleedPx = toPx(doc.page.bleedMm ?? 0, "mm");
  const safePx = toPx(doc.page.safeMm ?? 0, "mm");

  // Fit-to-viewport: measure the stage box and size the paper so it fits
  // without scrollbars (same approach as GrapesJS / Excalidraw zoom-to-fit).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const applyFit = () => {
      if (store.zoomMode !== "fit") return;
      const { clientWidth, clientHeight } = el;
      store.fitToViewport(clientWidth, clientHeight);
    };

    applyFit();

    const observer = new ResizeObserver(() => {
      applyFit();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [store, zoomMode, doc.page.width, doc.page.height, doc.page.unit, doc.page.bleedMm]);

  const padPx = PAPER_PAD_PX + bleedPx * zoom;
  const originX = RULER_PX + padPx;
  const originY = RULER_PX + padPx;
  const stageWidth = originX + paper.width * zoom + padPx;
  const stageHeight = originY + paper.height * zoom + padPx;

  const registerNode = (id: string, node: Konva.Group | null) => {
    if (node) {
      nodeRefs.current.set(id, node);
    } else {
      nodeRefs.current.delete(id);
    }
  };

  const selectionKey = store.selectedElementIds.join(",");
  const lockedKey = store.selectedElements
    .filter((el) => el.locked)
    .map((el) => el.id)
    .join(",");

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const nodes = store.selectedElementIds
      .filter((id) => {
        const el = store.elementById(id);
        return el != null && !el.locked;
      })
      .map((id) => nodeRefs.current.get(id))
      .filter((node): node is Konva.Group => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
    // selectionKey / lockedKey / element count changes drive re-attachment
  }, [selectionKey, lockedKey, store.doc.elements.length, store.selectedElementIds, store]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        store.redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        store.duplicateSelected();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (store.selectedElementIds.length > 0) {
          event.preventDefault();
          store.deleteSelected();
        }
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      const nudgeUnit = (px: number) => fromPx(px, unit);
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          store.nudgeSelected(0, -nudgeUnit(step));
          break;
        case "ArrowDown":
          event.preventDefault();
          store.nudgeSelected(0, nudgeUnit(step));
          break;
        case "ArrowLeft":
          event.preventDefault();
          store.nudgeSelected(-nudgeUnit(step), 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          store.nudgeSelected(nudgeUnit(step), 0);
          break;
        case "Escape":
          store.clearSelection();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); };
  }, [store, unit]);

  const handleStagePointerDown = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.target === event.target.getStage()) {
      store.clearSelection();
    }
  };

  const applySnapGuides = (guides: SnapGuide[]) => {
    const signature = guides
      .map((g) => `${g.orientation}:${String(Math.round(g.position * 10))}`)
      .join("|");
    if (signature === snapSignatureRef.current) return;
    snapSignatureRef.current = signature;
    setSnapGuides(guides);
  };

  const handleSnapDragMove = (id: string, node: Konva.Node) => {
    const element = store.elementById(id);
    if (!element) return;
    if (element.rotation) {
      applySnapGuides([]);
      return;
    }
    const width = toPx(element.width, unit);
    const height = toPx(element.height, unit);
    const otherBoxes = store.doc.elements
      .filter((el) => el.id !== id && store.isElementVisible(el))
      .map((el) => ({
        x: toPx(el.x, unit),
        y: toPx(el.y, unit),
        width: toPx(el.width, unit),
        height: toPx(el.height, unit),
      }));
    const targets = collectSnapTargets(paper.width, paper.height, otherBoxes);
    const result = computeSnappedPosition(
      node.x(),
      node.y(),
      width,
      height,
      targets,
      SNAP_THRESHOLD_PX / zoom,
    );
    node.position({ x: result.x, y: result.y });
    applySnapGuides(result.guides);
  };

  const handleSnapDragEnd = () => {
    applySnapGuides([]);
  };

  const hairWidth = 1 / zoom;
  const dashPattern = [4 / zoom, 4 / zoom];
  const gridStepPx = PX_PER_MM * 10;

  return (
    <div
      ref={viewportRef}
      className={`cert-studio__stage-viewport${zoomMode === "fit" ? " is-fit" : ""}`}
    >
      <div
        className="cert-studio__stage-canvas cert-studio__stage-canvas--chromed"
        style={{ width: stageWidth, height: stageHeight }}
      >
        <Stage
          width={stageWidth}
          height={stageHeight}
          onMouseDown={handleStagePointerDown}
          onTouchStart={handleStagePointerDown}
        >
        <Layer x={originX} y={originY} scaleX={zoom} scaleY={zoom}>
          <PaperBackground
            background={doc.background}
            width={paper.width}
            height={paper.height}
          />
          {store.showGrid ? (
            <Shape
              listening={false}
              sceneFunc={(context: Konva.Context) => {
                const c = context._context;
                c.beginPath();
                for (let gx = gridStepPx; gx < paper.width; gx += gridStepPx) {
                  c.moveTo(gx, 0);
                  c.lineTo(gx, paper.height);
                }
                for (let gy = gridStepPx; gy < paper.height; gy += gridStepPx) {
                  c.moveTo(0, gy);
                  c.lineTo(paper.width, gy);
                }
                c.strokeStyle = "rgba(26, 31, 38, 0.08)";
                c.lineWidth = hairWidth;
                c.stroke();
              }}
            />
          ) : null}
          {store.orderedElements.map((element) => (
            <ElementNode
              key={element.id}
              element={element}
              store={store}
              unit={unit}
              registerNode={registerNode}
              onSnapDragMove={handleSnapDragMove}
              onSnapDragEnd={handleSnapDragEnd}
            />
          ))}
          {store.showGuides && bleedPx > 0 ? (
            <Rect
              x={-bleedPx}
              y={-bleedPx}
              width={paper.width + bleedPx * 2}
              height={paper.height + bleedPx * 2}
              stroke="rgba(239, 68, 68, 0.6)"
              strokeWidth={hairWidth}
              dash={dashPattern}
              listening={false}
            />
          ) : null}
          {store.showGuides && safePx > 0 ? (
            <Rect
              x={safePx}
              y={safePx}
              width={paper.width - safePx * 2}
              height={paper.height - safePx * 2}
              stroke="rgba(16, 217, 163, 0.55)"
              strokeWidth={hairWidth}
              dash={dashPattern}
              listening={false}
            />
          ) : null}
          {snapGuides.map((guide) => (
            <Line
              key={`${guide.orientation}-${String(guide.position)}`}
              points={
                guide.orientation === "vertical"
                  ? [guide.position, 0, guide.position, paper.height]
                  : [0, guide.position, paper.width, guide.position]
              }
              stroke="#2E6BFF"
              strokeWidth={hairWidth}
              dash={dashPattern}
              listening={false}
            />
          ))}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            ignoreStroke
            padding={2}
            anchorSize={8}
            anchorStroke="#070b10"
            anchorFill="#10d9a3"
            anchorCornerRadius={1}
            borderStroke="#10d9a3"
            borderStrokeWidth={1.5}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < MIN_ELEMENT_PX || newBox.height < MIN_ELEMENT_PX) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
        <StudioRulers
          zoom={zoom}
          originX={originX}
          originY={originY}
          stageWidth={stageWidth}
          stageHeight={stageHeight}
        />
      </Stage>
      </div>
    </div>
  );
});
