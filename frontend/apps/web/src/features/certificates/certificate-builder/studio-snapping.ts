/**
 * Smart-snapping helpers for the certificate studio canvas.
 *
 * All values are in paper-local pixels (document units already converted via
 * `toPx`). Targets are the page edges/center plus every other visible
 * element's edges and centers; a dragged box snaps its left/center/right
 * (and top/middle/bottom) to the nearest target within the threshold.
 */

export type SnapTargets = {
  vertical: number[];
  horizontal: number[];
};

export type SnapGuide = {
  orientation: "vertical" | "horizontal";
  /** Paper-local pixel position of the guide line. */
  position: number;
};

export type SnapResult = {
  x: number;
  y: number;
  guides: SnapGuide[];
};

type ElementBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Page edges/center plus other elements' edges/centers, in paper px. */
export function collectSnapTargets(
  paperWidth: number,
  paperHeight: number,
  otherBoxes: ElementBox[],
): SnapTargets {
  const vertical = [0, paperWidth / 2, paperWidth];
  const horizontal = [0, paperHeight / 2, paperHeight];
  for (const box of otherBoxes) {
    vertical.push(box.x, box.x + box.width / 2, box.x + box.width);
    horizontal.push(box.y, box.y + box.height / 2, box.y + box.height);
  }
  return { vertical, horizontal };
}

function bestSnap(
  candidates: number[],
  targets: number[],
  threshold: number,
): { delta: number; target: number } | null {
  let best: { delta: number; target: number } | null = null;
  for (const candidate of candidates) {
    for (const target of targets) {
      const delta = target - candidate;
      if (
        Math.abs(delta) <= threshold &&
        (best === null || Math.abs(delta) < Math.abs(best.delta))
      ) {
        best = { delta, target };
      }
    }
  }
  return best;
}

/** Snap a dragged box's edges/centers to the nearest targets within threshold. */
export function computeSnappedPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  targets: SnapTargets,
  threshold: number,
): SnapResult {
  const guides: SnapGuide[] = [];

  const vertical = bestSnap([x, x + width / 2, x + width], targets.vertical, threshold);
  const horizontal = bestSnap([y, y + height / 2, y + height], targets.horizontal, threshold);

  let nextX = x;
  let nextY = y;

  if (vertical) {
    nextX = x + vertical.delta;
    guides.push({ orientation: "vertical", position: vertical.target });
  }
  if (horizontal) {
    nextY = y + horizontal.delta;
    guides.push({ orientation: "horizontal", position: horizontal.target });
  }

  return { x: nextX, y: nextY, guides };
}
