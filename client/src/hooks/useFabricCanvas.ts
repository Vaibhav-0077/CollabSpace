import { useEffect, useRef, useCallback, useState } from 'react';
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
  TPointerEventInfo,
  util
} from 'fabric';
import { useCanvasStore } from '../store/canvasStore';
import { socketService } from '../services/socketService';
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
  const [canvasVpt, setCanvasVpt] = useState<number[]>([1, 0, 0, 1, 0, 0]);

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
    setHasObjects,
    boardId,
    nickname,
    userColor,
  } = useCanvasStore();

  // History stack for Undo/Redo
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoActionRef = useRef<boolean>(false);

  // Guard against echo loops when receiving remote changes
  const isRemoteMutationRef = useRef<boolean>(false);
  const cursorThrottleRef = useRef<number>(0);
  const transformThrottleRef = useRef<number>(0);
  const currentLockedIdRef = useRef<string | null>(null);

  // Panning state
  const isPanningRef = useRef<boolean>(false);
  const lastPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef<boolean>(false);

  // Helper to record history snapshot
  const saveHistory = useCallback(() => {
    if (!canvasRef.current || isUndoRedoActionRef.current || isRemoteMutationRef.current) return;
    try {
      const json = JSON.stringify(canvasRef.current.toJSON());
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

  // Connect Socket.IO on mount
  useEffect(() => {
    socketService.connect(boardId, nickname, userColor);

    return () => {
      socketService.disconnect();
    };
  }, [boardId, nickname, userColor]);

  // Initialize Canvas
  useEffect(() => {
    if (!containerRef.current) return;

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

    saveHistory();

    // Mouse wheel zoom
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
      setCanvasVpt([...canvas.viewportTransform]);
      e.preventDefault();
      e.stopPropagation();
    };

    // Pan handling
    const handleMouseDown = (opt: TPointerEventInfo<MouseEvent>) => {
      const e = opt.e;
      if (isSpacePressedRef.current || e.button === 1 || activeTool === 'hand') {
        isPanningRef.current = true;
        canvas.selection = false;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        canvas.defaultCursor = 'grabbing';
        canvas.setCursor('grabbing');
      }
    };

    const handleMouseMove = (opt: TPointerEventInfo<MouseEvent>) => {
      // 1. Pan movement
      if (isPanningRef.current) {
        const e = opt.e;
        const deltaX = e.clientX - lastPanPosRef.current.x;
        const deltaY = e.clientY - lastPanPosRef.current.y;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        canvas.relativePan(new Point(deltaX, deltaY));
        setCanvasVpt([...canvas.viewportTransform]);
      }

      // 2. Throttled Real-Time Cursor streaming (world coordinates)
      const now = Date.now();
      if (now - cursorThrottleRef.current > 30) {
        const point = canvas.getScenePoint ? canvas.getScenePoint(opt.e) : (canvas as any).getPointer(opt.e);
        if (point) {
          socketService.emitCursorMove(Math.round(point.x), Math.round(point.y));
          cursorThrottleRef.current = now;
        }
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

    // Selection changes & Ephemeral Locks
    const updateSelectionState = () => {
      const activeObj = canvas.getActiveObject();
      if (!activeObj) {
        if (currentLockedIdRef.current) {
          socketService.emitObjectUnlock(currentLockedIdRef.current);
          currentLockedIdRef.current = null;
        }
        setSelectedObject(null);
        return;
      }

      const objId = (activeObj as any).id;
      if (objId && objId !== currentLockedIdRef.current) {
        if (currentLockedIdRef.current) {
          socketService.emitObjectUnlock(currentLockedIdRef.current);
        }
        currentLockedIdRef.current = objId;
        socketService.emitObjectLock(objId);
      }

      const bound = activeObj.getBoundingRect();
      setSelectedObject({
        id: objId,
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

    // Moving event (relay live transform to collaborators)
    const handleObjectMoving = (opt: any) => {
      const obj = opt.target;
      if (!obj || isRemoteMutationRef.current) return;

      const now = Date.now();
      if (now - transformThrottleRef.current > 30) {
        socketService.emitObjectTransforming({
          id: obj.id,
          left: Math.round(obj.left),
          top: Math.round(obj.top),
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: Math.round(obj.angle),
        });
        transformThrottleRef.current = now;
      }
    };

    canvas.on('mouse:wheel', handleMouseWheel);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('object:moving', handleObjectMoving);
    canvas.on('selection:created', updateSelectionState);
    canvas.on('selection:updated', updateSelectionState);
    canvas.on('selection:cleared', () => {
      if (currentLockedIdRef.current) {
        socketService.emitObjectUnlock(currentLockedIdRef.current);
        currentLockedIdRef.current = null;
      }
      setSelectedObject(null);
    });

    // Object mutation sync
    canvas.on('object:modified', (e) => {
      saveHistory();
      if (!isRemoteMutationRef.current && e.target) {
        const serialized = e.target.toObject(['id', 'name', 'shadow', 'rx', 'ry']);
        socketService.emitObjectModified(serialized);
      }
    });

    canvas.on('object:added', (e) => {
      setHasObjects(canvas.getObjects().length > 0);
      if (!isRemoteMutationRef.current && e.target && (e.target as any).id) {
        const serialized = e.target.toObject(['id', 'name', 'shadow', 'rx', 'ry']);
        socketService.emitObjectAdded(serialized);
      }
    });

    canvas.on('object:removed', (e) => {
      setHasObjects(canvas.getObjects().length > 0);
      setSelectedObject(null);
      if (!isRemoteMutationRef.current && e.target && (e.target as any).id) {
        socketService.emitObjectRemoved((e.target as any).id);
      }
    });

    // Register Remote Event Handlers from Socket Service
    socketService.onRemoteObjectTransforming = (data) => {
      const target = canvas.getObjects().find((o: any) => o.id === data.id);
      if (target) {
        isRemoteMutationRef.current = true;
        target.set({
          left: data.left,
          top: data.top,
          ...(data.scaleX ? { scaleX: data.scaleX } : {}),
          ...(data.scaleY ? { scaleY: data.scaleY } : {}),
          ...(data.angle !== undefined ? { angle: data.angle } : {}),
        });
        target.setCoords();
        canvas.requestRenderAll();
        isRemoteMutationRef.current = false;
      }
    };

    socketService.onRemoteObjectModified = async (objData) => {
      const existing = canvas.getObjects().find((o: any) => o.id === objData.id);
      isRemoteMutationRef.current = true;
      if (existing) {
        existing.set(objData);
        existing.setCoords();
      } else {
        const [enlivened] = await util.enlivenObjects([objData]);
        if (enlivened) {
          canvas.add(enlivened as FabricObject);
        }
      }
      canvas.requestRenderAll();
      isRemoteMutationRef.current = false;
      setHasObjects(canvas.getObjects().length > 0);
    };

    socketService.onRemoteObjectAdded = async (objData) => {
      const existing = canvas.getObjects().find((o: any) => o.id === objData.id);
      if (existing) return;
      isRemoteMutationRef.current = true;
      const [enlivened] = await util.enlivenObjects([objData]);
      if (enlivened) {
        canvas.add(enlivened as FabricObject);
        canvas.requestRenderAll();
      }
      isRemoteMutationRef.current = false;
      setHasObjects(canvas.getObjects().length > 0);
    };

    socketService.onRemoteObjectRemoved = (id) => {
      const target = canvas.getObjects().find((o: any) => o.id === id);
      if (target) {
        isRemoteMutationRef.current = true;
        canvas.remove(target);
        canvas.requestRenderAll();
        isRemoteMutationRef.current = false;
        setHasObjects(canvas.getObjects().length > 0);
      }
    };

    socketService.onRoomInitialized = async (objects) => {
      if (!objects || Object.keys(objects).length === 0) return;
      isRemoteMutationRef.current = true;
      const list = Object.values(objects);
      const enlivened = await util.enlivenObjects(list);
      enlivened.forEach((item) => {
        canvas.add(item as FabricObject);
      });
      canvas.requestRenderAll();
      isRemoteMutationRef.current = false;
      setHasObjects(canvas.getObjects().length > 0);
    };

    // Resize observer
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

    // Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressedRef.current && (e.target as HTMLElement).tagName !== 'INPUT') {
        isSpacePressedRef.current = true;
        canvas.defaultCursor = 'grab';
        canvas.setCursor('grab');
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') || 
          ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redo();
      }
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
  }, []);

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
      socketService.emitObjectModified(active.toObject(['id', 'name', 'shadow', 'rx', 'ry']));
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
      socketService.emitObjectModified(active.toObject(['id', 'name', 'shadow', 'rx', 'ry']));
    }
  }, [saveHistory]);

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      const objId = (active as any).id;
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      saveHistory();
      if (objId) {
        socketService.emitObjectRemoved(objId);
      }
    }
  }, [saveHistory]);

  const duplicateSelected = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    const cloned = await active.clone();
    const newId = nanoid(8);
    cloned.set({
      id: newId,
      left: active.left + 24,
      top: active.top + 24,
    } as any);
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    saveHistory();
    socketService.emitObjectAdded(cloned.toObject(['id', 'name', 'shadow', 'rx', 'ry']));
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
    setCanvasVpt([...canvas.viewportTransform]);
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let nextZoom = canvas.getZoom() / 1.2;
    if (nextZoom < 0.1) nextZoom = 0.1;
    const center = canvas.getCenterPoint();
    canvas.zoomToPoint(new Point(center.x, center.y), nextZoom);
    setZoom(Math.round(nextZoom * 100) / 100);
    setCanvasVpt([...canvas.viewportTransform]);
  }, [setZoom]);

  const resetZoom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    setCanvasVpt([1, 0, 0, 1, 0, 0]);
    canvas.requestRenderAll();
  }, [setZoom]);

  // High-Resolution PNG Export
  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL({
      format: 'png',
      multiplier: 2,
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
    exportJSON,
  };
}
