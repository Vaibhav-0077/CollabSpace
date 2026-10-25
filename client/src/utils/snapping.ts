import { Canvas, Line, FabricObject } from 'fabric';

const SNAP_THRESHOLD = 8; // Snap distance in screen pixels

export interface SnapResult {
  snappedLeft?: number;
  snappedTop?: number;
}

export function handleObjectSnapping(
  activeObj: FabricObject,
  canvas: Canvas
): SnapResult {
  const zoom = canvas.getZoom();
  const threshold = SNAP_THRESHOLD / zoom;

  // Clear existing snapping guidelines
  clearGuidelines(canvas);

  const activeBound = activeObj.getBoundingRect();
  const activeLeft = activeObj.left;
  const activeTop = activeObj.top;

  const activeMidX = activeLeft + activeBound.width / 2;
  const activeMidY = activeTop + activeBound.height / 2;
  const activeRight = activeLeft + activeBound.width;
  const activeBottom = activeTop + activeBound.height;

  let snappedLeft: number | undefined;
  let snappedTop: number | undefined;

  const otherObjects = canvas.getObjects().filter((obj) => {
    return (
      obj !== activeObj &&
      !(obj as any).isGuideline &&
      obj.visible !== false &&
      obj.type !== 'line'
    );
  });

  const guidelinesToDraw: Line[] = [];

  for (const other of otherObjects) {
    const otherBound = other.getBoundingRect();
    const otherLeft = other.left;
    const otherTop = other.top;
    const otherMidX = otherLeft + otherBound.width / 2;
    const otherMidY = otherTop + otherBound.height / 2;
    const otherRight = otherLeft + otherBound.width;
    const otherBottom = otherTop + otherBound.height;

    // --- Vertical Alignment (X axis) ---
    // 1. Center to Center
    if (Math.abs(activeMidX - otherMidX) < threshold) {
      snappedLeft = otherMidX - activeBound.width / 2;
      guidelinesToDraw.push(createGuideline(otherMidX, -10000, otherMidX, 10000));
    }
    // 2. Left to Left
    else if (Math.abs(activeLeft - otherLeft) < threshold) {
      snappedLeft = otherLeft;
      guidelinesToDraw.push(createGuideline(otherLeft, -10000, otherLeft, 10000));
    }
    // 3. Right to Right
    else if (Math.abs(activeRight - otherRight) < threshold) {
      snappedLeft = otherRight - activeBound.width;
      guidelinesToDraw.push(createGuideline(otherRight, -10000, otherRight, 10000));
    }

    // --- Horizontal Alignment (Y axis) ---
    // 1. Center to Center
    if (Math.abs(activeMidY - otherMidY) < threshold) {
      snappedTop = otherMidY - activeBound.height / 2;
      guidelinesToDraw.push(createGuideline(-10000, otherMidY, 10000, otherMidY));
    }
    // 2. Top to Top
    else if (Math.abs(activeTop - otherTop) < threshold) {
      snappedTop = otherTop;
      guidelinesToDraw.push(createGuideline(-10000, otherTop, 10000, otherTop));
    }
    // 3. Bottom to Bottom
    else if (Math.abs(activeBottom - otherBottom) < threshold) {
      snappedTop = otherBottom - activeBound.height;
      guidelinesToDraw.push(createGuideline(-10000, otherBottom, 10000, otherBottom));
    }
  }

  // Draw guidelines to canvas overlay
  if (guidelinesToDraw.length > 0) {
    guidelinesToDraw.forEach((line) => canvas.add(line));
    canvas.requestRenderAll();
  }

  return { snappedLeft, snappedTop };
}

function createGuideline(x1: number, y1: number, x2: number, y2: number): Line {
  return new Line([x1, y1, x2, y2], {
    stroke: '#818cf8',
    strokeWidth: 1.5,
    strokeDashArray: [4, 4],
    selectable: false,
    evented: false,
    isGuideline: true,
  } as any);
}

export function clearGuidelines(canvas: Canvas) {
  const existing = canvas.getObjects().filter((obj: any) => obj.isGuideline);
  if (existing.length > 0) {
    existing.forEach((line) => canvas.remove(line));
    canvas.requestRenderAll();
  }
}
