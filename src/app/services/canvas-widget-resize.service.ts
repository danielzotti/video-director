import {Injectable} from '@angular/core';
import {AxisGuides, Rect2D, RectSnapResult, ResizeHandle, Size2D} from '../models/geometry.models';
import {
  clampAspectResizedRectByHandle,
  clampResizedRectByHandle,
  enforceRectAspectRatioByHandle,
  resizeRectFromHandle,
  snapAspectResizedRectByHandle,
  snapResizedRectByHandle,
  snapResizeRectToBorders,
  snapResizeRectToObjects,
} from '../utils/canvas-geometry.utils';

@Injectable({
  providedIn: 'root',
})
export class CanvasWidgetResizeService {
  private resolveShiftResizeHandle(handle: ResizeHandle): ResizeHandle {
    if (handle === 'right' || handle === 'bottom') {
      return 'bottom-right';
    }

    if (handle === 'left' || handle === 'top') {
      return 'top-left';
    }

    return handle;
  }

  readElementRect(el: HTMLElement, fallbackSize: Size2D): Rect2D {
    return {
      x: Number.parseFloat(el.style.left) || 0,
      y: Number.parseFloat(el.style.top) || 0,
      width: Number.parseFloat(el.style.width) || fallbackSize.width,
      height: Number.parseFloat(el.style.height) || fallbackSize.height,
    };
  }

  computeNextRect({
    handle,
    initialRect,
    delta,
    min,
    snapToGrid,
    snapSize,
    canExitBorders,
    canvas,
    keepAspectRatio,
    aspectRatio,
    snapToObjects,
    objectSnapDistance,
    snapToBorder,
    borderSnapDistance,
    siblings,
    zoom,
  }: {
    handle: ResizeHandle;
    initialRect: Rect2D;
    delta: {x: number; y: number};
    min: Size2D;
    snapToGrid: boolean;
    snapSize: number;
    canExitBorders: boolean;
    canvas: Size2D;
    keepAspectRatio: boolean;
    aspectRatio?: number;
    snapToObjects: boolean;
    objectSnapDistance: number;
    snapToBorder: boolean;
    borderSnapDistance: number;
    siblings: Rect2D[];
    zoom: number;
  }): RectSnapResult {
    const effectiveHandle = keepAspectRatio ? this.resolveShiftResizeHandle(handle) : handle;
    const shouldKeepAspectRatio = keepAspectRatio;

    let nextRect = resizeRectFromHandle({
      rect: initialRect,
      handle: effectiveHandle,
      delta,
      min,
      keepAspectRatio: shouldKeepAspectRatio,
      aspectRatio,
    });

    if (snapToGrid) {
      if (shouldKeepAspectRatio) {
        nextRect = snapAspectResizedRectByHandle({
          rect: nextRect,
          handle: effectiveHandle,
          initialRect,
          min,
          snap: snapSize,
          aspectRatio,
        });
      } else {
        nextRect = snapResizedRectByHandle({
          rect: nextRect,
          handle: effectiveHandle,
          initialRect,
          snap: snapSize,
          min,
        });
      }
    }

    if (shouldKeepAspectRatio && !snapToGrid) {
      nextRect = enforceRectAspectRatioByHandle({
        rect: nextRect,
        handle: effectiveHandle,
        initialRect,
        min,
        aspectRatio,
      });
    }

    // Snap-to-objects and snap-to-borders act on the moving edges.
    // Skip when keepAspectRatio is active to avoid breaking the ratio.
    let guides: AxisGuides = {};
    if (!shouldKeepAspectRatio) {
      if (snapToObjects) {
        const objSnap = snapResizeRectToObjects({
          rect: nextRect,
          handle: effectiveHandle,
          siblings,
          distance: objectSnapDistance / zoom,
          min,
        });
        nextRect = objSnap.rect;
        guides = objSnap.guides;
      }

      if (snapToBorder) {
        const borderSnap = snapResizeRectToBorders({
          rect: nextRect,
          handle: effectiveHandle,
          canvas,
          distance: borderSnapDistance / zoom,
          min,
        });
        nextRect = borderSnap.rect;
        guides = {
          x: borderSnap.guides.x ?? guides.x,
          y: borderSnap.guides.y ?? guides.y,
        };
      }
    }

    if (!canExitBorders) {
      if (shouldKeepAspectRatio) {
        nextRect = clampAspectResizedRectByHandle({
          rect: nextRect,
          handle: effectiveHandle,
          initialRect,
          canvas,
          min,
          aspectRatio,
          snap: snapToGrid ? snapSize : undefined,
        });
      } else {
        nextRect = clampResizedRectByHandle({
          rect: nextRect,
          handle: effectiveHandle,
          initialRect,
          canvas,
          min,
        });
      }
    }

    return {rect: nextRect, guides};
  }
}

