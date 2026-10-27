import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Canvas } from 'fabric';
import { Compass, ChevronDown, Map } from 'lucide-react';

interface CanvasMinimapProps {
  canvasRef: React.MutableRefObject<Canvas | null>;
  canvasVpt: number[];
  zoom: number;
  onPanTo: (vptX: number, vptY: number) => void;
  onPanBy?: (dx: number, dy: number) => void;
}

export const CanvasMinimap: React.FC<CanvasMinimapProps> = ({
  canvasRef,
  canvasVpt,
  zoom,
  onPanTo,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);

  // Geometry cache for drag coordinate mapping
  const geomRef = useRef<{
    scale: number;
    offX: number;
    offY: number;
    screenW: number;
    screenH: number;
    zoomVal: number;
  }>({
    scale: 1,
    offX: 0,
    offY: 0,
    screenW: 800,
    screenH: 600,
    zoomVal: 1,
  });

  const renderMinimap = useCallback(() => {
    const mainCanvas = canvasRef.current;
    const mapCanvas = mapCanvasRef.current;
    if (!mainCanvas || !mapCanvas) return;

    const ctx = mapCanvas.getContext('2d');
    if (!ctx) return;

    const zoomVal = zoom || 1;
    const vpt = canvasVpt && canvasVpt.length >= 6 ? canvasVpt : [1, 0, 0, 1, 0, 0];
    const screenW = mainCanvas.getWidth() || window.innerWidth;
    const screenH = mainCanvas.getHeight() || window.innerHeight;

    const vLeft = -vpt[4] / zoomVal;
    const vTop = -vpt[5] / zoomVal;
    const vW = screenW / zoomVal;
    const vH = screenH / zoomVal;
    const vRight = vLeft + vW;
    const vBottom = vTop + vH;

    let minX = Math.min(0, vLeft);
    let maxX = Math.max(screenW, vRight);
    let minY = Math.min(0, vTop);
    let maxY = Math.max(screenH, vBottom);

    const objects = mainCanvas.getObjects().filter((o: any) => !o.isGuideline && !o.isAnchorPoint);
    for (const obj of objects) {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const w = obj.getScaledWidth ? obj.getScaledWidth() : (obj.width || 0);
      const h = obj.getScaledHeight ? obj.getScaledHeight() : (obj.height || 0);
      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (left + w > maxX) maxX = left + w;
      if (top + h > maxY) maxY = top + h;
    }

    const pad = 120;
    const docLeft = minX - pad;
    const docTop = minY - pad;
    const docWidth = Math.max(200, (maxX - minX) + pad * 2);
    const docHeight = Math.max(150, (maxY - minY) + pad * 2);

    const mapW = mapCanvas.width;
    const mapH = mapCanvas.height;

    ctx.clearRect(0, 0, mapW, mapH);

    // Subtle grid dots in minimap background
    ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
    for (let x = 8; x < mapW; x += 16) {
      for (let y = 8; y < mapH; y += 16) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    const scale = Math.min(mapW / docWidth, mapH / docHeight);
    const drawW = docWidth * scale;
    const drawH = docHeight * scale;
    const offX = (mapW - drawW) / 2 - docLeft * scale;
    const offY = (mapH - drawH) / 2 - docTop * scale;

    geomRef.current = { scale, offX, offY, screenW, screenH, zoomVal };

    // Render miniatures of all canvas objects
    for (const obj of objects) {
      const left = (obj.left ?? 0) * scale + offX;
      const top = (obj.top ?? 0) * scale + offY;
      const w = Math.max(3, (obj.getScaledWidth ? obj.getScaledWidth() : (obj.width || 0)) * scale);
      const h = Math.max(3, (obj.getScaledHeight ? obj.getScaledHeight() : (obj.height || 0)) * scale);

      let fill = (obj.fill as string) || '#6366f1';
      if (fill === 'transparent' || !fill) fill = 'rgba(99, 102, 241, 0.35)';
      ctx.fillStyle = fill;
      ctx.strokeStyle = (obj.stroke as string) || '#6366f1';
      ctx.lineWidth = 1;

      if (obj.type === 'circle') {
        const r = Math.max(2, w / 2);
        ctx.beginPath();
        ctx.arc(left + r, top + r, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (obj.type === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(left + w / 2, top);
        ctx.lineTo(left + w, top + h / 2);
        ctx.lineTo(left + w / 2, top + h);
        ctx.lineTo(left, top + h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (obj.type === 'line' || (obj as any).isConnector) {
        const l = obj as any;
        const x1 = (l.x1 ?? 0) * scale + offX;
        const y1 = (l.y1 ?? 0) * scale + offY;
        const x2 = (l.x2 ?? 0) * scale + offX;
        const y2 = (l.y2 ?? 0) * scale + offY;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else {
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);
      }
    }

    // Render glowing Viewfinder Camera (current screen viewport)
    const vfX = vLeft * scale + offX;
    const vfY = vTop * scale + offY;
    const vfW = Math.max(6, vW * scale);
    const vfH = Math.max(6, vH * scale);

    ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
    ctx.fillRect(vfX, vfY, vfW, vfH);

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vfX, vfY, vfW, vfH);
  }, [canvasRef, canvasVpt, zoom]);

  useEffect(() => {
    if (isOpen) {
      renderMinimap();
    }
  }, [isOpen, renderMinimap]);

  // Redraw on main canvas render / mutations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleCanvasRender = () => {
      if (isOpen) renderMinimap();
    };

    canvas.on('after:render', handleCanvasRender);
    return () => {
      canvas.off('after:render', handleCanvasRender);
    };
  }, [canvasRef, isOpen, renderMinimap]);

  const panToMapPos = (clientX: number, clientY: number) => {
    if (!mapCanvasRef.current) return;
    const rect = mapCanvasRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const { scale, offX, offY, screenW, screenH, zoomVal } = geomRef.current;
    if (scale <= 0) return;

    const sceneX = (px - offX) / scale;
    const sceneY = (py - offY) / scale;

    const targetVptX = screenW / 2 - sceneX * zoomVal;
    const targetVptY = screenH / 2 - sceneY * zoomVal;
    onPanTo(targetVptX, targetVptY);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    panToMapPos(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      panToMapPos(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className="minimap-pill-btn glass-panel"
        onClick={() => setIsOpen(true)}
        title="Open Canvas Minimap"
      >
        <Map size={15} />
        <span>Map</span>
      </button>
    );
  }

  return (
    <div className="canvas-minimap-container glass-panel">
      {/* Header */}
      <div className="minimap-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Compass size={14} style={{ color: 'var(--accent-light)' }} />
          <span className="minimap-title">Minimap</span>
          <span className="minimap-zoom-badge">{Math.round(zoom * 100)}%</span>
        </div>
        <button
          type="button"
          className="minimap-icon-btn"
          onClick={() => setIsOpen(false)}
          title="Minimize Minimap"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Overview Canvas */}
      <canvas
        ref={mapCanvasRef}
        width={210}
        height={130}
        className="minimap-canvas"
        onMouseDown={handleMouseDown}
        title="Click or drag to navigate canvas"
      />
    </div>
  );
};
