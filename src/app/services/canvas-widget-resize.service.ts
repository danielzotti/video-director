import {Injectable} from '@angular/core';
import {Rect2D, ResizeHandle, Size2D} from '../models/geometry.models';
import {
  clampAspectResizedRectByHandle,
  clampResizedRectByHandle,
  enforceRectAspectRatioByHandle,
  resizeRectFromHandle,
  snapAspectResizedRectByHandle,
  snapResizedRectByHandle
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
  }): Rect2D {
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

    return nextRect;
  }
}

