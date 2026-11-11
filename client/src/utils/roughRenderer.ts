import rough from 'roughjs';
import type { Drawable, Op } from 'roughjs/bin/core';
import { Rect, Circle, Polygon, Line } from 'fabric';
import { useCanvasStore } from '../store/canvasStore';

const generator = rough.generator();

/**
 * Computes a deterministic integer seed from an object's string ID
 * Ensures hand-drawn jitter is consistent and stable across frames (no flickering)
 */
export function getSeedFromId(id?: string): number {
  if (!id) return 1;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * Draws Rough.js OpSets onto any standard HTML5 2D canvas context
 */
export function drawRoughDrawable(ctx: CanvasRenderingContext2D, drawable: Drawable) {
  const sets = drawable.sets || [];
  const o = drawable.options;

  for (const drawing of sets) {
    switch (drawing.type) {
      case 'path':
        ctx.save();
        ctx.strokeStyle = o.stroke === 'none' ? 'transparent' : (o.stroke || '#1e293b');
        ctx.lineWidth = o.strokeWidth || 2;
        if (o.strokeLineDash && o.strokeLineDash.length > 0) {
          ctx.setLineDash(o.strokeLineDash);
        }
        drawOps(ctx, drawing.ops);
        ctx.stroke();
        ctx.restore();
        break;

      case 'fillPath':
        ctx.save();
        ctx.fillStyle = o.fill || 'transparent';
        drawOps(ctx, drawing.ops);
        ctx.fill();
        ctx.restore();
        break;

      case 'fillSketch':
        ctx.save();
        ctx.strokeStyle = o.fill || 'transparent';
        ctx.lineWidth = o.fillWeight > 0 ? o.fillWeight : Math.max(1, (o.strokeWidth || 2) * 0.7);
        drawOps(ctx, drawing.ops);
        ctx.stroke();
        ctx.restore();
        break;
    }
  }
}

function drawOps(ctx: CanvasRenderingContext2D, ops: Op[]) {
  ctx.beginPath();
  for (let i = 0; i < ops.length; i++) {
    const item = ops[i];
    const data = item.data;
    switch (item.op) {
      case 'move':
        ctx.moveTo(data[0], data[1]);
        break;
      case 'bcurveTo':
        ctx.bezierCurveTo(data[0], data[1], data[2], data[3], data[4], data[5]);
        break;
      case 'lineTo':
        ctx.lineTo(data[0], data[1]);
        break;
    }
  }
}

/**
 * Renders a hand-drawn sketchy rectangle using Rough.js
 */
export function renderRoughRect(ctx: CanvasRenderingContext2D, rect: Rect) {
  const w = rect.width || 0;
  const h = rect.height || 0;
  if (w <= 0 || h <= 0) return;
  const x = -w / 2;
  const y = -h / 2;
  const seed = getSeedFromId((rect as any).id);
  const stroke = (rect.stroke as string) || '#1e293b';
  const strokeWidth = rect.strokeWidth ?? 2;
  const strokeDash = Array.isArray(rect.strokeDashArray) ? rect.strokeDashArray : undefined;
  const fill = (rect.fill as string) || 'transparent';
  const hasFill = fill !== 'transparent' && fill !== '';

  const cacheKey = `${w}_${h}_${stroke}_${strokeWidth}_${fill}_${seed}_${strokeDash ? strokeDash.join(',') : ''}`;
  let drawable = (rect as any)._roughDrawable;
  if (!drawable || (rect as any)._roughCacheKey !== cacheKey) {
    drawable = generator.rectangle(x, y, w, h, {
      seed,
      roughness: 1.5,
      bowing: 1.2,
      stroke,
      strokeWidth,
      strokeLineDash: strokeDash,
      fill: hasFill ? fill : undefined,
      fillStyle: 'hachure',
      fillWeight: Math.max(1, strokeWidth * 0.7),
      hachureGap: Math.max(4, Math.min(10, Math.min(w, h) / 12)),
      hachureAngle: 65,
    });
    (rect as any)._roughDrawable = drawable;
    (rect as any)._roughCacheKey = cacheKey;
  }
  drawRoughDrawable(ctx, drawable);
}

/**
 * Renders a hand-drawn sketchy circle using Rough.js
 */
export function renderRoughCircle(ctx: CanvasRenderingContext2D, circle: Circle) {
  const radius = circle.radius || 0;
  if (radius <= 0) return;
  const diameter = radius * 2;
  const seed = getSeedFromId((circle as any).id);
  const stroke = (circle.stroke as string) || '#1e293b';
  const strokeWidth = circle.strokeWidth ?? 2;
  const strokeDash = Array.isArray(circle.strokeDashArray) ? circle.strokeDashArray : undefined;
  const fill = (circle.fill as string) || 'transparent';
  const hasFill = fill !== 'transparent' && fill !== '';

  const cacheKey = `${radius}_${stroke}_${strokeWidth}_${fill}_${seed}_${strokeDash ? strokeDash.join(',') : ''}`;
  let drawable = (circle as any)._roughDrawable;
  if (!drawable || (circle as any)._roughCacheKey !== cacheKey) {
    drawable = generator.circle(0, 0, diameter, {
      seed,
      roughness: 1.5,
      bowing: 1.2,
      stroke,
      strokeWidth,
      strokeLineDash: strokeDash,
      fill: hasFill ? fill : undefined,
      fillStyle: 'hachure',
      fillWeight: Math.max(1, strokeWidth * 0.7),
      hachureGap: Math.max(4, Math.min(10, diameter / 14)),
      hachureAngle: 65,
    });
    (circle as any)._roughDrawable = drawable;
    (circle as any)._roughCacheKey = cacheKey;
  }
  drawRoughDrawable(ctx, drawable);
}

/**
 * Renders a hand-drawn sketchy polygon / diamond using Rough.js
 */
export function renderRoughPolygon(ctx: CanvasRenderingContext2D, poly: Polygon) {
  const points = poly.points;
  if (!points || points.length < 3) return;
  const ox = poly.pathOffset ? poly.pathOffset.x : 0;
  const oy = poly.pathOffset ? poly.pathOffset.y : 0;
  const pts: [number, number][] = points.map((p) => [p.x - ox, p.y - oy]);
  const seed = getSeedFromId((poly as any).id);
  const stroke = (poly.stroke as string) || '#1e293b';
  const strokeWidth = poly.strokeWidth ?? 2;
  const strokeDash = Array.isArray(poly.strokeDashArray) ? poly.strokeDashArray : undefined;
  const fill = (poly.fill as string) || 'transparent';
  const hasFill = fill !== 'transparent' && fill !== '';

  const cacheKey = `${poly.width}_${poly.height}_${stroke}_${strokeWidth}_${fill}_${seed}`;
  let drawable = (poly as any)._roughDrawable;
  if (!drawable || (poly as any)._roughCacheKey !== cacheKey) {
    drawable = generator.polygon(pts, {
      seed,
      roughness: 1.5,
      bowing: 1.2,
      stroke,
      strokeWidth,
      strokeLineDash: strokeDash,
      fill: hasFill ? fill : undefined,
      fillStyle: 'hachure',
      fillWeight: Math.max(1, strokeWidth * 0.7),
      hachureGap: 6,
      hachureAngle: 65,
    });
    (poly as any)._roughDrawable = drawable;
    (poly as any)._roughCacheKey = cacheKey;
  }
  drawRoughDrawable(ctx, drawable);
}

/**
 * Renders a hand-drawn sketchy smart connector line and arrowhead using Rough.js
 */
export function renderRoughConnector(ctx: CanvasRenderingContext2D, line: Line) {
  const p = (line as any).calcLinePoints();
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const len = Math.hypot(dx, dy) || 1;
  const normX = -dy / len;
  const normY = dx / len;
  const curv = (line as any).curvature || ((line as any).isCurved ? 50 : 0);
  const midX = (p.x1 + p.x2) / 2;
  const midY = (p.y1 + p.y2) / 2;
  const cpX = midX + normX * curv;
  const cpY = midY + normY * curv;

  const seed = getSeedFromId((line as any).id);
  const stroke = ((line as any).stroke as string) || '#818cf8';
  const strokeWidth = line.strokeWidth || 2;
  const strokeDash = Array.isArray((line as any).strokeDashArray) ? (line as any).strokeDashArray : undefined;

  const cacheKey = `${p.x1}_${p.y1}_${p.x2}_${p.y2}_${curv}_${stroke}_${strokeWidth}_${seed}_${(line as any).arrowhead}`;
  let drawables = (line as any)._roughDrawables as Drawable[];

  if (!drawables || (line as any)._roughCacheKey !== cacheKey) {
    drawables = [];

    // 1. Draw shaft (straight rough line or organic rough curve)
    if (curv !== 0) {
      drawables.push(
        generator.curve(
          [
            [p.x1, p.y1],
            [cpX, cpY],
            [p.x2, p.y2],
          ],
          {
            seed,
            roughness: 1.4,
            bowing: 1.2,
            stroke,
            strokeWidth,
            strokeLineDash: strokeDash,
          }
        )
      );
    } else {
      drawables.push(
        generator.line(p.x1, p.y1, p.x2, p.y2, {
          seed,
          roughness: 1.4,
          bowing: 1.2,
          stroke,
          strokeWidth,
          strokeLineDash: strokeDash,
        })
      );
    }

    // 2. Draw Arrowheads with Rough solid fill
    const headLength = Math.max(12, strokeWidth * 4);

    if ((line as any).arrowhead !== 'none') {
      const tdx = curv !== 0 ? p.x2 - cpX : p.x2 - p.x1;
      const tdy = curv !== 0 ? p.y2 - cpY : p.y2 - p.y1;
      const angle = Math.atan2(tdy, tdx);
      const pTip: [number, number] = [p.x2, p.y2];
      const pLeft: [number, number] = [
        p.x2 - headLength * Math.cos(angle - Math.PI / 6),
        p.y2 - headLength * Math.sin(angle - Math.PI / 6),
      ];
      const pRight: [number, number] = [
        p.x2 - headLength * Math.cos(angle + Math.PI / 6),
        p.y2 - headLength * Math.sin(angle + Math.PI / 6),
      ];
      drawables.push(
        generator.polygon([pTip, pLeft, pRight], {
          seed: seed + 1,
          roughness: 1.2,
          stroke,
          strokeWidth: 1.5,
          fill: stroke,
          fillStyle: 'solid',
        })
      );
    }

    if ((line as any).arrowhead === 'both') {
      const tdx = curv !== 0 ? p.x1 - cpX : p.x1 - p.x2;
      const tdy = curv !== 0 ? p.y1 - cpY : p.y1 - p.y2;
      const angle = Math.atan2(tdy, tdx);
      const pTip: [number, number] = [p.x1, p.y1];
      const pLeft: [number, number] = [
        p.x1 - headLength * Math.cos(angle - Math.PI / 6),
        p.y1 - headLength * Math.sin(angle - Math.PI / 6),
      ];
      const pRight: [number, number] = [
        p.x1 - headLength * Math.cos(angle + Math.PI / 6),
        p.y1 - headLength * Math.sin(angle + Math.PI / 6),
      ];
      drawables.push(
        generator.polygon([pTip, pLeft, pRight], {
          seed: seed + 2,
          roughness: 1.2,
          stroke,
          strokeWidth: 1.5,
          fill: stroke,
          fillStyle: 'solid',
        })
      );
    }

    (line as any)._roughDrawables = drawables;
    (line as any)._roughCacheKey = cacheKey;
  }

  for (const d of drawables) {
    drawRoughDrawable(ctx, d);
  }
}

/**
 * Initializes global prototype hooks so Fabric objects render with Rough.js
 * when roughMode is enabled or when isRough is set on the object
 */
let isPatched = false;
export function initRoughPatch() {
  if (isPatched) return;
  isPatched = true;

  const origRectRender = Rect.prototype._render;
  Rect.prototype._render = function (ctx: CanvasRenderingContext2D) {
    const isRough = (this as any).isRough ?? useCanvasStore.getState().roughMode;
    if (isRough) {
      renderRoughRect(ctx, this);
    } else {
      origRectRender.call(this, ctx);
    }
  };

  const origCircleRender = Circle.prototype._render;
  Circle.prototype._render = function (ctx: CanvasRenderingContext2D) {
    const isRough = (this as any).isRough ?? useCanvasStore.getState().roughMode;
    if (isRough) {
      renderRoughCircle(ctx, this);
    } else {
      origCircleRender.call(this, ctx);
    }
  };

  const origPolyRender = Polygon.prototype._render;
  Polygon.prototype._render = function (ctx: CanvasRenderingContext2D) {
    const isRough = (this as any).isRough ?? useCanvasStore.getState().roughMode;
    if (isRough) {
      renderRoughPolygon(ctx, this);
    } else {
      origPolyRender.call(this, ctx);
    }
  };
}

