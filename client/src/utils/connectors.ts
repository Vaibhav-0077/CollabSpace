import { Canvas, FabricObject, Line } from 'fabric';
import { nanoid } from 'nanoid';

export type AnchorType = 'top' | 'right' | 'bottom' | 'left';

export interface AnchorPoint {
  type: AnchorType;
  x: number;
  y: number;
}

export function getShapeAnchors(shape: FabricObject): AnchorPoint[] {
  const bound = shape.getBoundingRect();
  const left = shape.left;
  const top = shape.top;
  const width = bound.width;
  const height = bound.height;

  return [
    { type: 'top', x: left + width / 2, y: top },
    { type: 'right', x: left + width, y: top + height / 2 },
    { type: 'bottom', x: left + width / 2, y: top + height },
    { type: 'left', x: left, y: top + height / 2 },
  ];
}

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

export function attachArrowHead(line: Line) {
  const origRender = (line as any)._render;
  (line as any)._render = function (ctx: CanvasRenderingContext2D) {
    origRender.call(this, ctx);
    const p = (this as any).calcLinePoints();
    const angle = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
    const headLength = Math.max(11, ((this as any).strokeWidth || 2) * 4);

    ctx.save();
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
    ctx.restore();
  };
}

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
}): Line {
  const line = new Line([x1, y1, x2, y2], {
    id: nanoid(8),
    stroke,
    strokeWidth,
    selectable: true,
    hasControls: true,
    isConnector: true,
    fromId,
    toId,
    fromAnchor,
    toAnchor,
  } as any);

  attachArrowHead(line);
  return line;
}
