import React from 'react';
import { Trash2, Copy } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { PASTEL_COLORS, STROKE_COLORS } from '../../types/canvas';

interface ContextualToolbarProps {
  onChangeFill: (color: string) => void;
  onChangeStroke: (color: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  onChangeFill,
  onChangeStroke,
  onDuplicate,
  onDelete,
}) => {
  const selectedObject = useCanvasStore((state) => state.selectedObject);

  if (!selectedObject) return null;

  return (
    <div
      className="contextual-toolbar glass-panel"
      style={{
        left: `${selectedObject.left}px`,
        top: `${selectedObject.top}px`,
      }}
    >
      {/* 8 Curated Pastel Fill Colors */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingRight: '6px' }}>
        {PASTEL_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`color-swatch-btn ${selectedObject.fill === c.value ? 'selected' : ''}`}
            style={{ backgroundColor: c.value }}
            onClick={() => onChangeFill(c.value)}
            title={c.label}
          />
        ))}
      </div>

      <div className="dock-divider" style={{ height: '18px' }} />

      {/* Primary Stroke Colors */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingRight: '6px' }}>
        {STROKE_COLORS.slice(0, 4).map((c) => (
          <button
            key={c.value}
            type="button"
            className={`color-swatch-btn ${selectedObject.stroke === c.value ? 'selected' : ''}`}
            style={{
              backgroundColor: c.value,
              width: '18px',
              height: '18px',
            }}
            onClick={() => onChangeStroke(c.value)}
            title={`Border: ${c.label}`}
          />
        ))}
      </div>

      <div className="dock-divider" style={{ height: '18px' }} />

      {/* Duplicate & Delete Buttons */}
      <button
        type="button"
        className="dock-tool-btn"
        style={{ width: '30px', height: '30px' }}
        onClick={onDuplicate}
        title="Duplicate"
      >
        <Copy size={15} />
      </button>

      <button
        type="button"
        className="dock-tool-btn"
        style={{ width: '30px', height: '30px', color: '#f87171' }}
        onClick={onDelete}
        title="Delete (Backspace)"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};
