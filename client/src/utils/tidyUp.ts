import { Canvas, FabricObject } from 'fabric';
import { updateAttachedConnectors } from './connectors';

export function tidyUpCanvasObjects(
  canvas: Canvas,
  onObjectModified?: (obj: FabricObject) => void
) {
  let objectsToAlign: FabricObject[] = [];

  const active = canvas.getActiveObject();
  if (active && (active as any).type === 'activeselection') {
    objectsToAlign = (active as any).getObjects().filter((obj: any) => !obj.isGuideline && !obj.isConnector);
  } else {
    objectsToAlign = canvas.getObjects().filter((obj: any) => {
      return (
        !obj.isGuideline &&
        !obj.isConnector &&
        obj.type !== 'line' &&
        obj.visible !== false
      );
    });
  }

  if (objectsToAlign.length < 2) return;

  // Determine orientation: vertical column vs horizontal row
  const minX = Math.min(...objectsToAlign.map((o) => o.left));
  const maxX = Math.max(...objectsToAlign.map((o) => o.left + o.getBoundingRect().width));
  const minY = Math.min(...objectsToAlign.map((o) => o.top));
  const maxY = Math.max(...objectsToAlign.map((o) => o.top + o.getBoundingRect().height));

  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;
  const isVertical = totalHeight > totalWidth * 1.2;

  const SPACING = 36;

  if (isVertical) {
    // Sort from top to bottom
    objectsToAlign.sort((a, b) => a.top - b.top);
    const xCenters = objectsToAlign.map((obj) => obj.left + obj.getBoundingRect().width / 2);
    const medianX = xCenters.reduce((sum, val) => sum + val, 0) / xCenters.length;

    let currentTop = objectsToAlign[0].top;

    objectsToAlign.forEach((obj) => {
      const bound = obj.getBoundingRect();
      const newLeft = medianX - bound.width / 2;

      obj.set({
        left: Math.round(newLeft),
        top: Math.round(currentTop),
      });
      obj.setCoords();

      currentTop += bound.height + SPACING;
      updateAttachedConnectors(obj, canvas);
      onObjectModified?.(obj);
    });
  } else {
    // Sort from left to right
    objectsToAlign.sort((a, b) => a.left - b.left);
    const yCenters = objectsToAlign.map((obj) => obj.top + obj.getBoundingRect().height / 2);
    const medianY = yCenters.reduce((sum, val) => sum + val, 0) / yCenters.length;

    let currentLeft = objectsToAlign[0].left;

    objectsToAlign.forEach((obj) => {
      const bound = obj.getBoundingRect();
      const newTop = medianY - bound.height / 2;

      obj.set({
        left: Math.round(currentLeft),
        top: Math.round(newTop),
      });
      obj.setCoords();

      currentLeft += bound.width + SPACING;
      updateAttachedConnectors(obj, canvas);
      onObjectModified?.(obj);
    });
  }

  canvas.requestRenderAll();
}
