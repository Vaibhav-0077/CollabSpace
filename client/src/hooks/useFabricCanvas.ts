import { useEffect, useRef, useCallback } from 'react';
import { 
  Canvas, 
  Rect, 
  Circle, 
  Polygon, 
  Textbox, 
  Line, 
  Group, 
  Point, 
  PencilBrush, 
  FabricObject,
  TPointerEventInfo
} from 'fabric';
import { useCanvasStore } from '../store/canvasStore';
import { nanoid } from 'nanoid';

// Customize Fabric defaults for an ultra-premium feel
FabricObject.prototype.set({
  cornerColor: '#6366f1',
  cornerStrokeColor: '#ffffff',
  cornerStyle: 'circle',
  cornerSize: 10,
  transparentCorners: false,
  borderColor: '#6366f1',
  borderScaleFactor: 1.5,
  padding: 6,
  objectCaching: true,
});

export function useFabricCanvas(containerRef: React.RefObject<HTMLDivElement | null>) {
  const canvasRef = useRef<Canvas | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

  const {
    activeTool,
    selectedFill,
    selectedStroke,
    strokeWidth,
    zoom,
    setZoom,
    setActiveTool,
    setUndoRedoState,
    setSelectedObject,
    setHasObjects
  } = useCanvasStore();

  // History stack for Undo/Redo
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoActionRef = useRef<boolean>(false);

  // Panning state
  const isPanningRef = useRef<boolean>(false);
  const lastPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef<boolean>(false);

  // Helper to record history snapshot
  const saveHistory = useCallback(() => {
    if (!canvasRef.current || isUndoRedoActionRef.current) return;
    try {
      const json = JSON.stringify(canvasRef.current.toJSON());
      // Truncate future states if we performed an action after undo
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      }
      historyRef.current.push(json);
      historyIndexRef.current = historyRef.current.length - 1;

      setUndoRedoState(
        historyIndexRef.current > 0,
        historyIndexRef.current < historyRef.current.length - 1
      );

      const objectsCount = canvasRef.current.getObjects().length;
      setHasObjects(objectsCount > 0);
    } catch (err) {
      console.error('History save error:', err);
    }
  }, [setUndoRedoState, setHasObjects]);

  // Undo function
  const undo = useCallback(async () => {
    if (!canvasRef.current || historyIndexRef.current <= 0) return;
    isUndoRedoActionRef.current = true;
    historyIndexRef.current -= 1;
    const targetState = historyRef.current[historyIndexRef.current];
    if (targetState) {
      await canvasRef.current.loadFromJSON(JSON.parse(targetState));
      canvasRef.current.requestRenderAll();
      setUndoRedoState(
        historyIndexRef.current > 0,
        historyIndexRef.current < historyRef.current.length - 1
      );
      setHasObjects(canvasRef.current.getObjects().length > 0);
    }
    isUndoRedoActionRef.current = false;
  }, [setUndoRedoState, setHasObjects]);

  // Redo function
  const redo = useCallback(async () => {
    if (!canvasRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;
    isUndoRedoActionRef.current = true;
    historyIndexRef.current += 1;
    const targetState = historyRef.current[historyIndexRef.current];
    if (targetState) {
      await canvasRef.current.loadFromJSON(JSON.parse(targetState));
      canvasRef.current.requestRenderAll();
      setUndoRedoState(
        historyIndexRef.current > 0,
        historyIndexRef.current < historyRef.current.length - 1
      );
      setHasObjects(canvasRef.current.getObjects().length > 0);
    }
    isUndoRedoActionRef.current = false;
  }, [setUndoRedoState, setHasObjects]);

  // Initialize Canvas
  useEffect(() => {
    if (!containerRef.current) return;

    // Create the canvas element inside the container
    const canvasEl = document.createElement('canvas');
    canvasElementRef.current = canvasEl;
    containerRef.current.appendChild(canvasEl);

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    const canvas = new Canvas(canvasEl, {
      width,
      height,
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
    });
    canvasRef.current = canvas;

    // Initial brush setup
    const brush = new PencilBrush(canvas);
    brush.color = selectedStroke;
    brush.width = strokeWidth;
    canvas.freeDrawingBrush = brush;

    // Save initial blank state
    saveHistory();

    // Setup mouse wheel zoom (centered on pointer)
    const handleMouseWheel = (opt: TPointerEventInfo<WheelEvent>) => {
      const e = opt.e;
      const delta = e.deltaY;
      let currentZoom = canvas.getZoom();
      currentZoom *= 0.999 ** delta;
      if (currentZoom > 5) currentZoom = 5;
      if (currentZoom < 0.1) currentZoom = 0.1;

      const point = new Point(e.offsetX, e.offsetY);
      canvas.zoomToPoint(point, currentZoom);
      setZoom(Math.round(currentZoom * 100) / 100);
      e.preventDefault();
      e.stopPropagation();
    };

    // Pan handling
    const handleMouseDown = (opt: TPointerEventInfo<MouseEvent>) => {
      const e = opt.e;
      // Space + click or middle-click or Hand tool triggers panning
      if (isSpacePressedRef.current || e.button === 1 || activeTool === 'hand') {
        isPanningRef.current = true;
        canvas.selection = false;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        canvas.defaultCursor = 'grabbing';
        canvas.setCursor('grabbing');
      }
    };

    const handleMouseMove = (opt: TPointerEventInfo<MouseEvent>) => {
      if (isPanningRef.current) {
        const e = opt.e;
        const deltaX = e.clientX - lastPanPosRef.current.x;
        const deltaY = e.clientY - lastPanPosRef.current.y;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        canvas.relativePan(new Point(deltaX, deltaY));
      }
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.selection = activeTool === 'select';
        canvas.defaultCursor = activeTool === 'hand' ? 'grab' : 'default';
        canvas.setCursor(canvas.defaultCursor);
      }
    };

    // Selection changes
    const updateSelectionState = () => {
      const activeObj = canvas.getActiveObject();
      if (!activeObj) {
        setSelectedObject(null);
        return;
      }
      const bound = activeObj.getBoundingRect();
      setSelectedObject({
        id: (activeObj as any).id,
        type: activeObj.type,
        fill: (activeObj.get('fill') as string) || '#ffffff',
        stroke: (activeObj.get('stroke') as string) || '#6366f1',
        strokeWidth: (activeObj.get('strokeWidth') as number) || 2,
        opacity: activeObj.get('opacity') || 1,
        left: bound.left + bound.width / 2,
        top: bound.top,
        width: bound.width,
        height: bound.height,
      });
    };

    canvas.on('mouse:wheel', handleMouseWheel);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('selection:created', updateSelectionState);
    canvas.on('selection:updated', updateSelectionState);
    canvas.on('selection:cleared', () => setSelectedObject(null));
    canvas.on('object:modified', saveHistory);
    canvas.on('object:added', () => {
      setHasObjects(canvas.getObjects().length > 0);
    });
    canvas.on('object:removed', () => {
      setHasObjects(canvas.getObjects().length > 0);
      setSelectedObject(null);
    });

    // Resize observer for responsive window resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          canvas.setDimensions({ width: w, height: h });
          canvas.requestRenderAll();
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Keyboard Spacebar listener for temporary pan toggle
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressedRef.current && (e.target as HTMLElement).tagName !== 'INPUT') {
        isSpacePressedRef.current = true;
        canvas.defaultCursor = 'grab';
        canvas.setCursor('grab');
      }
      // Undo: Ctrl+Z / Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') || 
          ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redo();
      }
      // Delete / Backspace: Remove selected object
      if ((e.key === 'Delete' || e.key === 'Backspace') && (e.target as HTMLElement).tagName !== 'INPUT') {
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          canvas.remove(activeObj);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          saveHistory();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        canvas.defaultCursor = activeTool === 'hand' ? 'grab' : 'default';
        canvas.setCursor(canvas.defaultCursor);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      resizeObserver.disconnect();
      canvas.dispose();
      canvasRef.current = null;
      if (canvasEl.parentNode) {
        canvasEl.parentNode.removeChild(canvasEl);
      }
    };
  }, []); // Run once on mount

  // Sync tool mode changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeTool === 'pencil') {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = selectedStroke;
        canvas.freeDrawingBrush.width = strokeWidth;
      }
    } else {
      canvas.isDrawingMode = false;
    }

    if (activeTool === 'hand') {
      canvas.selection = false;
      canvas.defaultCursor = 'grab';
      canvas.setCursor('grab');
    } else {
      canvas.selection = activeTool === 'select';
      canvas.defaultCursor = activeTool === 'pencil' ? 'crosshair' : 'default';
      canvas.setCursor(canvas.defaultCursor);
    }
  }, [activeTool, selectedStroke, strokeWidth]);

  // Center coordinate calculator for newly added shapes
  const getCanvasCenter = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 400, y: 300 };
    const zoomVal = canvas.getZoom();
    const vpt = canvas.viewportTransform;
    const x = (-vpt[4] + canvas.getWidth() / 2) / zoomVal;
    const y = (-vpt[5] + canvas.getHeight() / 2) / zoomVal;
    return { x, y };
  }, []);

  // Creation Utilities
  const addRectangle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCenter();
    const rect = new Rect({
      id: nanoid(8),
      left: x - 90,
      top: y - 55,
      width: 180,
      height: 110,
      fill: selectedFill,
      stroke: selectedStroke,
      strokeWidth: strokeWidth,
      rx: 10,
      ry: 10,
      shadow: {
        color: 'rgba(0,0,0,0.15)',
        blur: 12,
        offsetX: 0,
        offsetY: 4
      }
    } as any);
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.requestRenderAll();
    saveHistory();
    setActiveTool('select');
  }, [selectedFill, selectedStroke, strokeWidth, getCanvasCenter, saveHistory, setActiveTool]);

  const addCircle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCenter();
    const circle = new Circle({
      id: nanoid(8),
      left: x - 65,
      top: y - 65,
      radius: 65,
      fill: selectedFill,
      stroke: selectedStroke,
      strokeWidth: strokeWidth,
      shadow: {
        color: 'rgba(0,0,0,0.15)',
        blur: 12,
        offsetX: 0,
        offsetY: 4
      }
    } as any);
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.requestRenderAll();
    saveHistory();
    setActiveTool('select');
  }, [selectedFill, selectedStroke, strokeWidth, getCanvasCenter, saveHistory, setActiveTool]);

  const addDiamond = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCenter();
    const size = 130;
    const points = [
      { x: size / 2, y: 0 },
      { x: size, y: size / 2 },
      { x: size / 2, y: size },
      { x: 0, y: size / 2 }
    ];
    const diamond = new Polygon(points, {
      id: nanoid(8),
      left: x - size / 2,
      top: y - size / 2,
      fill: selectedFill,
      stroke: selectedStroke,
      strokeWidth: strokeWidth,
      shadow: {
        color: 'rgba(0,0,0,0.15)',
        blur: 12,
        offsetX: 0,
        offsetY: 4
      }
    } as any);
    canvas.add(diamond);
    canvas.setActiveObject(diamond);
    canvas.requestRenderAll();
    saveHistory();
    setActiveTool('select');
  }, [selectedFill, selectedStroke, strokeWidth, getCanvasCenter, saveHistory, setActiveTool]);

  const addStickyNote = useCallback((initialText = 'Idea or task...') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCenter();
    const width = 170;
    const height = 170;

    const background = new Rect({
      width,
      height,
      fill: selectedFill === '#ffffff' ? '#fef08a' : selectedFill,
      rx: 6,
      ry: 6,
      shadow: {
        color: 'rgba(0,0,0,0.2)',
        blur: 16,
        offsetX: 0,
        offsetY: 8
      }
    });

    const textbox = new Textbox(initialText, {
      left: 14,
      top: 14,
      width: width - 28,
      fontSize: 15,
      fontFamily: 'Plus Jakarta Sans',
      fill: '#1e293b',
      editable: true,
      cursorColor: '#6366f1'
    });

    const stickyGroup = new Group([background, textbox], {
      id: nanoid(8),
      left: x - width / 2,
      top: y - height / 2,
      subTargetCheck: true,
    } as any);

    canvas.add(stickyGroup);
    canvas.setActiveObject(stickyGroup);
    canvas.requestRenderAll();
    saveHistory();
    setActiveTool('select');
  }, [selectedFill, getCanvasCenter, saveHistory, setActiveTool]);

  const addText = useCallback((initialText = 'Type something...') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCenter();
    const textbox = new Textbox(initialText, {
      id: nanoid(8),
      left: x - 100,
      top: y - 20,
      width: 200,
      fontSize: 18,
      fontFamily: 'Plus Jakarta Sans',
      fill: '#f8fafc',
      editable: true,
      cursorColor: '#6366f1',
    } as any);
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();
    saveHistory();
    setActiveTool('select');
  }, [getCanvasCenter, saveHistory, setActiveTool]);

  const addArrow = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCenter();
    const line = new Line([x - 80, y, x + 80, y], {
      id: nanoid(8),
      stroke: selectedStroke,
      strokeWidth: strokeWidth + 1,
      hasControls: true,
    } as any);
    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.requestRenderAll();
    saveHistory();
    setActiveTool('select');
  }, [selectedStroke, strokeWidth, getCanvasCenter, saveHistory, setActiveTool]);

  // Contextual actions
  const changeSelectedFill = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      if (active.type === 'group') {
        const bg = (active as Group).getObjects()[0];
        if (bg) bg.set('fill', color);
      } else {
        active.set('fill', color);
      }
      canvas.requestRenderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const changeSelectedStroke = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      active.set('stroke', color);
      canvas.requestRenderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const duplicateSelected = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    const cloned = await active.clone();
    cloned.set({
      id: nanoid(8),
      left: active.left + 24,
      top: active.top + 24,
    } as any);
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    saveHistory();
  }, [saveHistory]);

  // Viewport zoom helpers
  const zoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let nextZoom = canvas.getZoom() * 1.2;
    if (nextZoom > 5) nextZoom = 5;
    const center = canvas.getCenterPoint();
    canvas.zoomToPoint(new Point(center.x, center.y), nextZoom);
    setZoom(Math.round(nextZoom * 100) / 100);
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let nextZoom = canvas.getZoom() / 1.2;
    if (nextZoom < 0.1) nextZoom = 0.1;
    const center = canvas.getCenterPoint();
    canvas.zoomToPoint(new Point(center.x, center.y), nextZoom);
    setZoom(Math.round(nextZoom * 100) / 100);
  }, [setZoom]);

  const resetZoom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    canvas.requestRenderAll();
  }, [setZoom]);

  // High-Resolution PNG Export
  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL({
      format: 'png',
      multiplier: 2, // 2x retina crispness
    });
    const link = document.createElement('a');
    link.download = `collabspace-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  }, []);

  // Lossless JSON Export
  const exportJSON = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const jsonStr = JSON.stringify(canvas.toJSON());
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `collabspace-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    canvasRef,
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
    exportJSON,
  };
}
