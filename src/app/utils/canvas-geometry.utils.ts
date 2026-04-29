import {Point2D, Rect2D, Size2D, SnapResult} from '../models/geometry.models';
import {WidgetStateItem} from '../models/canvas-widget-state.models';

const roundToStep = (value: number, step: number): number => Math.round(value / step) * step;

export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

export const screenToCanvasPoint = ({
  screen,
  canvasOffset,
  zoom
}: {
  screen: Point2D;
  canvasOffset: Point2D;
  zoom: number;
}): Point2D => ({
  x: (screen.x - canvasOffset.x) / zoom,
  y: (screen.y - canvasOffset.y) / zoom,
});

export const canvasToScreenPoint = ({
  canvas,
  canvasOffset,
  zoom
}: {
  canvas: Point2D;
  canvasOffset: Point2D;
  zoom: number;
}): Point2D => ({
  x: canvasOffset.x + canvas.x * zoom,
  y: canvasOffset.y + canvas.y * zoom,
});

export const snapPointToGrid = ({point, snap}: { point: Point2D; snap: number; }): Point2D => ({
  x: roundToStep(point.x, snap),
  y: roundToStep(point.y, snap),
});

export const clampWidgetPosition = ({
  position,
  widget,
  canvas
}: {
  position: Point2D;
  widget: Size2D;
  canvas: Size2D;
}): Point2D => ({
  x: clamp(position.x, 0, Math.max(0, canvas.width - widget.width)),
  y: clamp(position.y, 0, Math.max(0, canvas.height - widget.height)),
});

const buildEdges = (rect: Rect2D) => ({
  left: rect.x,
  centerX: rect.x + rect.width / 2,
  right: rect.x + rect.width,
  top: rect.y,
  centerY: rect.y + rect.height / 2,
  bottom: rect.y + rect.height,
});

export const snapWidgetPositionToObjects = ({
  position,
  moving,
  siblings,
  distance
}: {
  position: Point2D;
  moving: Size2D;
  siblings: WidgetStateItem[];
  distance: number;
}): SnapResult => {
  const movingRect: Rect2D = {
    x: position.x,
    y: position.y,
    width: moving.width,
    height: moving.height,
  };

  const movingEdges = buildEdges(movingRect);

  let snapX = position.x;
  let snapY = position.y;
  let bestDiffX = distance + 1;
  let bestDiffY = distance + 1;
  const guides: SnapResult['guides'] = {};

  for (const sibling of siblings) {
    const siblingEdges = buildEdges(sibling);

    const xPairs = [
      {movingValue: movingEdges.left, siblingValue: siblingEdges.left, corrected: siblingEdges.left},
      {movingValue: movingEdges.left, siblingValue: siblingEdges.right, corrected: siblingEdges.right},
      {movingValue: movingEdges.centerX, siblingValue: siblingEdges.centerX, corrected: siblingEdges.centerX - moving.width / 2},
      {movingValue: movingEdges.right, siblingValue: siblingEdges.left, corrected: siblingEdges.left - moving.width},
      {movingValue: movingEdges.right, siblingValue: siblingEdges.right, corrected: siblingEdges.right - moving.width},
    ];

    for (const pair of xPairs) {
      const diff = Math.abs(pair.movingValue - pair.siblingValue);
      if (diff <= distance && diff < bestDiffX) {
        bestDiffX = diff;
        snapX = pair.corrected;
        guides.x = pair.siblingValue;
      }
    }

    const yPairs = [
      {movingValue: movingEdges.top, siblingValue: siblingEdges.top, corrected: siblingEdges.top},
      {movingValue: movingEdges.top, siblingValue: siblingEdges.bottom, corrected: siblingEdges.bottom},
      {movingValue: movingEdges.centerY, siblingValue: siblingEdges.centerY, corrected: siblingEdges.centerY - moving.height / 2},
      {movingValue: movingEdges.bottom, siblingValue: siblingEdges.top, corrected: siblingEdges.top - moving.height},
      {movingValue: movingEdges.bottom, siblingValue: siblingEdges.bottom, corrected: siblingEdges.bottom - moving.height},
    ];

    for (const pair of yPairs) {
      const diff = Math.abs(pair.movingValue - pair.siblingValue);
      if (diff <= distance && diff < bestDiffY) {
        bestDiffY = diff;
        snapY = pair.corrected;
        guides.y = pair.siblingValue;
      }
    }
  }

  return {
    point: {x: snapX, y: snapY},
    guides,
  };
};

export const resizeRectFromHandle = ({
  rect,
  handle,
  delta,
  min,
}: {
  rect: Rect2D;
  handle: 'top' | 'right' | 'bottom' | 'left';
  delta: Point2D;
  min: Size2D;
}): Rect2D => {
  const next: Rect2D = {...rect};

  switch (handle) {
    case 'right':
      next.width = Math.max(min.width, rect.width + delta.x);
      break;
    case 'bottom':
      next.height = Math.max(min.height, rect.height + delta.y);
      break;
    case 'left': {
      const nextX = rect.x + delta.x;
      const maxX = rect.x + rect.width - min.width;
      next.x = Math.min(nextX, maxX);
      next.width = Math.max(min.width, rect.width - (next.x - rect.x));
      break;
    }
    case 'top': {
      const nextY = rect.y + delta.y;
      const maxY = rect.y + rect.height - min.height;
      next.y = Math.min(nextY, maxY);
      next.height = Math.max(min.height, rect.height - (next.y - rect.y));
      break;
    }
  }

  return next;
};

export const snapResizedRectByHandle = ({
  rect,
  handle,
  initialRect,
  snap,
  min,
}: {
  rect: Rect2D;
  handle: 'top' | 'right' | 'bottom' | 'left';
  initialRect: Rect2D;
  snap: number;
  min: Size2D;
}): Rect2D => {
  if (snap <= 1) {
    return rect;
  }

  const right = initialRect.x + initialRect.width;
  const bottom = initialRect.y + initialRect.height;

  switch (handle) {
    case 'top': {
      const snappedTop = roundToStep(rect.y, snap);
      return {
        ...rect,
        y: snappedTop,
        height: Math.max(min.height, bottom - snappedTop),
      };
    }
    case 'bottom': {
      const snappedHeight = Math.max(min.height, roundToStep(rect.height, snap));
      return {
        ...rect,
        height: snappedHeight,
      };
    }
    case 'left': {
      const snappedLeft = roundToStep(rect.x, snap);
      return {
        ...rect,
        x: snappedLeft,
        width: Math.max(min.width, right - snappedLeft),
      };
    }
    case 'right': {
      const snappedWidth = Math.max(min.width, roundToStep(rect.width, snap));
      return {
        ...rect,
        width: snappedWidth,
      };
    }
  }
};

export const clampResizedRectByHandle = ({
  rect,
  handle,
  initialRect,
  canvas,
  min,
}: {
  rect: Rect2D;
  handle: 'top' | 'right' | 'bottom' | 'left';
  initialRect: Rect2D;
  canvas: Size2D;
  min: Size2D;
}): Rect2D => {
  const right = initialRect.x + initialRect.width;
  const bottom = initialRect.y + initialRect.height;

  switch (handle) {
    case 'top': {
      const top = clamp(rect.y, 0, bottom - min.height);
      return {
        ...rect,
        y: top,
        height: Math.max(min.height, bottom - top),
      };
    }
    case 'bottom': {
      const top = clamp(rect.y, 0, Math.max(0, canvas.height - min.height));
      const clampedBottom = clamp(top + rect.height, top + min.height, canvas.height);
      return {
        ...rect,
        y: top,
        height: Math.max(min.height, clampedBottom - top),
      };
    }
    case 'left': {
      const left = clamp(rect.x, 0, right - min.width);
      return {
        ...rect,
        x: left,
        width: Math.max(min.width, right - left),
      };
    }
    case 'right': {
      const left = clamp(rect.x, 0, Math.max(0, canvas.width - min.width));
      const clampedRight = clamp(left + rect.width, left + min.width, canvas.width);
      return {
        ...rect,
        x: left,
        width: Math.max(min.width, clampedRight - left),
      };
    }
  }
};

export const clampRectInsideCanvas = ({rect, canvas}: { rect: Rect2D; canvas: Size2D; }): Rect2D => ({
  ...rect,
  x: clamp(rect.x, 0, Math.max(0, canvas.width - rect.width)),
  y: clamp(rect.y, 0, Math.max(0, canvas.height - rect.height)),
  width: Math.min(rect.width, canvas.width),
  height: Math.min(rect.height, canvas.height),
});
