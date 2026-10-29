import React, { useEffect, useRef } from 'react';
import { socketService } from '../../services/socketService';

export interface LaserPoint {
  x: number; // Scene world coordinate
  y: number; // Scene world coordinate
  color: string;
  timestamp: number;
  socketId: string;
}

// Global hook to allow local canvas events to append points directly with zero latency
type LaserListener = (point: LaserPoint) => void;
const laserListeners: Set<LaserListener> = new Set();

export const emitLocalLaserPoint = (x: number, y: number, color: string) => {
  const point: LaserPoint = {
    x,
    y,
    color,
    timestamp: Date.now(),
    socketId: 'local',
  };
  laserListeners.forEach((listener) => listener(point));
};

interface LaserOverlayProps {
  canvasVpt: number[];
  zoom: number;
}

const TRAIL_LIFETIME_MS = 1200; // Trail fades away cleanly over 1.2s

export const LaserOverlay: React.FC<LaserOverlayProps> = ({ canvasVpt, zoom }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<LaserPoint[]>([]);
  const isLoopRunningRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  const transX = canvasVpt ? canvasVpt[4] : 0;
  const transY = canvasVpt ? canvasVpt[5] : 0;

  // Transform scene world point to screen coordinates
  const toScreenCoords = (x: number, y: number) => {
    return {
      x: x * zoom + transX,
      y: y * zoom + transY,
    };
  };

  // Start RAF loop when new points arrive
  const startLoopIfNeeded = () => {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;
    runLoop();
  };

  const runLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      isLoopRunningRef.current = false;
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      isLoopRunningRef.current = false;
      return;
    }

    const now = Date.now();
    // Retain only unexpired points
    pointsRef.current = pointsRef.current.filter(
      (pt) => now - pt.timestamp < TRAIL_LIFETIME_MS
    );

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (pointsRef.current.length === 0) {
      isLoopRunningRef.current = false;
      return;
    }

    // Group points by emitter (local or remote socketId)
    const groupedPoints: Record<string, LaserPoint[]> = {};
    for (const pt of pointsRef.current) {
      if (!groupedPoints[pt.socketId]) {
        groupedPoints[pt.socketId] = [];
      }
      groupedPoints[pt.socketId].push(pt);
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const group of Object.values(groupedPoints)) {
      if (group.length === 0) continue;
      const primaryColor = group[0].color || '#ef4444';

      // 1. Draw glowing fading segments
      for (let i = 0; i < group.length - 1; i++) {
        const p1 = group[i];
        const p2 = group[i + 1];

        // Skip discontinuous gaps between distinct strokes (> 300ms)
        if (p2.timestamp - p1.timestamp > 300) continue;

        const age = now - p2.timestamp;
        const progress = Math.min(1, Math.max(0, age / TRAIL_LIFETIME_MS));
        const alpha = (1 - progress);

        const s1 = toScreenCoords(p1.x, p1.y);
        const s2 = toScreenCoords(p2.x, p2.y);

        // Outer Neon Halo
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.shadowBlur = 12 * alpha;
        ctx.shadowColor = primaryColor;
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = Math.max(1.5, 6 * alpha);
        ctx.globalAlpha = alpha * 0.85;
        ctx.stroke();

        // Inner Bright Core
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, 2.2 * alpha);
        ctx.globalAlpha = alpha;
        ctx.stroke();
      }

      // 2. Draw intense glowing pointer dot at the head of the trail
      const head = group[group.length - 1];
      const headAge = now - head.timestamp;
      if (headAge < 600) {
        const headAlpha = 1 - headAge / 600;
        const headScreen = toScreenCoords(head.x, head.y);

        // Outer Glow Pulse
        ctx.beginPath();
        ctx.arc(headScreen.x, headScreen.y, 8, 0, Math.PI * 2);
        ctx.shadowBlur = 18;
        ctx.shadowColor = primaryColor;
        ctx.fillStyle = primaryColor;
        ctx.globalAlpha = headAlpha * 0.7;
        ctx.fill();

        // Bright Hot Core
        ctx.beginPath();
        ctx.arc(headScreen.x, headScreen.y, 3.5, 0, Math.PI * 2);
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = headAlpha;
        ctx.fill();
      }
    }

    ctx.restore();
    rafIdRef.current = requestAnimationFrame(runLoop);
  };

  // Subscribe to local laser points
  useEffect(() => {
    const handleLocalPoint = (point: LaserPoint) => {
      pointsRef.current.push(point);
      startLoopIfNeeded();
    };

    laserListeners.add(handleLocalPoint);
    return () => {
      laserListeners.delete(handleLocalPoint);
    };
  }, []);

  // Subscribe to remote laser points from socket
  useEffect(() => {
    socketService.onLaserPointer = (data) => {
      pointsRef.current.push({
        x: data.x,
        y: data.y,
        color: data.color || '#ef4444',
        timestamp: Date.now(),
        socketId: data.socketId,
      });
      startLoopIfNeeded();
    };

    return () => {
      socketService.onLaserPointer = undefined;
    };
  }, []);

  // Handle canvas sizing for Retina / High-DPI screens
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Trigger re-render of laser points when canvas pan/zoom updates
  useEffect(() => {
    if (pointsRef.current.length > 0) {
      startLoopIfNeeded();
    }
  }, [canvasVpt, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className="laser-overlay-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 18,
      }}
    />
  );
};

