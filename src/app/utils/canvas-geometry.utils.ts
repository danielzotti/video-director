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

const buildAxisPairs = ({
  movingStart,
  movingCenter,
  movingEnd,
  siblingStart,
  siblingCenter,
  siblingEnd,
  movingSize,
}: {
  movingStart: number;
  movingCenter: number;
  movingEnd: number;
  siblingStart: number;
  siblingCenter: number;
  siblingEnd: number;
  movingSize: number;
}) => [
  {movingValue: movingStart, siblingValue: siblingStart, corrected: siblingStart},
  {movingValue: movingStart, siblingValue: siblingCenter, corrected: siblingCenter},
  {movingValue: movingStart, siblingValue: siblingEnd, corrected: siblingEnd},
  {movingValue: movingCenter, siblingValue: siblingStart, corrected: siblingStart - movingSize / 2},
  {movingValue: movingCenter, siblingValue: siblingCenter, corrected: siblingCenter - movingSize / 2},
  {movingValue: movingCenter, siblingValue: siblingEnd, corrected: siblingEnd - movingSize / 2},
  {movingValue: movingEnd, siblingValue: siblingStart, corrected: siblingStart - movingSize},
  {movingValue: movingEnd, siblingValue: siblingCenter, corrected: siblingCenter - movingSize},
  {movingValue: movingEnd, siblingValue: siblingEnd, corrected: siblingEnd - movingSize},
];

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

    const xPairs = buildAxisPairs({
      movingStart: movingEdges.left,
      movingCenter: movingEdges.centerX,
      movingEnd: movingEdges.right,
      siblingStart: siblingEdges.left,
      siblingCenter: siblingEdges.centerX,
      siblingEnd: siblingEdges.right,
      movingSize: moving.width,
    });

    for (const pair of xPairs) {
      const diff = Math.abs(pair.movingValue - pair.siblingValue);
      if (diff <= distance && diff < bestDiffX) {
        bestDiffX = diff;
        snapX = pair.corrected;
        guides.x = pair.siblingValue;
      }
    }

    const yPairs = buildAxisPairs({
      movingStart: movingEdges.top,
      movingCenter: movingEdges.centerY,
      movingEnd: movingEdges.bottom,
      siblingStart: siblingEdges.top,
      siblingCenter: siblingEdges.centerY,
      siblingEnd: siblingEdges.bottom,
      movingSize: moving.height,
    });

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
  handle: 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
  delta: Point2D;
  min: Size2D;
}): Rect2D => {
  const next: Rect2D = {...rect};

  if (handle.includes('right')) {
    next.width = Math.max(min.width, rect.width + delta.x);
  }

  if (handle.includes('bottom')) {
    next.height = Math.max(min.height, rect.height + delta.y);
  }

  if (handle.includes('left')) {
    const nextX = rect.x + delta.x;
    const maxX = rect.x + rect.width - min.width;
    next.x = Math.min(nextX, maxX);
    next.width = Math.max(min.width, rect.width - (next.x - rect.x));
  }

  if (handle.includes('top')) {
    const nextY = rect.y + delta.y;
    const maxY = rect.y + rect.height - min.height;
    next.y = Math.min(nextY, maxY);
    next.height = Math.max(min.height, rect.height - (next.y - rect.y));
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
  handle: 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
  initialRect: Rect2D;
  snap: number;
  min: Size2D;
}): Rect2D => {
  if (snap <= 1) {
    return rect;
  }

  const right = initialRect.x + initialRect.width;
  const bottom = initialRect.y + initialRect.height;

  const next: Rect2D = {...rect};

  if (handle.includes('top')) {
    const snappedTop = roundToStep(next.y, snap);
    next.y = snappedTop;
    next.height = Math.max(min.height, bottom - snappedTop);
  }

  if (handle.includes('bottom')) {
    next.height = Math.max(min.height, roundToStep(next.height, snap));
  }

  if (handle.includes('left')) {
    const snappedLeft = roundToStep(next.x, snap);
    next.x = snappedLeft;
    next.width = Math.max(min.width, right - snappedLeft);
  }

  if (handle.includes('right')) {
    next.width = Math.max(min.width, roundToStep(next.width, snap));
  }

  return next;
};

export const clampResizedRectByHandle = ({
  rect,
  handle,
  initialRect,
  canvas,
  min,
}: {
  rect: Rect2D;
  handle: 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
  initialRect: Rect2D;
  canvas: Size2D;
  min: Size2D;
}): Rect2D => {
  const right = initialRect.x + initialRect.width;
  const bottom = initialRect.y + initialRect.height;

  const next: Rect2D = {...rect};

  if (handle.includes('top')) {
    const top = clamp(next.y, 0, bottom - min.height);
    next.y = top;
    next.height = Math.max(min.height, bottom - top);
  }

  if (handle.includes('bottom')) {
    const top = clamp(next.y, 0, Math.max(0, canvas.height - min.height));
    const clampedBottom = clamp(top + next.height, top + min.height, canvas.height);
    next.y = top;
    next.height = Math.max(min.height, clampedBottom - top);
  }

  if (handle.includes('left')) {
    const left = clamp(next.x, 0, right - min.width);
    next.x = left;
    next.width = Math.max(min.width, right - left);
  }

  if (handle.includes('right')) {
    const left = clamp(next.x, 0, Math.max(0, canvas.width - min.width));
    const clampedRight = clamp(left + next.width, left + min.width, canvas.width);
    next.x = left;
    next.width = Math.max(min.width, clampedRight - left);
  }

  return next;
};

export const clampRectInsideCanvas = ({rect, canvas}: { rect: Rect2D; canvas: Size2D; }): Rect2D => ({
  ...rect,
  x: clamp(rect.x, 0, Math.max(0, canvas.width - rect.width)),
  y: clamp(rect.y, 0, Math.max(0, canvas.height - rect.height)),
  width: Math.min(rect.width, canvas.width),
  height: Math.min(rect.height, canvas.height),
});
