import { Canvas, FabricObject, Line, Circle, Shadow, Control, Point } from 'fabric';
import { nanoid } from 'nanoid';

export type AnchorType = 'top' | 'right' | 'bottom' | 'left';

export interface AnchorPoint {
  type: AnchorType;
  x: number;
  y: number;
}

/**
 * Returns the 4 connection anchor points of a box or circle
 */
export function getShapeAnchors(shape: FabricObject): AnchorPoint[] {
  const bound = shape.getBoundingRect();
  return [
    { type: 'top', x: bound.left + bound.width / 2, y: bound.top },
    { type: 'right', x: bound.left + bound.width, y: bound.top + bound.height / 2 },
    { type: 'bottom', x: bound.left + bound.width / 2, y: bound.top + bound.height },
    { type: 'left', x: bound.left, y: bound.top + bound.height / 2 },
  ];
}

/**
 * Finds the nearest anchor point across shapes on canvas within threshold distance
 */
export function findNearestAnchor(
  x: number,
  y: number,
  canvas: Canvas,
  excludeId?: string,
  threshold = 30
): { shapeId: string; anchor: AnchorPoint } | null {
  const shapes = canvas.getObjects().filter((obj: any) => {
    return (
      obj.id &&
      obj.id !== excludeId &&
      !obj.isConnector &&
      !obj.isGuideline &&
      !obj.isAnchorPoint &&
      obj.type !== 'line'
    );
  });

  let closest: { shapeId: string; anchor: AnchorPoint } | null = null;
  let minDistance = threshold;

  for (const shape of shapes) {
    const anchors = getShapeAnchors(shape);
    for (const anchor of anchors) {
      const distance = Math.hypot(x - anchor.x, y - anchor.y);
      if (distance < minDistance) {
        minDistance = distance;
        closest = { shapeId: (shape as any).id, anchor };
      }
    }
  }

  return closest;
}

/**
 * Detects if a coordinate is over or near any shape (box, circle, diamond, sticky note)
 */
export function findHoveredShape(
  x: number,
  y: number,
  canvas: Canvas,
  excludeId?: string,
  padding = 35
): FabricObject | null {
  const shapes = canvas.getObjects().filter((obj: any) => {
    return (
      obj.id &&
      obj.id !== excludeId &&
      !obj.isConnector &&
      !obj.isGuideline &&
      !obj.isAnchorPoint &&
      obj.type !== 'line'
    );
  });

  let bestShape: FabricObject | null = null;
  let minDistance = Infinity;

  for (const shape of shapes) {
    const bound = shape.getBoundingRect();
    const insideX = x >= bound.left - padding && x <= bound.left + bound.width + padding;
    const insideY = y >= bound.top - padding && y <= bound.top + bound.height + padding;

    if (insideX && insideY) {
      const centerX = bound.left + bound.width / 2;
      const centerY = bound.top + bound.height / 2;
      const dist = Math.hypot(x - centerX, y - centerY);
      if (dist < minDistance) {
        minDistance = dist;
        bestShape = shape;
      }
    }
  }

  return bestShape;
}

/**
 * Displays the 4 magnetic anchor points (Top, Right, Bottom, Left) on a shape
 */
export function showShapeAnchorPoints(
  shape: FabricObject,
  canvas: Canvas,
  activeAnchorType?: AnchorType
) {
  clearAnchorPoints(canvas);
  const anchors = getShapeAnchors(shape);

  anchors.forEach((a) => {
    const isActive = activeAnchorType === a.type;
    const r = isActive ? 7 : 5;
    const dot = new Circle({
      left: a.x - r,
      top: a.y - r,
      radius: r,
      fill: isActive ? '#6366f1' : '#ffffff',
      stroke: isActive ? '#ffffff' : '#6366f1',
      strokeWidth: isActive ? 2.5 : 2,
      selectable: false,
      evented: false,
      shadow: new Shadow({
        color: isActive ? 'rgba(99, 102, 241, 0.7)' : 'rgba(99, 102, 241, 0.35)',
        blur: isActive ? 12 : 6,
        offsetX: 0,
        offsetY: 0,
      }),
    } as any);

    (dot as any).isAnchorPoint = true;
    (dot as any).anchorType = a.type;
    (dot as any).shapeId = (shape as any).id;
    canvas.add(dot);
  });

  canvas.requestRenderAll();
}

/**
 * Clears any visible anchor point indicators from canvas
 */
export function clearAnchorPoints(canvas: Canvas) {
  const existing = canvas.getObjects().filter((obj: any) => obj.isAnchorPoint);
  if (existing.length > 0) {
    existing.forEach((obj) => canvas.remove(obj));
    canvas.requestRenderAll();
  }
}

/**
 * Circle handle renderer for endpoints
 */
function renderAnchorHandleCircle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(left, top, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#6366f1';
  ctx.stroke();
  ctx.restore();
}

/**
 * Circle handle renderer with inner dot for curve peak handle
 */
function renderCurveHandleCircle(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(left, top, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#6366f1';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(left, top, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#6366f1';
  ctx.fill();
  ctx.restore();
}

/**
 * Attaches custom rendering (curved line + arrowhead) and interactive controls to Line
 */
export function attachArrowHead(line: Line) {
  // Custom render: draws straight or curved quadratic bezier + directional arrowhead
  (line as any)._render = function (ctx: CanvasRenderingContext2D) {
    const p = (this as any).calcLinePoints();
    const midX = (p.x1 + p.x2) / 2;
    const midY = (p.y1 + p.y2) / 2;
    const dx = p.x2 - p.x1;
    const dy = p.y2 - p.y1;
    const len = Math.hypot(dx, dy) || 1;
    const normX = -dy / len;
    const normY = dx / len;
    const curv = (this as any).curvature || ((this as any).isCurved ? 50 : 0);
    const cpX = midX + normX * curv;
    const cpY = midY + normY * curv;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y1);
    if (curv !== 0) {
      ctx.quadraticCurveTo(cpX, cpY, p.x2, p.y2);
    } else {
      ctx.lineTo(p.x2, p.y2);
    }
    ctx.strokeStyle = ((this as any).stroke as string) || '#818cf8';
    ctx.lineWidth = (this as any).strokeWidth || 2;
    if ((this as any).strokeDashArray && Array.isArray((this as any).strokeDashArray)) {
      ctx.setLineDash((this as any).strokeDashArray);
    }
    ctx.stroke();

    const headLength = Math.max(12, ((this as any).strokeWidth || 2) * 4);

    // End Arrowhead at (p.x2, p.y2)
    if ((this as any).arrowhead !== 'none') {
      const tdx = curv !== 0 ? p.x2 - cpX : p.x2 - p.x1;
      const tdy = curv !== 0 ? p.y2 - cpY : p.y2 - p.y1;
      const angle = Math.atan2(tdy, tdx);

      ctx.beginPath();
      ctx.moveTo(p.x2, p.y2);
      ctx.lineTo(
        p.x2 - headLength * Math.cos(angle - Math.PI / 6),
        p.y2 - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        p.x2 - headLength * Math.cos(angle + Math.PI / 6),
        p.y2 - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = ((this as any).stroke as string) || '#818cf8';
      ctx.fill();
    }

    // Start Arrowhead at (p.x1, p.y1) if both ends
    if ((this as any).arrowhead === 'both') {
      const tdx = curv !== 0 ? p.x1 - cpX : p.x1 - p.x2;
      const tdy = curv !== 0 ? p.y1 - cpY : p.y1 - p.y2;
      const angle = Math.atan2(tdy, tdx);

      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(
        p.x1 - headLength * Math.cos(angle - Math.PI / 6),
        p.y1 - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        p.x1 - headLength * Math.cos(angle + Math.PI / 6),
        p.y1 - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = ((this as any).stroke as string) || '#818cf8';
      ctx.fill();
    }

    ctx.restore();
  };

  // Add interactive handles: start, mid-curve, and end
  line.controls = {
    ...line.controls,
    startHandle: new Control({
      positionHandler: (_dim, finalMatrix, fabricObject) => {
        const p = (fabricObject as any).calcLinePoints();
        return new Point(p.x1, p.y1).transform(finalMatrix);
      },
      actionHandler: (eventData, transform) => {
        const lineObj = transform.target as any;
        const canvas = lineObj.canvas;
        if (!canvas) return false;
        const scenePoint = canvas.getScenePoint ? canvas.getScenePoint(eventData) : canvas.getPointer(eventData);

        const near = findNearestAnchor(scenePoint.x, scenePoint.y, canvas, lineObj.toId);
        if (near) {
          lineObj.set({ x1: near.anchor.x, y1: near.anchor.y });
          lineObj.fromId = near.shapeId;
          lineObj.fromAnchor = near.anchor.type;
          const targetShape = canvas.getObjects().find((o: any) => o.id === near.shapeId);
          if (targetShape) showShapeAnchorPoints(targetShape, canvas, near.anchor.type);
        } else {
          lineObj.set({ x1: scenePoint.x, y1: scenePoint.y });
          lineObj.fromId = undefined;
          lineObj.fromAnchor = undefined;
          const hovered = findHoveredShape(scenePoint.x, scenePoint.y, canvas, lineObj.id);
          if (hovered) showShapeAnchorPoints(hovered, canvas);
          else clearAnchorPoints(canvas);
        }
        lineObj.setCoords();
        canvas.requestRenderAll();
        return true;
      },
      cursorStyle: 'crosshair',
      render: renderAnchorHandleCircle,
    }),

    curveHandle: new Control({
      positionHandler: (_dim, finalMatrix, fabricObject) => {
        const lineObj = fabricObject as any;
        const p = lineObj.calcLinePoints();
        const midX = (p.x1 + p.x2) / 2;
        const midY = (p.y1 + p.y2) / 2;
        const dx = p.x2 - p.x1;
        const dy = p.y2 - p.y1;
        const len = Math.hypot(dx, dy) || 1;
        const normX = -dy / len;
        const normY = dx / len;
        const curv = lineObj.curvature || (lineObj.isCurved ? 50 : 0);
        const localCurvePeakX = midX + 0.5 * normX * curv;
        const localCurvePeakY = midY + 0.5 * normY * curv;
        return new Point(localCurvePeakX, localCurvePeakY).transform(finalMatrix);
      },
      actionHandler: (eventData, transform) => {
        const lineObj = transform.target as any;
        const canvas = lineObj.canvas;
        if (!canvas) return false;
        const scenePoint = canvas.getScenePoint ? canvas.getScenePoint(eventData) : canvas.getPointer(eventData);

        const matrix = lineObj.calcTransformMatrix();
        const p = lineObj.calcLinePoints();
        const startPt = new Point(p.x1, p.y1).transform(matrix);
        const endPt = new Point(p.x2, p.y2).transform(matrix);

        const midX = (startPt.x + endPt.x) / 2;
        const midY = (startPt.y + endPt.y) / 2;
        const dx = endPt.x - startPt.x;
        const dy = endPt.y - startPt.y;
        const len = Math.hypot(dx, dy) || 1;
        const normX = -dy / len;
        const normY = dx / len;

        const distFromMid = (scenePoint.x - midX) * normX + (scenePoint.y - midY) * normY;
        lineObj.curvature = Math.round(distFromMid * 2);
        lineObj.isCurved = Math.abs(lineObj.curvature) > 4;
        lineObj.padding = Math.max(16, Math.abs(lineObj.curvature) / 2 + 10);
        lineObj.setCoords();
        canvas.requestRenderAll();
        return true;
      },
      cursorStyle: 'pointer',
      render: renderCurveHandleCircle,
    }),

    endHandle: new Control({
      positionHandler: (_dim, finalMatrix, fabricObject) => {
        const p = (fabricObject as any).calcLinePoints();
        return new Point(p.x2, p.y2).transform(finalMatrix);
      },
      actionHandler: (eventData, transform) => {
        const lineObj = transform.target as any;
        const canvas = lineObj.canvas;
        if (!canvas) return false;
        const scenePoint = canvas.getScenePoint ? canvas.getScenePoint(eventData) : canvas.getPointer(eventData);

        const near = findNearestAnchor(scenePoint.x, scenePoint.y, canvas, lineObj.fromId);
        if (near) {
          lineObj.set({ x2: near.anchor.x, y2: near.anchor.y });
          lineObj.toId = near.shapeId;
          lineObj.toAnchor = near.anchor.type;
          const targetShape = canvas.getObjects().find((o: any) => o.id === near.shapeId);
          if (targetShape) showShapeAnchorPoints(targetShape, canvas, near.anchor.type);
        } else {
          lineObj.set({ x2: scenePoint.x, y2: scenePoint.y });
          lineObj.toId = undefined;
          lineObj.toAnchor = undefined;
          const hovered = findHoveredShape(scenePoint.x, scenePoint.y, canvas, lineObj.id);
          if (hovered) showShapeAnchorPoints(hovered, canvas);
          else clearAnchorPoints(canvas);
        }
        lineObj.setCoords();
        canvas.requestRenderAll();
        return true;
      },
      cursorStyle: 'crosshair',
      render: renderAnchorHandleCircle,
    }),
  };
}

/**
 * Creates a smart connector line / arrow with anchors and curve support
 */
export function createSmartConnector({
  x1,
  y1,
  x2,
  y2,
  fromId,
  toId,
  fromAnchor,
  toAnchor,
  stroke = '#818cf8',
  strokeWidth = 2,
  isCurved = false,
  curvature = 0,
  arrowhead = 'end',
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fromId?: string;
  toId?: string;
  fromAnchor?: AnchorType;
  toAnchor?: AnchorType;
  stroke?: string;
  strokeWidth?: number;
  isCurved?: boolean;
  curvature?: number;
  arrowhead?: 'end' | 'both' | 'none';
}): Line {
  const line = new Line([x1, y1, x2, y2], {
    id: nanoid(8),
    stroke,
    strokeWidth,
    selectable: true,
    hasControls: true,
    isConnector: true,
    isCurved,
    curvature,
    arrowhead,
    fromId,
    toId,
    fromAnchor,
    toAnchor,
    padding: Math.max(16, Math.abs(curvature) / 2 + 10),
  } as any);

  attachArrowHead(line);
  return line;
}

/**
 * Recalculates attached connectors when a shape is moved
 */
export function updateAttachedConnectors(movedShape: FabricObject, canvas: Canvas) {
  const shapeId = (movedShape as any).id;
  if (!shapeId) return;

  const anchors = getShapeAnchors(movedShape);
  const anchorMap = new Map(anchors.map((a) => [a.type, a]));

  const connectors = canvas.getObjects().filter(
    (obj: any) => obj.isConnector && (obj.fromId === shapeId || obj.toId === shapeId)
  ) as Line[];

  connectors.forEach((conn: any) => {
    if (conn.fromId === shapeId) {
      const anchor = anchorMap.get(conn.fromAnchor || 'right') || anchors[1];
      conn.set({ x1: anchor.x, y1: anchor.y });
    }
    if (conn.toId === shapeId) {
      const anchor = anchorMap.get(conn.toAnchor || 'left') || anchors[3];
      conn.set({ x2: anchor.x, y2: anchor.y });
    }
    conn.setCoords();
  });

  if (connectors.length > 0) {
    canvas.requestRenderAll();
  }
}

