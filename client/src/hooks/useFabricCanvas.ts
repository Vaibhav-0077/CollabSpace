import { useEffect, useRef, useCallback, useState } from 'react';
import { 
  Canvas, 
  Rect, 
  Circle, 
  Polygon, 
  Textbox, 
  Group, 
  Line,
  Point, 
  PencilBrush, 
  FabricObject,
  Shadow,
  type TPointerEventInfo,
  util,
  FabricImage
} from 'fabric';
import { useCanvasStore } from '../store/canvasStore';
import { socketService } from '../services/socketService';
import { nanoid } from 'nanoid';
import { handleObjectSnapping, clearGuidelines } from '../utils/snapping';
import { 
  createSmartConnector, 
  updateAttachedConnectors, 
  findNearestAnchor, 
  findHoveredShape,
  showShapeAnchorPoints,
  clearAnchorPoints,
  attachArrowHead,
  getShapeAnchors,
  type AnchorType 
} from '../utils/connectors';
import { tidyUpCanvasObjects } from '../utils/tidyUp';
import { emitLocalLaserPoint } from '../components/collaboration/LaserOverlay';

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
    setStrokeWidth,
    setZoom,
    setActiveTool,
    setUndoRedoState,
    setSelectedObject,
    setHasObjects,
    boardId,
    boardTitle,
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

  // Active tool & drawing style refs for fresh access inside event callbacks
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const selectedFillRef = useRef(selectedFill);
  selectedFillRef.current = selectedFill;
  const selectedStrokeRef = useRef(selectedStroke);
  selectedStrokeRef.current = selectedStroke;
  const strokeWidthRef = useRef(strokeWidth);
  strokeWidthRef.current = strokeWidth;

  // Interactive Drag-to-Create Shape Refs (Excalidraw UX)
  const isDrawingShapeRef = useRef<boolean>(false);
  const shapeStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentDrawingObjectRef = useRef<FabricObject | null>(null);
  const updateSelectionStateRef = useRef<() => void>(() => {});
  const fitToContentRef = useRef<() => void>(() => {});
  const resetZoomRef = useRef<() => void>(() => {});
  const lastMouseScenePointRef = useRef<{ x: number; y: number } | null>(null);
  const addImageFromURLRef = useRef<(dataUrl: string, x?: number, y?: number) => Promise<void>>(async () => {});

  // Laser Pointer & Spotlight State
  const isLaserActiveRef = useRef<boolean>(false);
  const laserThrottleRef = useRef<number>(0);

  // "Follow Me" Viewport Synchronizer
  const viewportBroadcastThrottleRef = useRef<number>(0);

  const breakFollowMode = useCallback(() => {
    if (useCanvasStore.getState().followingSocketId !== null) {
      useCanvasStore.getState().setFollowingSocketId(null);
    }
  }, []);
  const breakFollowModeRef = useRef(breakFollowMode);
  breakFollowModeRef.current = breakFollowMode;

  const broadcastViewport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const now = Date.now();
    if (now - viewportBroadcastThrottleRef.current < 40) return;
    viewportBroadcastThrottleRef.current = now;

    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const sceneCenterX = (canvas.getWidth() / 2 - vpt[4]) / zoom;
    const sceneCenterY = (canvas.getHeight() / 2 - vpt[5]) / zoom;

    socketService.emitViewportMove(
      Math.round(sceneCenterX * 10) / 10,
      Math.round(sceneCenterY * 10) / 10,
      Math.round(zoom * 1000) / 1000
    );
  }, []);
  const broadcastViewportRef = useRef(broadcastViewport);
  broadcastViewportRef.current = broadcastViewport;

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
      fireMiddleClick: true,
    });
    canvasRef.current = canvas;

    // Initial brush setup
    const brush = new PencilBrush(canvas);
    brush.color = selectedStroke;
    brush.width = strokeWidth;
    canvas.freeDrawingBrush = brush;

    saveHistory();

    // Mouse wheel: Page Scroll (Vertical & Horizontal) + Pinch/Ctrl-Zoom
    const handleMouseWheel = (opt: TPointerEventInfo<WheelEvent>) => {
      const e = opt.e;
      e.preventDefault();
      e.stopPropagation();

      breakFollowModeRef.current();

      // Zoom when Ctrl / Meta is pressed (or trackpad pinch gesture)
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY;
        let currentZoom = canvas.getZoom();
        currentZoom *= 0.999 ** delta;
        if (currentZoom > 5) currentZoom = 5;
        if (currentZoom < 0.1) currentZoom = 0.1;

        const point = new Point(e.offsetX, e.offsetY);
        canvas.zoomToPoint(point, currentZoom);
        setZoom(Math.round(currentZoom * 100) / 100);
        setCanvasVpt([...canvas.viewportTransform]);
        broadcastViewportRef.current();
        if (canvas.getActiveObject()) {
          updateSelectionStateRef.current();
        }
        return;
      }

      // Normal Page Scroll
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.shiftKey && Math.abs(dx) < Math.abs(dy)) {
        dx = dy;
        dy = 0;
      }

      canvas.relativePan(new Point(-dx, -dy));
      setCanvasVpt([...canvas.viewportTransform]);
      broadcastViewportRef.current();
      if (canvas.getActiveObject()) {
        updateSelectionStateRef.current();
      }
    };

    // Pan handling
    // 1. Mouse Down: Pan or start interactive shape swipe/drag
    const handleMouseDown = (opt: any) => {
      const e = opt.e;
      if (isSpacePressedRef.current || e.button === 1 || activeToolRef.current === 'hand') {
        breakFollowModeRef.current();
        isPanningRef.current = true;
        canvas.selection = false;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        canvas.defaultCursor = 'grabbing';
        canvas.setCursor('grabbing');
        return;
      }

      if (e.button !== 0) return; // Left mouse button only

      const currentTool = activeToolRef.current;
      const point = canvas.getScenePoint ? canvas.getScenePoint(opt.e) : (canvas as any).getPointer(opt.e);
      if (!point) return;

      // Laser Pointer / Spotlight Tool: Click to pulse or start drawing glowing presentation beam
      if (currentTool === 'laser') {
        isLaserActiveRef.current = true;
        const color = userColor || '#ef4444';
        emitLocalLaserPoint(point.x, point.y, color);
        socketService.emitLaserPointer(Math.round(point.x), Math.round(point.y), color);
        return;
      }

      // Excalidraw Text Tool: Click to place black editable text directly at point
      if (currentTool === 'text') {
        const textbox = new Textbox('Text', {
          id: nanoid(8),
          left: point.x,
          top: point.y,
          width: 140,
          fontSize: 18,
          fontFamily: 'Plus Jakarta Sans',
          fill: '#1e293b', // Black text by default
          editable: true,
          cursorColor: '#6366f1',
        } as any);
        canvas.add(textbox);
        canvas.setActiveObject(textbox);
        textbox.enterEditing();
        textbox.selectAll();
        canvas.requestRenderAll();
        saveHistory();
        socketService.emitObjectAdded((textbox as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
        setActiveTool('select');
        return;
      }

      // Excalidraw Shape Drawing: Click on screen & swipe/drag to create
      if (['rectangle', 'circle', 'diamond', 'sticky', 'arrow'].includes(currentTool)) {
        isDrawingShapeRef.current = true;
        shapeStartPointRef.current = { x: point.x, y: point.y };

        const fill = selectedFillRef.current; // 'transparent' by default
        const stroke = selectedStrokeRef.current; // '#1e293b' black by default
        const width = strokeWidthRef.current || 2;

        let shape: FabricObject | null = null;
        if (currentTool === 'rectangle') {
          shape = new Rect({
            id: nanoid(8),
            left: point.x,
            top: point.y,
            width: 1,
            height: 1,
            fill: fill,
            stroke: stroke,
            strokeWidth: width,
            rx: 6,
            ry: 6,
            strokeUniform: true,
            selectable: false,
            evented: false,
          } as any);
        } else if (currentTool === 'circle') {
          shape = new Circle({
            id: nanoid(8),
            left: point.x,
            top: point.y,
            radius: 1,
            fill: fill,
            stroke: stroke,
            strokeWidth: width,
            strokeUniform: true,
            selectable: false,
            evented: false,
          } as any);
        } else if (currentTool === 'diamond') {
          shape = new Polygon(
            [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
              { x: 0, y: 0 },
              { x: 0, y: 0 },
            ],
            {
              id: nanoid(8),
              left: point.x,
              top: point.y,
              fill: fill,
              stroke: stroke,
              strokeWidth: width,
              strokeUniform: true,
              selectable: false,
              evented: false,
            } as any
          );
        } else if (currentTool === 'sticky') {
          shape = new Rect({
            id: nanoid(8),
            left: point.x,
            top: point.y,
            width: 1,
            height: 1,
            fill: fill === 'transparent' ? '#fef08a' : fill,
            stroke: '#eab308',
            strokeWidth: 1,
            rx: 6,
            ry: 6,
            selectable: false,
            evented: false,
          } as any);
        } else if (currentTool === 'arrow') {
          const nearStart = findNearestAnchor(point.x, point.y, canvas);
          let startX = point.x;
          let startY = point.y;
          let fromId: string | undefined;
          let fromAnchor: AnchorType | undefined;
          if (nearStart) {
            startX = nearStart.anchor.x;
            startY = nearStart.anchor.y;
            fromId = nearStart.shapeId;
            fromAnchor = nearStart.anchor.type;
          }
          shape = createSmartConnector({
            x1: startX,
            y1: startY,
            x2: startX,
            y2: startY,
            fromId,
            fromAnchor,
            stroke: stroke,
            strokeWidth: width + 1,
            isCurved: false,
          });
          shape.set({ selectable: false, evented: false });
        }

        if (shape) {
          canvas.add(shape);
          currentDrawingObjectRef.current = shape;
          canvas.requestRenderAll();
        }
      }
    };

    // 2. Mouse Move: Pan, drag-resize shape ("swipe"), and cursor broadcast
    const handleMouseMove = (opt: any) => {
      // Pan movement
      if (isPanningRef.current) {
        breakFollowModeRef.current();
        const e = opt.e;
        const deltaX = e.clientX - lastPanPosRef.current.x;
        const deltaY = e.clientY - lastPanPosRef.current.y;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        canvas.relativePan(new Point(deltaX, deltaY));
        setCanvasVpt([...canvas.viewportTransform]);
        broadcastViewportRef.current();
        if (canvas.getActiveObject()) {
          updateSelectionStateRef.current();
        }
      }

      // Interactive Shape Drag Sizing ("Swipe screen to size shape")
      if (isDrawingShapeRef.current && currentDrawingObjectRef.current && shapeStartPointRef.current) {
        const point = canvas.getScenePoint ? canvas.getScenePoint(opt.e) : (canvas as any).getPointer(opt.e);
        if (point) {
          const start = shapeStartPointRef.current;
          const currentObj = currentDrawingObjectRef.current;
          const tool = activeToolRef.current;

          const left = Math.min(start.x, point.x);
          const top = Math.min(start.y, point.y);
          const w = Math.max(2, Math.abs(point.x - start.x));
          const h = Math.max(2, Math.abs(point.y - start.y));

          if (tool === 'rectangle' || tool === 'sticky') {
            currentObj.set({ left, top, width: w, height: h });
          } else if (tool === 'circle') {
            const radius = Math.max(w, h) / 2;
            currentObj.set({ left, top, radius });
          } else if (tool === 'diamond') {
            const pts = [
              { x: w / 2, y: 0 },
              { x: w, y: h / 2 },
              { x: w / 2, y: h },
              { x: 0, y: h / 2 },
            ];
            (currentObj as any).set({ left, top, width: w, height: h, points: pts });
          } else if (tool === 'arrow') {
            const near = findNearestAnchor(point.x, point.y, canvas, (currentObj as any).fromId);
            if (near) {
              const targetShape = canvas.getObjects().find((o: any) => o.id === near.shapeId);
              if (targetShape) showShapeAnchorPoints(targetShape, canvas, near.anchor.type);
              (currentObj as Line).set({ x1: start.x, y1: start.y, x2: near.anchor.x, y2: near.anchor.y });
              (currentObj as any).toId = near.shapeId;
              (currentObj as any).toAnchor = near.anchor.type;
            } else {
              (currentObj as Line).set({ x1: start.x, y1: start.y, x2: point.x, y2: point.y });
              (currentObj as any).toId = undefined;
              (currentObj as any).toAnchor = undefined;
              const hovered = findHoveredShape(point.x, point.y, canvas, (currentObj as any).fromId);
              if (hovered) {
                showShapeAnchorPoints(hovered, canvas);
              } else {
                clearAnchorPoints(canvas);
              }
            }
          }

          currentObj.setCoords();
          canvas.requestRenderAll();
        }
      }

      // Track mouse scene coordinate for clipboard paste & cursor broadcast
      const currentPoint = canvas.getScenePoint ? canvas.getScenePoint(opt.e) : (canvas as any).getPointer(opt.e);
      if (currentPoint) {
        lastMouseScenePointRef.current = { x: currentPoint.x, y: currentPoint.y };
      }

      // Throttled Real-Time Cursor streaming (world coordinates)
      const now = Date.now();
      if (now - cursorThrottleRef.current > 30) {
        if (currentPoint) {
          socketService.emitCursorMove(Math.round(currentPoint.x), Math.round(currentPoint.y));
          cursorThrottleRef.current = now;
        }
      }

      // Stream glowing laser pointer points when laser tool is actively drawn
      if (activeToolRef.current === 'laser' && currentPoint) {
        if (isLaserActiveRef.current && now - laserThrottleRef.current > 16) {
          laserThrottleRef.current = now;
          const color = userColor || '#ef4444';
          emitLocalLaserPoint(currentPoint.x, currentPoint.y, color);
          socketService.emitLaserPointer(Math.round(currentPoint.x), Math.round(currentPoint.y), color);
        }
      }
    };

    // 3. Mouse Up: Commit created shape, make selectable, and switch to select tool
    const handleMouseUp = () => {
      clearGuidelines(canvas);
      clearAnchorPoints(canvas);
      if (activeToolRef.current === 'laser') {
        isLaserActiveRef.current = false;
      }
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.selection = activeToolRef.current === 'select';
        canvas.defaultCursor = activeToolRef.current === 'hand' ? 'grab' : 'default';
        canvas.setCursor(canvas.defaultCursor);
      }

      // Finalize interactive shape creation
      if (isDrawingShapeRef.current && currentDrawingObjectRef.current && shapeStartPointRef.current) {
        const currentObj = currentDrawingObjectRef.current;
        const start = shapeStartPointRef.current;
        const tool = activeToolRef.current;

        const bound = currentObj.getBoundingRect();
        const isJustClick =
          tool !== 'arrow'
            ? bound.width < 12 || bound.height < 12
            : Math.hypot((currentObj as any).x2 - (currentObj as any).x1, (currentObj as any).y2 - (currentObj as any).y1) < 12;

        if (isJustClick) {
          if (tool === 'rectangle') {
            currentObj.set({ left: start.x, top: start.y, width: 140, height: 90 });
          } else if (tool === 'circle') {
            currentObj.set({ left: start.x, top: start.y, radius: 45 });
          } else if (tool === 'diamond') {
            const size = 110;
            const pts = [
              { x: size / 2, y: 0 },
              { x: size, y: size / 2 },
              { x: size / 2, y: size },
              { x: 0, y: size / 2 },
            ];
            (currentObj as any).set({ left: start.x, top: start.y, width: size, height: size, points: pts });
          } else if (tool === 'sticky') {
            currentObj.set({ left: start.x, top: start.y, width: 160, height: 160 });
          } else if (tool === 'arrow') {
            (currentObj as Line).set({ x1: start.x, y1: start.y, x2: start.x + 130, y2: start.y });
          }
        }

        currentObj.set({ selectable: true, evented: true });
        currentObj.setCoords();

        if (tool === 'sticky') {
          const finalLeft = currentObj.left;
          const finalTop = currentObj.top;
          const finalWidth = (currentObj as any).width || 160;
          const finalHeight = (currentObj as any).height || 160;
          canvas.remove(currentObj);

          const bg = new Rect({
            width: finalWidth,
            height: finalHeight,
            fill: selectedFillRef.current === 'transparent' ? '#fef08a' : selectedFillRef.current,
            rx: 6,
            ry: 6,
            shadow: new Shadow({ color: 'rgba(0,0,0,0.15)', blur: 12, offsetX: 0, offsetY: 4 }),
          });
          const tb = new Textbox('Idea or task...', {
            left: 12,
            top: 12,
            width: finalWidth - 24,
            fontSize: 15,
            fontFamily: 'Plus Jakarta Sans',
            fill: '#1e293b', // Black text
            editable: true,
            cursorColor: '#6366f1',
          });
          const stickyGroup = new Group([bg, tb], {
            id: nanoid(8),
            left: finalLeft,
            top: finalTop,
            subTargetCheck: true,
          } as any);
          canvas.add(stickyGroup);
          canvas.setActiveObject(stickyGroup);
          saveHistory();
          socketService.emitObjectAdded((stickyGroup as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
        } else {
          canvas.setActiveObject(currentObj);
          saveHistory();
          socketService.emitObjectAdded(
            (currentObj as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'strokeDashArray', 'strokeWidth', 'isConnector', 'isCurved', 'curvature', 'arrowhead', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
          );
        }

        canvas.requestRenderAll();
        setHasObjects(canvas.getObjects().length > 0);

        // Reset drawing state & return to select tool (Excalidraw UX)
        isDrawingShapeRef.current = false;
        shapeStartPointRef.current = null;
        currentDrawingObjectRef.current = null;
        setActiveTool('select');
      }
    };

    // 4. Double Click: Add or edit black text directly in shape or on canvas
    const handleDoubleClick = (opt: any) => {
      const target = opt.target;
      const point = canvas.getScenePoint ? canvas.getScenePoint(opt.e) : (canvas as any).getPointer(opt.e);
      if (!point) return;

      if (target && target.type === 'textbox') {
        target.enterEditing();
        return;
      }

      if (target && target.type === 'group') {
        const textInGroup = (target as Group).getObjects().find((o) => o.type === 'textbox');
        if (textInGroup) {
          (textInGroup as Textbox).enterEditing();
          return;
        }
      }

      let posX = point.x - 60;
      let posY = point.y - 12;

      if (target && (target.type === 'rect' || target.type === 'circle' || target.type === 'polygon')) {
        const bound = target.getBoundingRect();
        posX = bound.left + bound.width / 2 - 50;
        posY = bound.top + bound.height / 2 - 12;
      }

      const textbox = new Textbox('', {
        id: nanoid(8),
        left: posX,
        top: posY,
        width: 120,
        fontSize: 16,
        fontFamily: 'Plus Jakarta Sans',
        fill: '#1e293b', // Black text by default
        editable: true,
        cursorColor: '#6366f1',
      } as any);

      canvas.add(textbox);
      canvas.setActiveObject(textbox);
      textbox.enterEditing();
      canvas.requestRenderAll();
      saveHistory();
      socketService.emitObjectAdded((textbox as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
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
      let textObj: Textbox | undefined;
      if (activeObj.type === 'textbox') {
        textObj = activeObj as Textbox;
      } else if (activeObj.type === 'group') {
        textObj = (activeObj as Group).getObjects().find((o) => o.type === 'textbox') as Textbox | undefined;
      }

      let fillVal = activeObj.get('fill') as string;
      let strokeVal = activeObj.get('stroke') as string;
      let strokeWidthVal = activeObj.get('strokeWidth') as number;
      let strokeDashVal = activeObj.get('strokeDashArray') as number[] | null;

      if (activeObj.type === 'group') {
        const bg = (activeObj as Group).getObjects()[0];
        if (bg) {
          fillVal = (bg.get('fill') as string) || fillVal;
          strokeVal = (bg.get('stroke') as string) || strokeVal;
          strokeWidthVal = (bg.get('strokeWidth') as number) ?? strokeWidthVal;
          strokeDashVal = (bg.get('strokeDashArray') as number[] | null) ?? strokeDashVal;
        }
      }

      setSelectedObject({
        id: objId,
        type: activeObj.type,
        fill: fillVal || (activeObj.type === 'textbox' ? '#1e293b' : 'transparent'),
        stroke: strokeVal || '#1e293b',
        strokeWidth: strokeWidthVal ?? 2,
        strokeDashArray: strokeDashVal || null,
        fontSize: textObj ? (textObj.fontSize || 18) : undefined,
        fontFamily: textObj ? (textObj.fontFamily || 'Plus Jakarta Sans') : undefined,
        textAlign: textObj ? (textObj.textAlign || 'left') : undefined,
        isConnector: !!(activeObj as any).isConnector,
        isCurved: !!(activeObj as any).isCurved,
        curvature: (activeObj as any).curvature || 0,
        arrowhead: (activeObj as any).arrowhead || 'end',
        opacity: activeObj.get('opacity') || 1,
        left: bound.left + bound.width / 2,
        top: bound.top,
        width: bound.width,
        height: bound.height,
      });
    };
    updateSelectionStateRef.current = updateSelectionState;

    // Moving event (magnetic snapping, dynamic connectors, and real-time sync)
    const handleObjectMoving = (opt: any) => {
      const obj = opt.target;
      if (!obj || isRemoteMutationRef.current) return;

      // 1. Magnetic Snapping & Alignment Guides
      if (obj.type !== 'line' && !obj.isConnector) {
        const snap = handleObjectSnapping(obj, canvas);
        if (snap.snappedLeft !== undefined) {
          obj.set({ left: snap.snappedLeft });
        }
        if (snap.snappedTop !== undefined) {
          obj.set({ top: snap.snappedTop });
        }
        obj.setCoords();
      }

      // If moving an arrow/connector, show anchor points on hovered shape
      if (obj.isConnector) {
        const bound = obj.getBoundingRect();
        const center = { x: bound.left + bound.width / 2, y: bound.top + bound.height / 2 };
        const hovered = findHoveredShape(center.x, center.y, canvas, obj.id);
        if (hovered) {
          showShapeAnchorPoints(hovered, canvas);
        } else {
          clearAnchorPoints(canvas);
        }
      }

      // 2. Dynamic Connector lines follow shape
      updateAttachedConnectors(obj, canvas);

      // 3. Real-time stream to collaborators
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
    canvas.on('mouse:dblclick', handleDoubleClick);
    canvas.on('object:moving', handleObjectMoving);
    canvas.on('selection:created', updateSelectionState);
    canvas.on('selection:updated', updateSelectionState);
    canvas.on('selection:cleared', () => {
      clearAnchorPoints(canvas);
      if (currentLockedIdRef.current) {
        socketService.emitObjectUnlock(currentLockedIdRef.current);
        currentLockedIdRef.current = null;
      }
      setSelectedObject(null);
    });

    // Object mutation sync
    canvas.on('object:modified', (e) => {
      clearGuidelines(canvas);
      clearAnchorPoints(canvas);
      saveHistory();
      if (!isRemoteMutationRef.current && e.target) {
        const serialized = (e.target as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'strokeDashArray', 'strokeWidth', 'fontSize', 'fontFamily', 'textAlign', 'isConnector', 'isCurved', 'curvature', 'arrowhead', 'fromId', 'toId', 'fromAnchor', 'toAnchor']);
        socketService.emitObjectModified(serialized);

        // Also broadcast updated coordinates for any attached connectors
        const shapeId = (e.target as any).id;
        if (shapeId) {
          const connectors = canvas.getObjects().filter(
            (obj: any) => obj.isConnector && (obj.fromId === shapeId || obj.toId === shapeId)
          );
          connectors.forEach((conn) => {
            socketService.emitObjectModified(
              (conn as any).toObject(['id', 'name', 'isConnector', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
            );
          });
        }
      }
    });

    canvas.on('object:added', (e) => {
      setHasObjects(canvas.getObjects().length > 0);
      if (!isRemoteMutationRef.current && e.target && (e.target as any).id) {
        const serialized = (e.target as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'isConnector', 'fromId', 'toId', 'fromAnchor', 'toAnchor']);
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
        updateAttachedConnectors(target, canvas);
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
        if ((objData as any).isConnector) {
          attachArrowHead(existing as Line);
        }
        updateAttachedConnectors(existing, canvas);
      } else {
        const [enlivened] = await util.enlivenObjects([objData]);
        if (enlivened) {
          if ((objData as any).isConnector) {
            attachArrowHead(enlivened as Line);
          }
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
        if ((objData as any).isConnector) {
          attachArrowHead(enlivened as Line);
        }
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
        if ((item as any).isConnector) {
          attachArrowHead(item as Line);
        }
        canvas.add(item as FabricObject);
      });
      canvas.requestRenderAll();
      isRemoteMutationRef.current = false;
      setHasObjects(canvas.getObjects().length > 0);
    };

    // "Follow Me" Viewport Synchronizer (follows presenter camera seamlessly)
    socketService.onUserViewport = (data) => {
      const currentFollowingId = useCanvasStore.getState().followingSocketId;
      if (currentFollowingId === data.socketId) {
        const targetZoom = data.zoom;
        const screenCenterX = canvas.getWidth() / 2;
        const screenCenterY = canvas.getHeight() / 2;
        const targetVpt4 = screenCenterX - data.sceneCenterX * targetZoom;
        const targetVpt5 = screenCenterY - data.sceneCenterY * targetZoom;

        canvas.setViewportTransform([targetZoom, 0, 0, targetZoom, targetVpt4, targetVpt5]);
        setCanvasVpt([...canvas.viewportTransform]);
        setZoom(Math.round(targetZoom * 100) / 100);
        canvas.requestRenderAll();
      }
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
        if (activeObj && !(activeObj as any).isEditing) {
          canvas.remove(activeObj);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          saveHistory();
        }
      }

      // Viewport Fit / Reset Shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        resetZoomRef.current();
        return;
      }
      if (e.shiftKey && (e.key === '!' || e.key === '1')) {
        e.preventDefault();
        fitToContentRef.current();
        return;
      }

      // Excalidraw Single-Key Tool Shortcuts & Page Scroll / Nudge
      const isInputFocused =
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA' ||
        ((canvas.getActiveObject() as any)?.isEditing);

      if (!isInputFocused) {
        const activeObj = canvas.getActiveObject();
        if (!activeObj) {
          // Canvas page scroll with Arrow keys / PageUp / PageDown / Home
          const scrollStep = e.shiftKey ? 180 : 60;
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            breakFollowModeRef.current();
            canvas.relativePan(new Point(0, scrollStep));
            setCanvasVpt([...canvas.viewportTransform]);
            broadcastViewportRef.current();
            return;
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            breakFollowModeRef.current();
            canvas.relativePan(new Point(0, -scrollStep));
            setCanvasVpt([...canvas.viewportTransform]);
            broadcastViewportRef.current();
            return;
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            breakFollowModeRef.current();
            canvas.relativePan(new Point(scrollStep, 0));
            setCanvasVpt([...canvas.viewportTransform]);
            broadcastViewportRef.current();
            return;
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            breakFollowModeRef.current();
            canvas.relativePan(new Point(-scrollStep, 0));
            setCanvasVpt([...canvas.viewportTransform]);
            broadcastViewportRef.current();
            return;
          } else if (e.key === 'PageUp') {
            e.preventDefault();
            breakFollowModeRef.current();
            canvas.relativePan(new Point(0, 300));
            setCanvasVpt([...canvas.viewportTransform]);
            broadcastViewportRef.current();
            return;
          } else if (e.key === 'PageDown') {
            e.preventDefault();
            breakFollowModeRef.current();
            canvas.relativePan(new Point(0, -300));
            setCanvasVpt([...canvas.viewportTransform]);
            broadcastViewportRef.current();
            return;
          } else if (e.key === 'Home') {
            e.preventDefault();
            breakFollowModeRef.current();
            resetZoomRef.current();
            broadcastViewportRef.current();
            return;
          }
        } else if (!(activeObj as any).isEditing) {
          // Object is selected: nudge object with arrow keys
          const nudge = e.shiftKey ? 10 : 2;
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeObj.set('top', (activeObj.top || 0) - nudge);
            activeObj.setCoords();
            canvas.requestRenderAll();
            updateSelectionStateRef.current();
            saveHistory();
            return;
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeObj.set('top', (activeObj.top || 0) + nudge);
            activeObj.setCoords();
            canvas.requestRenderAll();
            updateSelectionStateRef.current();
            saveHistory();
            return;
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            activeObj.set('left', (activeObj.left || 0) - nudge);
            activeObj.setCoords();
            canvas.requestRenderAll();
            updateSelectionStateRef.current();
            saveHistory();
            return;
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            activeObj.set('left', (activeObj.left || 0) + nudge);
            activeObj.setCoords();
            canvas.requestRenderAll();
            updateSelectionStateRef.current();
            saveHistory();
            return;
          }
        }
      }

      if (!isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'v') setActiveTool('select');
        else if (k === 'h') setActiveTool('hand');
        else if (k === 'r') setActiveTool('rectangle');
        else if (k === 'o') setActiveTool('circle');
        else if (k === 'd') setActiveTool('diamond');
        else if (k === 's') setActiveTool('sticky');
        else if (k === 'p') setActiveTool('pencil');
        else if (k === 't') setActiveTool('text');
        else if (k === 'a') setActiveTool('arrow');
        else if (k === 'l') setActiveTool('laser');
        else if (e.key === 'Escape') {
          if (useCanvasStore.getState().followingSocketId !== null) {
            useCanvasStore.getState().setFollowingSocketId(null);
          }
          if (activeToolRef.current === 'laser') {
            setActiveTool('select');
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        const currentTool = activeToolRef.current;
        canvas.defaultCursor =
          currentTool === 'hand' ? 'grab' : currentTool === 'select' ? 'default' : 'crosshair';
        canvas.setCursor(canvas.defaultCursor);
      }
    };

    // Clipboard Paste Listener (Ctrl+V Image Paste)
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }
      const activeObj = canvas.getActiveObject();
      if (activeObj && (activeObj as any).isEditing) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (!dataUrl) return;
            const pastePos = lastMouseScenePointRef.current;
            addImageFromURLRef.current(dataUrl, pastePos?.x, pastePos?.y);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    // Drag-and-Drop Image Listener
    const container = containerRef.current;
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const dropPoint = canvas.getScenePoint ? canvas.getScenePoint(e) : (canvas as any).getPointer(e);
      let posX = dropPoint ? dropPoint.x : undefined;
      let posY = dropPoint ? dropPoint.y : undefined;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (!dataUrl) return;
            addImageFromURLRef.current(dataUrl, posX, posY);
            if (posX !== undefined) posX += 25;
            if (posY !== undefined) posY += 25;
          };
          reader.readAsDataURL(file);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', handlePaste);
    if (container) {
      container.addEventListener('dragover', handleDragOver);
      container.addEventListener('drop', handleDrop);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', handlePaste);
      if (container) {
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('drop', handleDrop);
      }
      resizeObserver.disconnect();
      socketService.onUserViewport = undefined;
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
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.setCursor('crosshair');
    } else if (activeTool === 'hand') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = 'grab';
      canvas.setCursor('grab');
    } else if (activeTool === 'laser') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.discardActiveObject();
      canvas.defaultCursor = 'crosshair';
      canvas.setCursor('crosshair');
      canvas.requestRenderAll();
    } else if (['rectangle', 'circle', 'diamond', 'sticky', 'arrow', 'text'].includes(activeTool)) {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.setCursor('crosshair');
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.setCursor('default');
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
      rx: 6,
      ry: 6,
      strokeUniform: true,
    } as any);
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.requestRenderAll();
    saveHistory();
    socketService.emitObjectAdded((rect as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
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
      strokeUniform: true,
    } as any);
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.requestRenderAll();
    saveHistory();
    socketService.emitObjectAdded((circle as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
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
      strokeUniform: true,
    } as any);
    canvas.add(diamond);
    canvas.setActiveObject(diamond);
    canvas.requestRenderAll();
    saveHistory();
    socketService.emitObjectAdded((diamond as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
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
      fill: selectedFill === 'transparent' ? '#fef08a' : selectedFill,
      rx: 6,
      ry: 6,
      shadow: new Shadow({
        color: 'rgba(0,0,0,0.2)',
        blur: 16,
        offsetX: 0,
        offsetY: 8
      })
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
    socketService.emitObjectAdded((stickyGroup as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
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
      fill: '#1e293b', // Black text by default!
      editable: true,
      cursorColor: '#6366f1',
    } as any);
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    textbox.enterEditing();
    canvas.requestRenderAll();
    saveHistory();
    socketService.emitObjectAdded((textbox as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
    setActiveTool('select');
  }, [getCanvasCenter, saveHistory, setActiveTool]);

  const addArrow = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCenter();

    // Check if an object is actively selected to anchor from
    const active = canvas.getActiveObject();
    let startX = x - 90;
    let startY = y;
    let fromId: string | undefined;
    let fromAnchor: AnchorType | undefined;

    if (active && (active as any).id && !(active as any).isConnector) {
      fromId = (active as any).id;
      const anchors = getShapeAnchors(active);
      const rightAnchor = anchors.find((a) => a.type === 'right') || anchors[1];
      startX = rightAnchor.x;
      startY = rightAnchor.y;
      fromAnchor = 'right';
    } else {
      const nearStart = findNearestAnchor(x - 90, y, canvas);
      if (nearStart) {
        startX = nearStart.anchor.x;
        startY = nearStart.anchor.y;
        fromId = nearStart.shapeId;
        fromAnchor = nearStart.anchor.type;
      }
    }

    const nearEnd = findNearestAnchor(startX + 150, startY, canvas, fromId);
    const endX = nearEnd ? nearEnd.anchor.x : startX + 150;
    const endY = nearEnd ? nearEnd.anchor.y : startY;

    const connector = createSmartConnector({
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      fromId,
      toId: nearEnd?.shapeId,
      fromAnchor,
      toAnchor: nearEnd?.anchor.type,
      stroke: selectedStroke,
      strokeWidth: strokeWidth + 1,
    });

    canvas.add(connector);
    canvas.setActiveObject(connector);
    canvas.requestRenderAll();
    saveHistory();
    socketService.emitObjectAdded((connector as any).toObject(['id', 'name', 'isConnector', 'fromId', 'toId', 'fromAnchor', 'toAnchor']));
    setActiveTool('select');
  }, [selectedStroke, strokeWidth, getCanvasCenter, saveHistory, setActiveTool]);

  // One-click Tidy Up & Auto-alignment
  const tidyUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tidyUpCanvasObjects(canvas, (obj) => {
      socketService.emitObjectModified((obj as any).toObject(['id', 'name', 'shadow', 'rx', 'ry']));
    });
    // Emit modified for any attached connectors as well
    const connectors = canvas.getObjects().filter((o: any) => o.isConnector);
    connectors.forEach((conn) => {
      socketService.emitObjectModified(
        (conn as any).toObject(['id', 'name', 'isConnector', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
      );
    });
    saveHistory();
  }, [saveHistory]);

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
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'strokeDashArray', 'strokeWidth', 'fontSize', 'fontFamily', 'textAlign', 'isConnector', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
      );
    }
  }, [saveHistory]);

  const changeSelectedStroke = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      if (active.type === 'group') {
        const bg = (active as Group).getObjects()[0];
        if (bg) bg.set('stroke', color);
      } else {
        active.set('stroke', color);
      }
      canvas.requestRenderAll();
      saveHistory();
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'strokeDashArray', 'strokeWidth', 'fontSize', 'fontFamily', 'textAlign', 'isConnector', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
      );
    }
  }, [saveHistory]);

  const changeSelectedStrokeWidth = useCallback((width: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      if (active.type === 'group') {
        const bg = (active as Group).getObjects()[0];
        if (bg) bg.set('strokeWidth', width);
      } else {
        active.set('strokeWidth', width);
      }
      active.setCoords();
      canvas.requestRenderAll();
      saveHistory();
      setStrokeWidth(width);
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'strokeDashArray', 'strokeWidth', 'isConnector', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
      );
    }
  }, [saveHistory, setStrokeWidth]);

  const changeSelectedStrokeStyle = useCallback((style: 'solid' | 'dashed' | 'dotted') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      const dash = style === 'dashed' ? [8, 8] : style === 'dotted' ? [3, 4] : null;
      if (active.type === 'group') {
        const bg = (active as Group).getObjects()[0];
        if (bg) bg.set('strokeDashArray', dash as any);
      } else {
        active.set('strokeDashArray', dash as any);
      }
      active.setCoords();
      canvas.requestRenderAll();
      saveHistory();
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'strokeDashArray', 'strokeWidth', 'isConnector', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
      );
    }
  }, [saveHistory]);

  const changeSelectedFontSize = useCallback((size: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      if (active.type === 'textbox') {
        (active as Textbox).set('fontSize', size);
      } else if (active.type === 'group') {
        const textInGroup = (active as Group).getObjects().find((o) => o.type === 'textbox');
        if (textInGroup) (textInGroup as Textbox).set('fontSize', size);
      }
      active.setCoords();
      canvas.requestRenderAll();
      saveHistory();
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'fontSize', 'fontFamily', 'textAlign'])
      );
    }
  }, [saveHistory]);

  const changeSelectedFontFamily = useCallback((family: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      if (active.type === 'textbox') {
        (active as Textbox).set('fontFamily', family);
      } else if (active.type === 'group') {
        const textInGroup = (active as Group).getObjects().find((o) => o.type === 'textbox');
        if (textInGroup) (textInGroup as Textbox).set('fontFamily', family);
      }
      active.setCoords();
      canvas.requestRenderAll();
      saveHistory();
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'fontSize', 'fontFamily', 'textAlign'])
      );
    }
  }, [saveHistory]);

  const changeSelectedTextAlign = useCallback((align: 'left' | 'center' | 'right') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      if (active.type === 'textbox') {
        (active as Textbox).set('textAlign', align);
      } else if (active.type === 'group') {
        const textInGroup = (active as Group).getObjects().find((o) => o.type === 'textbox');
        if (textInGroup) (textInGroup as Textbox).set('textAlign', align);
      }
      active.setCoords();
      canvas.requestRenderAll();
      saveHistory();
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'fontSize', 'fontFamily', 'textAlign'])
      );
    }
  }, [saveHistory]);

  const changeSelectedArrowCurvature = useCallback((isCurved: boolean, curvature = 50) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && (active as any).isConnector) {
      (active as any).isCurved = isCurved;
      (active as any).curvature = isCurved ? curvature : 0;
      (active as any).padding = Math.max(16, Math.abs((active as any).curvature) / 2 + 10);
      active.setCoords();
      canvas.requestRenderAll();
      saveHistory();
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'strokeDashArray', 'strokeWidth', 'isConnector', 'isCurved', 'curvature', 'arrowhead', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
      );
    }
  }, [saveHistory]);

  const changeSelectedArrowhead = useCallback((style: 'end' | 'both' | 'none') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && (active as any).isConnector) {
      (active as any).arrowhead = style;
      active.setCoords();
      canvas.requestRenderAll();
      saveHistory();
      updateSelectionStateRef.current();
      socketService.emitObjectModified(
        (active as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'strokeDashArray', 'strokeWidth', 'isConnector', 'isCurved', 'curvature', 'arrowhead', 'fromId', 'toId', 'fromAnchor', 'toAnchor'])
      );
    }
  }, [saveHistory]);

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      const objId = (active as any).id;
      // Detach any connectors bound to this shape so no orphaned references remain
      const attachedConnectors = canvas.getObjects().filter(
        (o: any) => o.isConnector && (o.fromId === objId || o.toId === objId)
      );
      attachedConnectors.forEach((c: any) => {
        if (c.fromId === objId) {
          c.fromId = undefined;
          c.fromAnchor = undefined;
        }
        if (c.toId === objId) {
          c.toId = undefined;
          c.toAnchor = undefined;
        }
      });

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
    breakFollowMode();
    let nextZoom = canvas.getZoom() * 1.2;
    if (nextZoom > 5) nextZoom = 5;
    const center = canvas.getCenterPoint();
    canvas.zoomToPoint(new Point(center.x, center.y), nextZoom);
    setZoom(Math.round(nextZoom * 100) / 100);
    setCanvasVpt([...canvas.viewportTransform]);
    broadcastViewport();
  }, [setZoom, breakFollowMode, broadcastViewport]);

  const zoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    breakFollowMode();
    let nextZoom = canvas.getZoom() / 1.2;
    if (nextZoom < 0.1) nextZoom = 0.1;
    const center = canvas.getCenterPoint();
    canvas.zoomToPoint(new Point(center.x, center.y), nextZoom);
    setZoom(Math.round(nextZoom * 100) / 100);
    setCanvasVpt([...canvas.viewportTransform]);
    broadcastViewport();
  }, [setZoom, breakFollowMode, broadcastViewport]);

  const resetZoom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    breakFollowMode();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    setCanvasVpt([1, 0, 0, 1, 0, 0]);
    canvas.requestRenderAll();
    broadcastViewport();
  }, [setZoom, breakFollowMode, broadcastViewport]);
  resetZoomRef.current = resetZoom;

  const panBy = useCallback((dx: number, dy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    breakFollowMode();
    canvas.relativePan(new Point(dx, dy));
    setCanvasVpt([...canvas.viewportTransform]);
    broadcastViewport();
    if (canvas.getActiveObject()) {
      updateSelectionStateRef.current();
    }
  }, [breakFollowMode, broadcastViewport]);

  const setViewportPos = useCallback((vptX: number, vptY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    breakFollowMode();
    const vpt = [...canvas.viewportTransform];
    vpt[4] = vptX;
    vpt[5] = vptY;
    canvas.setViewportTransform(vpt as [number, number, number, number, number, number]);
    setCanvasVpt([...vpt]);
    broadcastViewport();
    if (canvas.getActiveObject()) {
      updateSelectionStateRef.current();
    }
  }, [breakFollowMode, broadcastViewport]);

  const fitToContent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects().filter((o: any) => !o.isGuideline && !o.isAnchorPoint);
    if (objects.length === 0) {
      resetZoom();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    objects.forEach((obj: any) => {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const width = obj.getScaledWidth ? obj.getScaledWidth() : (obj.width || 0);
      const height = obj.getScaledHeight ? obj.getScaledHeight() : (obj.height || 0);
      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (left + width > maxX) maxX = left + width;
      if (top + height > maxY) maxY = top + height;
    });

    const padding = 100;
    const contentW = Math.max(100, maxX - minX + padding * 2);
    const contentH = Math.max(100, maxY - minY + padding * 2);
    const canvasW = canvas.getWidth();
    const canvasH = canvas.getHeight();

    let fitZoom = Math.min(canvasW / contentW, canvasH / contentH);
    fitZoom = Math.max(0.1, Math.min(2, fitZoom));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const vptX = canvasW / 2 - centerX * fitZoom;
    const vptY = canvasH / 2 - centerY * fitZoom;

    canvas.setViewportTransform([fitZoom, 0, 0, fitZoom, vptX, vptY]);
    setZoom(Math.round(fitZoom * 100) / 100);
    setCanvasVpt([fitZoom, 0, 0, fitZoom, vptX, vptY]);
    canvas.requestRenderAll();
    if (canvas.getActiveObject()) {
      updateSelectionStateRef.current();
    }
  }, [resetZoom, setZoom]);
  fitToContentRef.current = fitToContent;

  // Dynamic Image Ingestion (Upload, Paste, Drag & Drop)
  const addImageFromURL = useCallback(async (dataUrl: string, x?: number, y?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const center = getCanvasCenter();
    const targetX = x !== undefined ? x : center.x;
    const targetY = y !== undefined ? y : center.y;

    try {
      const img = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
      if (!img) return;

      const maxW = 550;
      const maxH = 450;
      const origW = img.width || 400;
      const origH = img.height || 300;
      let scale = 1;
      if (origW > maxW || origH > maxH) {
        scale = Math.min(maxW / origW, maxH / origH);
      }

      const id = nanoid(8);
      img.set({
        id,
        left: targetX - (origW * scale) / 2,
        top: targetY - (origH * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        cornerColor: '#6366f1',
        cornerStrokeColor: '#ffffff',
        cornerStyle: 'circle',
        borderColor: '#6366f1',
        borderDashArray: [4, 4],
        transparentCorners: false,
        cornerSize: 10,
      } as any);

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      saveHistory();
      socketService.emitObjectAdded((img as any).toObject(['id', 'name', 'shadow', 'rx', 'ry', 'src']));
      setHasObjects(true);
    } catch (err) {
      console.error('Failed to load image into canvas:', err);
    }
  }, [getCanvasCenter, saveHistory, setHasObjects]);
  addImageFromURLRef.current = addImageFromURL;

  // High-Resolution PNG Export
  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL({
      format: 'png',
      multiplier: 2,
    });
    const link = document.createElement('a');
    link.download = `collabspace-${(boardTitle || 'whiteboard').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  }, [boardTitle]);

  // Lossless Vector SVG Export
  const exportSVG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const svgStr = canvas.toSVG();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `collabspace-${(boardTitle || 'whiteboard').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [boardTitle]);

  // Copy PNG image directly to system clipboard
  const copyCanvasToClipboard = useCallback(async (): Promise<boolean> => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    try {
      const dataURL = canvas.toDataURL({ format: 'png', multiplier: 2 });
      const res = await fetch(dataURL);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    } catch (err) {
      console.error('Failed to copy canvas image to clipboard:', err);
      return false;
    }
  }, []);

  // Lossless JSON Export
  const exportJSON = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const jsonStr = JSON.stringify(canvas.toJSON());
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `collabspace-${(boardTitle || 'whiteboard').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [boardTitle]);

  return {
    canvasRef,
    canvasVpt,
    addRectangle,
    addCircle,
    addDiamond,
    addStickyNote,
    addText,
    addArrow,
    addImageFromURL,
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
    exportSVG,
    exportJSON,
    copyCanvasToClipboard,
    tidyUp,
  };
}
