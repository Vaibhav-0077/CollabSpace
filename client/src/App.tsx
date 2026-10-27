import { useRef, useCallback } from 'react';
import { useFabricCanvas } from './hooks/useFabricCanvas';
import { useCanvasStore } from './store/canvasStore';
import { TopBar } from './components/header/TopBar';
import { FloatingDock } from './components/toolbar/FloatingDock';
import { ContextualToolbar } from './components/toolbar/ContextualToolbar';
import { CanvasControls } from './components/canvas/CanvasControls';
import { CanvasScrollbars } from './components/canvas/CanvasScrollbars';
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
    changeSelectedStrokeWidth,
    changeSelectedStrokeStyle,
    changeSelectedFontSize,
    changeSelectedFontFamily,
    changeSelectedTextAlign,
    changeSelectedArrowCurvature,
    changeSelectedArrowhead,
    deleteSelected,
    duplicateSelected,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToContent,
    panBy,
    setViewportPos,
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

  // Dynamic grid style synchronized with viewport panning
  const gridBackground = showGrid
    ? {
        backgroundImage: `radial-gradient(var(--grid-dot) 1.5px, transparent 1.5px)`,
        backgroundSize: `${Math.max(16, 24 * zoom)}px ${Math.max(16, 24 * zoom)}px`,
        backgroundPosition: `${canvasVpt ? canvasVpt[4] : 0}px ${canvasVpt ? canvasVpt[5] : 0}px`,
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
        onChangeStrokeWidth={changeSelectedStrokeWidth}
        onChangeStrokeStyle={changeSelectedStrokeStyle}
        onChangeFontSize={changeSelectedFontSize}
        onChangeFontFamily={changeSelectedFontFamily}
        onChangeTextAlign={changeSelectedTextAlign}
        onChangeArrowCurvature={changeSelectedArrowCurvature}
        onChangeArrowhead={changeSelectedArrowhead}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onTidyUp={tidyUp}
      />

      {/* Interactive Page Scrollbars */}
      <CanvasScrollbars
        canvasRef={canvasRef}
        canvasVpt={canvasVpt}
        zoom={zoom}
        onPanBy={panBy}
        onSetViewportPos={setViewportPos}
      />

      {/* Bottom Viewport Zoom Controls */}
      <CanvasControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onFitToContent={fitToContent}
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
