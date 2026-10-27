import React, { useRef, useState, useEffect } from 'react';
import type { Canvas } from 'fabric';

interface CanvasScrollbarsProps {
  canvasRef: React.MutableRefObject<Canvas | null>;
  canvasVpt: number[];
  zoom: number;
  onPanBy: (dx: number, dy: number) => void;
  onSetViewportPos: (vptX: number, vptY: number) => void;
}

export const CanvasScrollbars: React.FC<CanvasScrollbarsProps> = ({
  canvasRef,
  canvasVpt,
  zoom,
  onSetViewportPos,
}) => {
  const vTrackRef = useRef<HTMLDivElement>(null);
  const hTrackRef = useRef<HTMLDivElement>(null);
  const [isDraggingV, setIsDraggingV] = useState(false);
  const [isDraggingH, setIsDraggingH] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Briefly boost visibility on viewport change
  useEffect(() => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, 1200);
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [canvasVpt, zoom]);

  const zoomVal = zoom || 1;
  const transX = canvasVpt ? canvasVpt[4] : 0;
  const transY = canvasVpt ? canvasVpt[5] : 0;

  const canvas = canvasRef.current;
  const screenW = canvas ? canvas.getWidth() : window.innerWidth;
  const screenH = canvas ? canvas.getHeight() : window.innerHeight;

  const visibleLeft = -transX / zoomVal;
  const visibleTop = -transY / zoomVal;
  const visibleWidth = screenW / zoomVal;
  const visibleHeight = screenH / zoomVal;
  const visibleRight = visibleLeft + visibleWidth;
  const visibleBottom = visibleTop + visibleHeight;

  // Calculate design & visible boundary envelope
  let minX = Math.min(0, visibleLeft);
  let maxX = Math.max(screenW, visibleRight);
  let minY = Math.min(0, visibleTop);
  let maxY = Math.max(screenH, visibleBottom);

  if (canvas) {
    const objects = canvas.getObjects().filter((o: any) => !o.isGuideline && !o.isAnchorPoint);
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
  }

  // Generous margin around bounds so the user can easily expand designs into empty canvas
  const padX = Math.max(1200, (maxX - minX) * 0.35);
  const padY = Math.max(1200, (maxY - minY) * 0.35);

  const docMinX = Math.min(minX - padX, visibleLeft - 200);
  const docMaxX = Math.max(maxX + padX, visibleRight + 200);
  const docMinY = Math.min(minY - padY, visibleTop - 200);
  const docMaxY = Math.max(maxY + padY, visibleBottom + 200);

  const docWidth = Math.max(100, docMaxX - docMinX);
  const docHeight = Math.max(100, docMaxY - docMinY);

  // Compute Thumb sizes and positions (percentages)
  const vThumbSizePct = Math.max(8, Math.min(100, (visibleHeight / docHeight) * 100));
  const vThumbPosPct = Math.max(0, Math.min(100 - vThumbSizePct, ((visibleTop - docMinY) / docHeight) * 100));

  const hThumbSizePct = Math.max(8, Math.min(100, (visibleWidth / docWidth) * 100));
  const hThumbPosPct = Math.max(0, Math.min(100 - hThumbSizePct, ((visibleLeft - docMinX) / docWidth) * 100));

  // Vertical Thumb Drag
  const handleVThumbMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingV(true);
    const startClientY = e.clientY;
    const startTransY = transY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!vTrackRef.current) return;
      const trackH = vTrackRef.current.clientHeight;
      if (trackH <= 0) return;
      const deltaPx = moveEvent.clientY - startClientY;
      const fraction = deltaPx / trackH;
      const sceneDeltaY = fraction * docHeight;
      const newTransY = startTransY - sceneDeltaY * zoomVal;
      onSetViewportPos(transX, newTransY);
    };

    const handleMouseUp = () => {
      setIsDraggingV(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Horizontal Thumb Drag
  const handleHThumbMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingH(true);
    const startClientX = e.clientX;
    const startTransX = transX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!hTrackRef.current) return;
      const trackW = hTrackRef.current.clientWidth;
      if (trackW <= 0) return;
      const deltaPx = moveEvent.clientX - startClientX;
      const fraction = deltaPx / trackW;
      const sceneDeltaX = fraction * docWidth;
      const newTransX = startTransX - sceneDeltaX * zoomVal;
      onSetViewportPos(newTransX, transY);
    };

    const handleMouseUp = () => {
      setIsDraggingH(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Track Clicks
  const handleVTrackClick = (e: React.MouseEvent) => {
    if (!vTrackRef.current) return;
    const rect = vTrackRef.current.getBoundingClientRect();
    const clickFraction = (e.clientY - rect.top) / rect.height;
    const targetSceneY = docMinY + clickFraction * docHeight - visibleHeight / 2;
    onSetViewportPos(transX, -targetSceneY * zoomVal);
  };

  const handleHTrackClick = (e: React.MouseEvent) => {
    if (!hTrackRef.current) return;
    const rect = hTrackRef.current.getBoundingClientRect();
    const clickFraction = (e.clientX - rect.left) / rect.width;
    const targetSceneX = docMinX + clickFraction * docWidth - visibleWidth / 2;
    onSetViewportPos(-targetSceneX * zoomVal, transY);
  };

  const active = isDraggingV || isDraggingH || isHovered || isScrolling;

  return (
    <div
      className="canvas-scrollbars-layer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        opacity: active ? 1 : 0.4,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Vertical Scrollbar */}
      <div
        ref={vTrackRef}
        className="canvas-scrollbar-track-v"
        onClick={handleVTrackClick}
        title="Scroll Vertically"
      >
        <div
          className={`canvas-scrollbar-thumb ${isDraggingV ? 'dragging' : ''}`}
          style={{
            top: `${vThumbPosPct}%`,
            height: `${vThumbSizePct}%`,
            width: '100%',
          }}
          onMouseDown={handleVThumbMouseDown}
        />
      </div>

      {/* Horizontal Scrollbar */}
      <div
        ref={hTrackRef}
        className="canvas-scrollbar-track-h"
        onClick={handleHTrackClick}
        title="Scroll Horizontally (or Shift + Wheel)"
      >
        <div
          className={`canvas-scrollbar-thumb ${isDraggingH ? 'dragging' : ''}`}
          style={{
            left: `${hThumbPosPct}%`,
            width: `${hThumbSizePct}%`,
            height: '100%',
          }}
          onMouseDown={handleHThumbMouseDown}
        />
      </div>
    </div>
  );
};

