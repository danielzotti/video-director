import {Injectable} from '@angular/core';
import {WidgetStateItem} from '../models/canvas-widget-state.models';
import {AxisGuides, Point2D, Size2D} from '../models/geometry.models';
import {
  clampWidgetPosition,
  snapPointToGrid,
  snapWidgetPositionToCanvasBorders,
  snapWidgetPositionToObjects,
} from '../utils/canvas-geometry.utils';

@Injectable({
  providedIn: 'root',
})
export class CanvasWidgetDragService {
  createDragOffset({
    pointerCanvas,
    widget,
  }: {
    pointerCanvas: Point2D;
    widget: WidgetStateItem;
  }): Point2D {
    return {
      x: pointerCanvas.x - widget.x,
      y: pointerCanvas.y - widget.y,
    };
  }

  computeNextPosition({
    pointerCanvas,
    dragOffset,
    widget,
    siblings,
    snapToGrid,
    snapSize,
    snapToObjects,
    objectSnapDistance,
    snapToBorder,
    borderSnapDistance,
    zoom,
    canExitBorders,
    canvas,
  }: {
    pointerCanvas: Point2D;
    dragOffset: Point2D;
    widget: Size2D & Pick<WidgetStateItem, 'uuid'>;
    siblings: WidgetStateItem[];
    snapToGrid: boolean;
    snapSize: number;
    snapToObjects: boolean;
    objectSnapDistance: number;
    snapToBorder: boolean;
    borderSnapDistance: number;
    zoom: number;
    canExitBorders: boolean;
    canvas: Size2D;
  }): {point: Point2D; guides: AxisGuides} {
    let next: Point2D = {
      x: pointerCanvas.x - dragOffset.x,
      y: pointerCanvas.y - dragOffset.y,
    };

    if (snapToGrid) {
      next = snapPointToGrid({point: next, snap: snapSize});
    }

    let guides: AxisGuides = {};
    if (snapToObjects) {
      const snapResult = snapWidgetPositionToObjects({
        position: next,
        moving: {width: widget.width, height: widget.height},
        siblings,
        distance: objectSnapDistance / zoom,
      });
      next = snapResult.point;
      guides = snapResult.guides;
    }

    if (snapToBorder) {
      const borderSnap = snapWidgetPositionToCanvasBorders({
        position: next,
        widget: {width: widget.width, height: widget.height},
        canvas,
        distance: borderSnapDistance / zoom,
      });
      next = borderSnap.point;
      guides = {
        x: borderSnap.guides.x ?? guides.x,
        y: borderSnap.guides.y ?? guides.y,
      };
    }

    if (!canExitBorders) {
      next = clampWidgetPosition({
        position: next,
        widget: {width: widget.width, height: widget.height},
        canvas,
      });
    }

    return {point: next, guides};
  }

  readElementPosition(el: HTMLElement): Point2D {
    return {
      x: Number.parseFloat(el.style.left) || 0,
      y: Number.parseFloat(el.style.top) || 0,
    };
  }
}

