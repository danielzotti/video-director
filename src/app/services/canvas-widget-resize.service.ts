import {Injectable} from '@angular/core';
import {Rect2D, ResizeHandle, Size2D} from '../models/geometry.models';
import {clampResizedRectByHandle, resizeRectFromHandle, snapResizedRectByHandle} from '../utils/canvas-geometry.utils';

@Injectable({
  providedIn: 'root',
})
export class CanvasWidgetResizeService {
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
  }: {
    handle: ResizeHandle;
    initialRect: Rect2D;
    delta: {x: number; y: number};
    min: Size2D;
    snapToGrid: boolean;
    snapSize: number;
    canExitBorders: boolean;
    canvas: Size2D;
  }): Rect2D {
    let nextRect = resizeRectFromHandle({
      rect: initialRect,
      handle,
      delta,
      min,
    });

    if (snapToGrid) {
      nextRect = snapResizedRectByHandle({
        rect: nextRect,
        handle,
        initialRect,
        snap: snapSize,
        min,
      });
    }

    if (!canExitBorders) {
      nextRect = clampResizedRectByHandle({
        rect: nextRect,
        handle,
        initialRect,
        canvas,
        min,
      });
    }

    return nextRect;
  }
}

