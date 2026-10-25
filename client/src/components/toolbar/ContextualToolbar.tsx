import React from 'react';
import { Trash2, Copy, LayoutGrid, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { PASTEL_COLORS, STROKE_COLORS } from '../../types/canvas';

interface ContextualToolbarProps {
  onChangeFill: (color: string) => void;
  onChangeStroke: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeStrokeStyle: (style: 'solid' | 'dashed' | 'dotted') => void;
  onChangeFontSize: (size: number) => void;
  onChangeFontFamily: (family: string) => void;
  onChangeTextAlign: (align: 'left' | 'center' | 'right') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTidyUp?: () => void;
}

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  onChangeFill,
  onChangeStroke,
  onChangeStrokeWidth,
  onChangeStrokeStyle,
  onChangeFontSize,
  onChangeFontFamily,
  onChangeTextAlign,
  onDuplicate,
  onDelete,
  onTidyUp,
}) => {
  const selectedObject = useCanvasStore((state) => state.selectedObject);

  if (!selectedObject) return null;

  const isTextbox = selectedObject.type === 'textbox';
  const isGroup = selectedObject.type === 'group';
  const hasShape = !isTextbox || isGroup;
  const hasText = isTextbox || isGroup || selectedObject.fontSize !== undefined;

  // Clamped position to keep toolbar in viewport
  const isNearTop = selectedObject.top < 140;
  const leftPos = Math.max(220, Math.min(window.innerWidth - 220, selectedObject.left));
  const topPos = isNearTop
    ? selectedObject.top + (selectedObject.height || 100) + 14
    : selectedObject.top - 14;

  // Active stroke style detector
  const getStrokeStyle = (dash?: number[] | null): 'solid' | 'dashed' | 'dotted' => {
    if (!dash || dash.length === 0) return 'solid';
    if (dash[0] <= 4) return 'dotted';
    return 'dashed';
  };
  const currentStrokeStyle = getStrokeStyle(selectedObject.strokeDashArray);

  // Active stroke width detector
  const currentStrokeWidth = selectedObject.strokeWidth ?? 2;

  // Active font family detector
  const currentFontFamily = (selectedObject.fontFamily || '').toLowerCase();
  const isCasual = currentFontFamily.includes('caveat') || currentFontFamily.includes('cursive');
  const isMono = currentFontFamily.includes('mono');
  const isSans = !isCasual && !isMono;

  // Active font size detector
  const currentFontSize = selectedObject.fontSize ?? 18;

  // Active text align detector
  const currentTextAlign = selectedObject.textAlign || 'left';

  return (
    <div
      className="contextual-toolbar glass-panel"
      style={{
        left: `${leftPos}px`,
        top: `${topPos}px`,
        transform: isNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
      }}
    >
      {/* ROW 1: Colors & Actions */}
      <div className="contextual-row">
        {/* Fill Colors (if has shape) */}
        {hasShape && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {PASTEL_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`color-swatch-btn ${selectedObject.fill === c.value ? 'selected' : ''}`}
                style={
                  c.value === 'transparent'
                    ? {
                        background:
                          'linear-gradient(135deg, transparent calc(50% - 1.5px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1.5px))',
                        border: '1.5px solid var(--border-medium)',
                      }
                    : { backgroundColor: c.value }
                }
                onClick={() => onChangeFill(c.value)}
                title={`Fill: ${c.label}`}
              />
            ))}
          </div>
        )}

        {/* Text Colors (if textbox only) */}
        {isTextbox && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {STROKE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`color-swatch-btn ${selectedObject.fill === c.value ? 'selected' : ''}`}
                style={{
                  backgroundColor: c.value,
                  width: '20px',
                  height: '20px',
                  border: c.value === '#ffffff' ? '1px solid var(--border-medium)' : undefined,
                }}
                onClick={() => onChangeFill(c.value)}
                title={`Text Color: ${c.label}`}
              />
            ))}
          </div>
        )}

        {/* Stroke Colors (if has shape) */}
        {hasShape && (
          <>
            <div className="dock-divider" style={{ height: '18px' }} />
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {STROKE_COLORS.slice(0, 5).map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`color-swatch-btn ${selectedObject.stroke === c.value ? 'selected' : ''}`}
                  style={{
                    backgroundColor: c.value,
                    width: '18px',
                    height: '18px',
                    border: c.value === '#ffffff' ? '1px solid var(--border-medium)' : undefined,
                  }}
                  onClick={() => onChangeStroke(c.value)}
                  title={`Stroke: ${c.label}`}
                />
              ))}
            </div>
          </>
        )}

        <div className="dock-divider" style={{ height: '18px' }} />

        {/* Action Buttons: Tidy-Up, Duplicate, Delete */}
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          {onTidyUp && (
            <button
              type="button"
              className="dock-tool-btn"
              style={{ width: '28px', height: '28px', color: 'var(--accent-light)' }}
              onClick={onTidyUp}
              title="Tidy Up & Auto-Align"
            >
              <LayoutGrid size={14} />
            </button>
          )}

          <button
            type="button"
            className="dock-tool-btn"
            style={{ width: '28px', height: '28px' }}
            onClick={onDuplicate}
            title="Duplicate"
          >
            <Copy size={14} />
          </button>

          <button
            type="button"
            className="dock-tool-btn"
            style={{ width: '28px', height: '28px', color: '#f87171' }}
            onClick={onDelete}
            title="Delete (Backspace)"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ROW 2: Shape Stroke Width & Style OR Text Font Style, Size & Align */}
      <div className="contextual-row" style={{ paddingTop: '2px' }}>
        {/* 1. Box Stroke Width (Thin, Medium, Bold) */}
        {hasShape && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="contextual-label">Stroke</span>
            <div className="segmented-group">
              <button
                type="button"
                className={`segmented-btn ${currentStrokeWidth <= 1.5 ? 'active' : ''}`}
                onClick={() => onChangeStrokeWidth(1)}
                title="Thin (1px)"
              >
                <span className="stroke-preview-line line-thin" />
                <span>1px</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${currentStrokeWidth > 1.5 && currentStrokeWidth < 3.5 ? 'active' : ''}`}
                onClick={() => onChangeStrokeWidth(2)}
                title="Medium (2px)"
              >
                <span className="stroke-preview-line line-medium" />
                <span>2px</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${currentStrokeWidth >= 3.5 ? 'active' : ''}`}
                onClick={() => onChangeStrokeWidth(4)}
                title="Bold (4px)"
              >
                <span className="stroke-preview-line line-bold" />
                <span>4px</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Box Stroke Style (Solid, Dashed, Dotted) */}
        {hasShape && (
          <>
            <div className="dock-divider" style={{ height: '16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="contextual-label">Style</span>
              <div className="segmented-group">
                <button
                  type="button"
                  className={`segmented-btn ${currentStrokeStyle === 'solid' ? 'active' : ''}`}
                  onClick={() => onChangeStrokeStyle('solid')}
                  title="Solid Line"
                >
                  <span className="stroke-style-preview style-solid" />
                  <span>Solid</span>
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${currentStrokeStyle === 'dashed' ? 'active' : ''}`}
                  onClick={() => onChangeStrokeStyle('dashed')}
                  title="Dashed Line"
                >
                  <span className="stroke-style-preview style-dashed" />
                  <span>Dashed</span>
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${currentStrokeStyle === 'dotted' ? 'active' : ''}`}
                  onClick={() => onChangeStrokeStyle('dotted')}
                  title="Dotted Line"
                >
                  <span className="stroke-style-preview style-dotted" />
                  <span>Dotted</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Divider between shape and text options if sticky note */}
        {hasShape && hasText && (
          <div className="dock-divider" style={{ height: '16px' }} />
        )}

        {/* 1. Font Style (Sans, Casual/Handwritten, Monospace) */}
        {hasText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="contextual-label">Font</span>
            <div className="segmented-group">
              <button
                type="button"
                className={`segmented-btn font-preview-sans ${isSans ? 'active' : ''}`}
                onClick={() => onChangeFontFamily("'Plus Jakarta Sans', sans-serif")}
                title="Sans-Serif Font (Modern Clean)"
              >
                Sans
              </button>
              <button
                type="button"
                className={`segmented-btn font-preview-casual ${isCasual ? 'active' : ''}`}
                onClick={() => onChangeFontFamily("'Caveat', cursive")}
                title="Casual Handwriting Font (Excalidraw Style)"
              >
                Casual
              </button>
              <button
                type="button"
                className={`segmented-btn font-preview-mono ${isMono ? 'active' : ''}`}
                onClick={() => onChangeFontFamily("'JetBrains Mono', monospace")}
                title="Monospace Code Font"
              >
                Mono
              </button>
            </div>
          </div>
        )}

        {/* 2. Font Size (S, M, L, XL) */}
        {hasText && (
          <>
            <div className="dock-divider" style={{ height: '16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="contextual-label">Size</span>
              <div className="segmented-group">
                <button
                  type="button"
                  className={`segmented-btn ${currentFontSize <= 15 ? 'active' : ''}`}
                  onClick={() => onChangeFontSize(14)}
                  title="Small (14px)"
                >
                  S
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${currentFontSize > 15 && currentFontSize <= 22 ? 'active' : ''}`}
                  onClick={() => onChangeFontSize(18)}
                  title="Medium (18px)"
                >
                  M
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${currentFontSize > 22 && currentFontSize <= 30 ? 'active' : ''}`}
                  onClick={() => onChangeFontSize(26)}
                  title="Large (26px)"
                >
                  L
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${currentFontSize > 30 ? 'active' : ''}`}
                  onClick={() => onChangeFontSize(36)}
                  title="Extra Large (36px)"
                >
                  XL
                </button>
              </div>
            </div>
          </>
        )}

        {/* 3. Text Align (Left, Center, Right) */}
        {hasText && (
          <>
            <div className="dock-divider" style={{ height: '16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="contextual-label">Align</span>
              <div className="segmented-group">
                <button
                  type="button"
                  className={`segmented-btn ${currentTextAlign === 'left' ? 'active' : ''}`}
                  onClick={() => onChangeTextAlign('left')}
                  title="Align Left"
                >
                  <AlignLeft size={13} />
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${currentTextAlign === 'center' ? 'active' : ''}`}
                  onClick={() => onChangeTextAlign('center')}
                  title="Align Center"
                >
                  <AlignCenter size={13} />
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${currentTextAlign === 'right' ? 'active' : ''}`}
                  onClick={() => onChangeTextAlign('right')}
                  title="Align Right"
                >
                  <AlignRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
