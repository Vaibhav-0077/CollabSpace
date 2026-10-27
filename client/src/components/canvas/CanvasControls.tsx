import React from 'react';
import { ZoomIn, ZoomOut, Scan, Maximize2, Grid } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';

interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToContent?: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToContent,
}) => {
  const { zoom, showGrid, toggleGrid } = useCanvasStore();

  return (
    <div className="canvas-viewport-controls glass-panel">
      <button
        type="button"
        className="control-icon-btn"
        onClick={onZoomOut}
        title="Zoom Out (-)"
      >
        <ZoomOut size={16} />
      </button>

      <span className="zoom-level-text">
        {Math.round(zoom * 100)}%
      </span>

      <button
        type="button"
        className="control-icon-btn"
        onClick={onZoomIn}
        title="Zoom In (+)"
      >
        <ZoomIn size={16} />
      </button>

      <div className="dock-divider" style={{ height: '18px' }} />

      <button
        type="button"
        className="control-icon-btn"
        onClick={onResetZoom}
        title="Reset Zoom to 100% (Cmd+0)"
      >
        <Scan size={16} />
      </button>

      {onFitToContent && (
        <button
          type="button"
          className="control-icon-btn"
          onClick={onFitToContent}
          title="Fit All Content to Screen (Shift+1)"
        >
          <Maximize2 size={16} />
        </button>
      )}

      <button
        type="button"
        className="control-icon-btn"
        style={{ color: showGrid ? 'var(--accent-light)' : 'inherit' }}
        onClick={toggleGrid}
        title="Toggle Dot Grid"
      >
        <Grid size={16} />
      </button>
    </div>
  );
};
