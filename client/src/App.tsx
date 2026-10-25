import { useRef, useCallback } from 'react';
import { useFabricCanvas } from './hooks/useFabricCanvas';
import { useCanvasStore } from './store/canvasStore';
import { TopBar } from './components/header/TopBar';
import { FloatingDock } from './components/toolbar/FloatingDock';
import { ContextualToolbar } from './components/toolbar/ContextualToolbar';
import { CanvasControls } from './components/canvas/CanvasControls';
import { RemoteCursors } from './components/collaboration/RemoteCursors';
import { QuickStartCard } from './components/modals/QuickStartCard';
import { ShareModal } from './components/modals/ShareModal';
import { AIPromptModal } from './components/modals/AIPromptModal';
import { parsePromptToTopology, compileAndInjectDiagram } from './services/aiCompiler';

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const showGrid = useCanvasStore((state) => state.showGrid);
  const zoom = useCanvasStore((state) => state.zoom);

  const {
    canvasRef,
    canvasVpt,
    addRectangle,
    addCircle,
    addDiamond,
    addStickyNote,
    addText,
    addArrow,
    changeSelectedFill,
    changeSelectedStroke,
    deleteSelected,
    duplicateSelected,
    zoomIn,
    zoomOut,
    resetZoom,
    undo,
    redo,
    exportPNG,
    tidyUp,
  } = useFabricCanvas(containerRef);

  const handleGenerateAIDiagram = useCallback((prompt: string) => {
    if (!canvasRef.current) return;
    const topology = parsePromptToTopology(prompt);
    compileAndInjectDiagram(canvasRef.current, topology);
  }, [canvasRef]);

  // Dynamic grid style
  const gridBackground = showGrid
    ? {
        backgroundImage: `radial-gradient(var(--grid-dot) 1.5px, transparent 1.5px)`,
        backgroundSize: `${Math.max(16, 24 * zoom)}px ${Math.max(16, 24 * zoom)}px`,
      }
    : {};

  return (
    <main
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        ...gridBackground,
      }}
    >
      {/* Top Header Bar */}
      <TopBar onExport={exportPNG} />

      {/* Canvas Viewport Container */}
      <div
        ref={containerRef}
        className="canvas-container-wrapper"
        tabIndex={0}
      />

      {/* Live Multiplayer Remote Cursors Overlay */}
      <RemoteCursors canvasVpt={canvasVpt} zoom={zoom} />

      {/* Disappearing Beginner Guide on Blank Canvas */}
      <QuickStartCard />

      {/* Floating Contextual Toolbar above Selected Object */}
      <ContextualToolbar
        onChangeFill={changeSelectedFill}
        onChangeStroke={changeSelectedStroke}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onTidyUp={tidyUp}
      />

      {/* Bottom Viewport Zoom Controls */}
      <CanvasControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
      />

      {/* Centered Floating Dock */}
      <FloatingDock
        onAddRectangle={addRectangle}
        onAddCircle={addCircle}
        onAddDiamond={addDiamond}
        onAddStickyNote={addStickyNote}
        onAddText={addText}
        onAddArrow={addArrow}
        onUndo={undo}
        onRedo={redo}
        onTidyUp={tidyUp}
      />

      {/* Modals */}
      <ShareModal />
      <AIPromptModal onGenerateDiagram={handleGenerateAIDiagram} />
    </main>
  );
}

export default App;
