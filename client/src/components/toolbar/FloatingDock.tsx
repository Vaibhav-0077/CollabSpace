import React from 'react';
import { 
  MousePointer2, 
  Hand, 
  Square, 
  Circle as CircleIcon, 
  Diamond as DiamondIcon, 
  StickyNote, 
  Pencil, 
  Type, 
  MoveRight, 
  Sparkles, 
  Undo2, 
  Redo2 
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import type { ToolType } from '../../types/canvas';

interface FloatingDockProps {
  onAddRectangle: () => void;
  onAddCircle: () => void;
  onAddDiamond: () => void;
  onAddStickyNote: () => void;
  onAddText: () => void;
  onAddArrow: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  onAddRectangle,
  onAddCircle,
  onAddDiamond,
  onAddStickyNote,
  onAddText,
  onAddArrow,
  onUndo,
  onRedo,
}) => {
  const { 
    activeTool, 
    setActiveTool, 
    canUndo, 
    canRedo, 
    setIsAIModalOpen 
  } = useCanvasStore();

  const handleToolSelect = (tool: ToolType) => {
    setActiveTool(tool);
    if (tool === 'rectangle') onAddRectangle();
    if (tool === 'circle') onAddCircle();
    if (tool === 'diamond') onAddDiamond();
    if (tool === 'sticky') onAddStickyNote();
    if (tool === 'text') onAddText();
    if (tool === 'arrow') onAddArrow();
  };

  return (
    <div className="floating-dock-container glass-panel">
      {/* Selection & Pan */}
      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
        onClick={() => setActiveTool('select')}
        aria-label="Select Tool"
      >
        <MousePointer2 size={18} />
        <span className="tool-tooltip">Select <kbd>V</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'hand' ? 'active' : ''}`}
        onClick={() => setActiveTool('hand')}
        aria-label="Hand / Pan Tool"
      >
        <Hand size={18} />
        <span className="tool-tooltip">Pan Canvas <kbd>H / Space</kbd></span>
      </button>

      <div className="dock-divider" />

      {/* Primitive Shapes */}
      <button
        type="button"
        className="dock-tool-btn"
        onClick={() => handleToolSelect('rectangle')}
        aria-label="Rectangle"
      >
        <Square size={18} />
        <span className="tool-tooltip">Rectangle <kbd>R</kbd></span>
      </button>

      <button
        type="button"
        className="dock-tool-btn"
        onClick={() => handleToolSelect('circle')}
        aria-label="Circle"
      >
        <CircleIcon size={18} />
        <span className="tool-tooltip">Circle <kbd>O</kbd></span>
      </button>

      <button
        type="button"
        className="dock-tool-btn"
        onClick={() => handleToolSelect('diamond')}
        aria-label="Diamond"
      >
        <DiamondIcon size={18} />
        <span className="tool-tooltip">Decision Node <kbd>D</kbd></span>
      </button>

      <button
        type="button"
        className="dock-tool-btn"
        onClick={() => handleToolSelect('sticky')}
        aria-label="Sticky Note"
      >
        <StickyNote size={18} />
        <span className="tool-tooltip">Sticky Note <kbd>S</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'pencil' ? 'active' : ''}`}
        onClick={() => setActiveTool('pencil')}
        aria-label="Draw Pencil"
      >
        <Pencil size={18} />
        <span className="tool-tooltip">Draw Pen <kbd>P</kbd></span>
      </button>

      <button
        type="button"
        className="dock-tool-btn"
        onClick={() => handleToolSelect('text')}
        aria-label="Text"
      >
        <Type size={18} />
        <span className="tool-tooltip">Text <kbd>T</kbd></span>
      </button>

      <button
        type="button"
        className="dock-tool-btn"
        onClick={() => handleToolSelect('arrow')}
        aria-label="Arrow"
      >
        <MoveRight size={18} />
        <span className="tool-tooltip">Connector <kbd>A</kbd></span>
      </button>

      <div className="dock-divider" />

      {/* AI Superpower */}
      <button
        type="button"
        className="dock-tool-btn"
        style={{ color: '#c084fc' }}
        onClick={() => setIsAIModalOpen(true)}
        aria-label="AI Diagram Generator"
      >
        <Sparkles size={18} />
        <span className="tool-tooltip">AI Diagram <kbd>⌘K</kbd></span>
      </button>

      <div className="dock-divider" />

      {/* History */}
      <button
        type="button"
        className="dock-tool-btn"
        onClick={onUndo}
        disabled={!canUndo}
        style={{ opacity: canUndo ? 1 : 0.4 }}
        aria-label="Undo"
      >
        <Undo2 size={18} />
        <span className="tool-tooltip">Undo <kbd>⌘Z</kbd></span>
      </button>

      <button
        type="button"
        className="dock-tool-btn"
        onClick={onRedo}
        disabled={!canRedo}
        style={{ opacity: canRedo ? 1 : 0.4 }}
        aria-label="Redo"
      >
        <Redo2 size={18} />
        <span className="tool-tooltip">Redo <kbd>⌘Y</kbd></span>
      </button>
    </div>
  );
};
