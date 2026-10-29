import React, { useRef } from 'react';
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
  Image as ImageIcon,
  Flame,
  Sparkles, 
  LayoutGrid,
  Undo2, 
  Redo2 
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import type { ToolType } from '../../types/canvas';

interface FloatingDockProps {
  onAddRectangle?: () => void;
  onAddCircle?: () => void;
  onAddDiamond?: () => void;
  onAddStickyNote?: () => void;
  onAddText?: () => void;
  onAddArrow?: () => void;
  onUploadImage?: (dataUrl: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onTidyUp?: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  onUploadImage,
  onUndo,
  onRedo,
  onTidyUp,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    activeTool, 
    setActiveTool, 
    canUndo, 
    canRedo, 
    setIsAIModalOpen 
  } = useCanvasStore();

  const handleToolSelect = (tool: ToolType) => {
    setActiveTool(tool);
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadImage) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) onUploadImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
        <MousePointer2 size={16} />
        <span className="tool-tooltip">Select <kbd>V</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'hand' ? 'active' : ''}`}
        onClick={() => setActiveTool('hand')}
        aria-label="Hand / Pan Tool"
      >
        <Hand size={16} />
        <span className="tool-tooltip">Pan Canvas <kbd>H / Space</kbd></span>
      </button>

      <div className="dock-divider" />

      {/* Primitive Shapes */}
      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
        onClick={() => handleToolSelect('rectangle')}
        aria-label="Rectangle"
      >
        <Square size={16} />
        <span className="tool-tooltip">Rectangle <kbd>R</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'circle' ? 'active' : ''}`}
        onClick={() => handleToolSelect('circle')}
        aria-label="Circle"
      >
        <CircleIcon size={16} />
        <span className="tool-tooltip">Circle <kbd>O</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'diamond' ? 'active' : ''}`}
        onClick={() => handleToolSelect('diamond')}
        aria-label="Diamond"
      >
        <DiamondIcon size={16} />
        <span className="tool-tooltip">Decision Node <kbd>D</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'sticky' ? 'active' : ''}`}
        onClick={() => handleToolSelect('sticky')}
        aria-label="Sticky Note"
      >
        <StickyNote size={16} />
        <span className="tool-tooltip">Sticky Note <kbd>S</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'pencil' ? 'active' : ''}`}
        onClick={() => setActiveTool('pencil')}
        aria-label="Draw Pencil"
      >
        <Pencil size={16} />
        <span className="tool-tooltip">Draw Pen <kbd>P</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'text' ? 'active' : ''}`}
        onClick={() => handleToolSelect('text')}
        aria-label="Text"
      >
        <Type size={16} />
        <span className="tool-tooltip">Text <kbd>T</kbd></span>
      </button>

      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'arrow' ? 'active' : ''}`}
        onClick={() => handleToolSelect('arrow')}
        aria-label="Arrow"
      >
        <MoveRight size={16} />
        <span className="tool-tooltip">Magnetic Connector <kbd>A</kbd></span>
      </button>

      {/* Insert Image */}
      <button
        type="button"
        className="dock-tool-btn"
        onClick={handleImageUploadClick}
        aria-label="Insert Image"
      >
        <ImageIcon size={16} />
        <span className="tool-tooltip">Image <kbd>Ctrl+V</kbd></span>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* Live Laser Pointer Tool */}
      <button
        type="button"
        className={`dock-tool-btn ${activeTool === 'laser' ? 'active' : ''}`}
        onClick={() => setActiveTool('laser')}
        aria-label="Laser Pointer"
        style={{ color: activeTool === 'laser' ? '#ef4444' : undefined }}
      >
        <Flame size={16} />
        <span className="tool-tooltip">Laser Pointer <kbd>L</kbd></span>
      </button>

      <div className="dock-divider" />

      {/* Tidy Up Auto-Alignment */}
      {onTidyUp && (
        <button
          type="button"
          className="dock-tool-btn"
          style={{ color: '#38bdf8' }}
          onClick={onTidyUp}
          aria-label="Tidy Up Layout"
        >
          <LayoutGrid size={16} />
          <span className="tool-tooltip">Tidy Up Layout</span>
        </button>
      )}

      {/* AI Superpower */}
      <button
        type="button"
        className="dock-tool-btn"
        style={{ color: '#c084fc' }}
        onClick={() => setIsAIModalOpen(true)}
        aria-label="AI Diagram Generator"
      >
        <Sparkles size={16} />
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
        <Undo2 size={16} />
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
        <Redo2 size={16} />
        <span className="tool-tooltip">Redo <kbd>⌘Y</kbd></span>
      </button>
    </div>
  );
};
