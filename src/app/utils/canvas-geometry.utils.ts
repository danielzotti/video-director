import {AxisGuides, Point2D, Rect2D, RectSnapResult, ResizeHandle, Size2D, SnapResult} from '../models/geometry.models';
import {WidgetStateItem} from '../models/canvas-widget-state.models';

const roundToStep = (value: number, step: number): number => Math.round(value / step) * step;
const integerGcd = (a: number, b: number): number => {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));

  while (y !== 0) {
    const tmp = y;
    y = x % y;
    x = tmp;
  }

  return x || 1;
};

const integerLcm = (a: number, b: number): number => {
  const x = Math.max(1, Math.abs(Math.trunc(a)));
  const y = Math.max(1, Math.abs(Math.trunc(b)));
  return Math.abs((x / integerGcd(x, y)) * y);
};

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

export const snapWidgetPositionToCanvasBorders = ({
  position,
  widget,
  canvas,
  distance,
}: {
  position: Point2D;
  widget: Size2D;
  canvas: Size2D;
  distance: number;
}): SnapResult => {
  let snapX = position.x;
  let snapY = position.y;
  let bestDiffX = distance + 1;
  let bestDiffY = distance + 1;
  const guides: SnapResult['guides'] = {};

  const leftDiff = Math.abs(position.x);
  if (leftDiff <= distance && leftDiff < bestDiffX) {
    bestDiffX = leftDiff;
    snapX = 0;
    guides.x = 0;
  }

  const right = position.x + widget.width;
  const rightDiff = Math.abs(canvas.width - right);
  if (rightDiff <= distance && rightDiff < bestDiffX) {
    snapX = canvas.width - widget.width;
    guides.x = canvas.width;
  }

  const topDiff = Math.abs(position.y);
  if (topDiff <= distance && topDiff < bestDiffY) {
    bestDiffY = topDiff;
    snapY = 0;
    guides.y = 0;
  }

  const bottom = position.y + widget.height;
  const bottomDiff = Math.abs(canvas.height - bottom);
  if (bottomDiff <= distance && bottomDiff < bestDiffY) {
    snapY = canvas.height - widget.height;
    guides.y = canvas.height;
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
  keepAspectRatio = false,
  aspectRatio,
}: {
  rect: Rect2D;
  handle: ResizeHandle;
  delta: Point2D;
  min: Size2D;
  keepAspectRatio?: boolean;
  aspectRatio?: number;
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

  if (!keepAspectRatio) {
    return next;
  }

  return enforceRectAspectRatioByHandle({
    rect: next,
    handle,
    initialRect: rect,
    min,
    aspectRatio,
  });
};

const isValidAspectRatio = (ratio?: number): ratio is number => typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0;

const minWidthForAspect = (min: Size2D, ratio: number): number => Math.max(min.width, min.height * ratio);

const buildAspectGridUnits = ({
  initialRect,
  min,
  snap,
}: {
  initialRect: Rect2D;
  min: Size2D;
  snap: number;
}) => {
  const widthRef = Math.max(1, Math.round(initialRect.width));
  const heightRef = Math.max(1, Math.round(initialRect.height));
  const divisor = integerGcd(widthRef, heightRef);
  const ratioWidth = Math.max(1, widthRef / divisor);
  const ratioHeight = Math.max(1, heightRef / divisor);

  const tWidth = snap / integerGcd(ratioWidth, snap);
  const tHeight = snap / integerGcd(ratioHeight, snap);
  const tStep = integerLcm(tWidth, tHeight);

  const widthUnit = ratioWidth * tStep;
  const heightUnit = ratioHeight * tStep;

  return {
    widthUnit,
    heightUnit,
    minMultiplier: Math.max(
      1,
      Math.ceil(min.width / widthUnit),
      Math.ceil(min.height / heightUnit),
    ),
  };
};

export const resolveEffectiveResizeHandle = ({
  handle,
  rect,
  canvas,
  allowExitBorders,
}: {
  handle: ResizeHandle;
  rect: Rect2D;
  canvas: Size2D;
  allowExitBorders: boolean;
}): ResizeHandle => {
  if (allowExitBorders || handle.includes('-')) {
    return handle;
  }

  const rect_bottom = rect.y + rect.height;
  const rect_right = rect.x + rect.width;

  if (handle === 'right') {
    return rect_bottom >= canvas.height ? 'top-right' : 'bottom-right';
  }
  if (handle === 'left') {
    return rect_bottom >= canvas.height ? 'top-left' : 'bottom-left';
  }
  if (handle === 'top') {
    return rect_right >= canvas.width ? 'top-left' : 'top-right';
  }
  if (handle === 'bottom') {
    return rect_right >= canvas.width ? 'bottom-left' : 'bottom-right';
  }

  return handle;
};

const resolveAspectMaxWidthByHandle = ({
  handle,
  initialRect,
  canvas,
  ratio,
}: {
  handle: ResizeHandle;
  initialRect: Rect2D;
  canvas: Size2D;
  ratio: number;
}): number => {
  const hasLeft = handle.includes('left');
  const hasRight = handle.includes('right');
  const hasTop = handle.includes('top');
  const hasBottom = handle.includes('bottom');

  const right = initialRect.x + initialRect.width;
  const bottom = initialRect.y + initialRect.height;

  if ((hasLeft || hasRight) && (hasTop || hasBottom)) {
    const maxByX = hasLeft ? right : canvas.width - initialRect.x;
    const maxByY = (hasTop ? bottom : canvas.height - initialRect.y) * ratio;
    return Math.max(0, Math.min(maxByX, maxByY));
  }

  if (hasLeft || hasRight) {
    const maxByX = hasLeft ? right : canvas.width - initialRect.x;
    const centerY = initialRect.y + initialRect.height / 2;
    const verticalRoom = 2 * Math.min(centerY, canvas.height - centerY);
    const maxByY = Math.max(0, verticalRoom) * ratio;
    return Math.max(0, Math.min(maxByX, maxByY));
  }

  if (hasTop || hasBottom) {
    const maxByY = (hasTop ? bottom : canvas.height - initialRect.y) * ratio;
    const centerX = initialRect.x + initialRect.width / 2;
    const horizontalRoom = 2 * Math.min(centerX, canvas.width - centerX);
    const maxByX = Math.max(0, horizontalRoom);
    return Math.max(0, Math.min(maxByX, maxByY));
  }

  return 0;
};

const placeRectByHandle = ({
  handle,
  initialRect,
  width,
  height,
}: {
  handle: ResizeHandle;
  initialRect: Rect2D;
  width: number;
  height: number;
}): Rect2D => {
  const hasLeft = handle.includes('left');
  const hasRight = handle.includes('right');
  const hasTop = handle.includes('top');
  const hasBottom = handle.includes('bottom');

  if ((hasLeft || hasRight) && (hasTop || hasBottom)) {
    const anchorX = hasLeft ? initialRect.x + initialRect.width : initialRect.x;
    const anchorY = hasTop ? initialRect.y + initialRect.height : initialRect.y;

    return {
      x: hasLeft ? anchorX - width : anchorX,
      y: hasTop ? anchorY - height : anchorY,
      width,
      height,
    };
  }

  if (hasLeft || hasRight) {
    const anchorX = hasLeft ? initialRect.x + initialRect.width : initialRect.x;
    const centerY = initialRect.y + initialRect.height / 2;

    return {
      x: hasLeft ? anchorX - width : anchorX,
      y: centerY - height / 2,
      width,
      height,
    };
  }

  if (hasTop || hasBottom) {
    const anchorY = hasTop ? initialRect.y + initialRect.height : initialRect.y;
    const centerX = initialRect.x + initialRect.width / 2;

    return {
      x: centerX - width / 2,
      y: hasTop ? anchorY - height : anchorY,
      width,
      height,
    };
  }

  return {
    x: initialRect.x,
    y: initialRect.y,
    width,
    height,
  };
};

export const enforceRectAspectRatioByHandle = ({
  rect,
  handle,
  initialRect,
  min,
  aspectRatio,
}: {
  rect: Rect2D;
  handle: ResizeHandle;
  initialRect: Rect2D;
  min: Size2D;
  aspectRatio?: number;
}): Rect2D => {
  if (!isValidAspectRatio(aspectRatio)) {
    return rect;
  }

  const ratio = aspectRatio;
  const minimumWidth = minWidthForAspect(min, ratio);

  const hasLeft = handle.includes('left');
  const hasRight = handle.includes('right');
  const hasTop = handle.includes('top');
  const hasBottom = handle.includes('bottom');

  if ((hasLeft || hasRight) && (hasTop || hasBottom)) {
    const widthDelta = Math.abs(rect.width - initialRect.width) / Math.max(1, initialRect.width);
    const heightDelta = Math.abs(rect.height - initialRect.height) / Math.max(1, initialRect.height);
    const widthDriven = widthDelta >= heightDelta;

    const width = Math.max(widthDriven ? rect.width : rect.height * ratio, minimumWidth);
    const height = width / ratio;
    return placeRectByHandle({
      handle,
      initialRect,
      width,
      height,
    });
  }

  if (hasLeft || hasRight) {
    const width = Math.max(rect.width, minimumWidth);
    const height = width / ratio;
    return placeRectByHandle({
      handle,
      initialRect,
      width,
      height,
    });
  }

  if (hasTop || hasBottom) {
    const height = Math.max(rect.height, minimumWidth / ratio);
    const width = height * ratio;
    return placeRectByHandle({
      handle,
      initialRect,
      width,
      height,
    });
  }

  return rect;
};

export const snapAspectResizedRectByHandle = ({
  rect,
  handle,
  initialRect,
  min,
  snap,
  aspectRatio,
}: {
  rect: Rect2D;
  handle: ResizeHandle;
  initialRect: Rect2D;
  min: Size2D;
  snap: number;
  aspectRatio?: number;
}): Rect2D => {
  if (snap <= 1 || !isValidAspectRatio(aspectRatio)) {
    return rect;
  }

  const {widthUnit, heightUnit, minMultiplier} = buildAspectGridUnits({
    initialRect,
    min,
    snap,
  });

  const hasHorizontal = handle.includes('left') || handle.includes('right');
  const hasVertical = handle.includes('top') || handle.includes('bottom');

  let rawMultiplier = rect.width / widthUnit;
  if (hasHorizontal && hasVertical) {
    const widthDelta = Math.abs(rect.width - initialRect.width) / Math.max(1, initialRect.width);
    const heightDelta = Math.abs(rect.height - initialRect.height) / Math.max(1, initialRect.height);
    rawMultiplier = widthDelta >= heightDelta ? rect.width / widthUnit : rect.height / heightUnit;
  } else if (!hasHorizontal && hasVertical) {
    rawMultiplier = rect.height / heightUnit;
  }

  const multiplier = Math.max(minMultiplier, Math.round(rawMultiplier));
  return placeRectByHandle({
    handle,
    initialRect,
    width: widthUnit * multiplier,
    height: heightUnit * multiplier,
  });
};

export const clampAspectResizedRectByHandle = ({
  rect,
  handle,
  initialRect,
  canvas,
  min,
  aspectRatio,
  snap,
}: {
  rect: Rect2D;
  handle: ResizeHandle;
  initialRect: Rect2D;
  canvas: Size2D;
  min: Size2D;
  aspectRatio?: number;
  snap?: number;
}): Rect2D => {
  if (!isValidAspectRatio(aspectRatio)) {
    return clampResizedRectByHandle({
      rect,
      handle,
      initialRect,
      canvas,
      min,
    });
  }

  const ratio = aspectRatio;
  const maxWidth = resolveAspectMaxWidthByHandle({
    handle,
    initialRect,
    canvas,
    ratio,
  });

  if (maxWidth <= 0) {
    return placeRectByHandle({
      handle,
      initialRect,
      width: 0,
      height: 0,
    });
  }

  const isVerticalOnly = !handle.includes('left') && !handle.includes('right') && (handle.includes('top') || handle.includes('bottom'));
  const requestedWidth = isVerticalOnly ? rect.height * ratio : rect.width;

  if (typeof snap === 'number' && snap > 1) {
    const {widthUnit, heightUnit, minMultiplier} = buildAspectGridUnits({
      initialRect,
      min,
      snap,
    });

    const maxMultiplier = Math.floor(maxWidth / widthUnit);
    if (maxMultiplier >= 1) {
      const rawMultiplier = requestedWidth / widthUnit;
      const lowerBound = Math.min(minMultiplier, maxMultiplier);
      const multiplier = clamp(Math.round(rawMultiplier), lowerBound, maxMultiplier);
      return placeRectByHandle({
        handle,
        initialRect,
        width: widthUnit * multiplier,
        height: heightUnit * multiplier,
      });
    }
  }

  const minWidth = minWidthForAspect(min, ratio);
  const clampedWidth = clamp(requestedWidth, Math.min(minWidth, maxWidth), maxWidth);
  return placeRectByHandle({
    handle,
    initialRect,
    width: clampedWidth,
    height: clampedWidth / ratio,
  });
};

export const snapResizedRectByHandle = ({
  rect,
  handle,
  initialRect,
  snap,
  min,
}: {
  rect: Rect2D;
  handle: ResizeHandle;
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
  handle: ResizeHandle;
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

/**
 * Snaps the moving edges of a resizing rect to the edges of sibling rects.
 * Only the edges affected by the given handle are considered.
 */
export const snapResizeRectToObjects = ({
  rect,
  handle,
  siblings,
  distance,
  min,
}: {
  rect: Rect2D;
  handle: ResizeHandle;
  siblings: Rect2D[];
  distance: number;
  min: Size2D;
}): RectSnapResult => {
  const hasLeft = handle.includes('left');
  const hasRight = handle.includes('right');
  const hasTop = handle.includes('top');
  const hasBottom = handle.includes('bottom');

  const guides: AxisGuides = {};
  const next = {...rect};
  const rightEdge = rect.x + rect.width;
  const bottomEdge = rect.y + rect.height;

  let bestDiffX = distance + 1;
  let snapX: number | null = null;
  let bestDiffY = distance + 1;
  let snapY: number | null = null;

  for (const sibling of siblings) {
    const sib = buildEdges(sibling);
    const sibXValues = [sib.left, sib.centerX, sib.right];
    const sibYValues = [sib.top, sib.centerY, sib.bottom];

    if (hasRight) {
      for (const sv of sibXValues) {
        const diff = Math.abs(rightEdge - sv);
        if (diff <= distance && diff < bestDiffX && sv - rect.x >= min.width) {
          bestDiffX = diff;
          snapX = sv;
          guides.x = sv;
        }
      }
    }

    if (hasLeft) {
      for (const sv of sibXValues) {
        const diff = Math.abs(rect.x - sv);
        if (diff <= distance && diff < bestDiffX && rightEdge - sv >= min.width) {
          bestDiffX = diff;
          snapX = sv;
          guides.x = sv;
        }
      }
    }

    if (hasBottom) {
      for (const sv of sibYValues) {
        const diff = Math.abs(bottomEdge - sv);
        if (diff <= distance && diff < bestDiffY && sv - rect.y >= min.height) {
          bestDiffY = diff;
          snapY = sv;
          guides.y = sv;
        }
      }
    }

    if (hasTop) {
      for (const sv of sibYValues) {
        const diff = Math.abs(rect.y - sv);
        if (diff <= distance && diff < bestDiffY && bottomEdge - sv >= min.height) {
          bestDiffY = diff;
          snapY = sv;
          guides.y = sv;
        }
      }
    }
  }

  if (snapX !== null) {
    if (hasRight) {
      next.width = snapX - next.x;
    } else if (hasLeft) {
      next.x = snapX;
      next.width = rightEdge - snapX;
    }
  }

  if (snapY !== null) {
    if (hasBottom) {
      next.height = snapY - next.y;
    } else if (hasTop) {
      next.y = snapY;
      next.height = bottomEdge - snapY;
    }
  }

  return {rect: next, guides};
};

/**
 * Snaps the moving edges of a resizing rect to the canvas borders.
 * Only the edges affected by the given handle are considered.
 */
export const snapResizeRectToBorders = ({
  rect,
  handle,
  canvas,
  distance,
  min,
}: {
  rect: Rect2D;
  handle: ResizeHandle;
  canvas: Size2D;
  distance: number;
  min: Size2D;
}): RectSnapResult => {
  const hasLeft = handle.includes('left');
  const hasRight = handle.includes('right');
  const hasTop = handle.includes('top');
  const hasBottom = handle.includes('bottom');

  const guides: AxisGuides = {};
  const next = {...rect};
  const rightEdge = rect.x + rect.width;
  const bottomEdge = rect.y + rect.height;

  if (hasLeft && Math.abs(rect.x) <= distance && rightEdge >= min.width) {
    next.x = 0;
    next.width = rightEdge;
    guides.x = 0;
  } else if (hasRight && Math.abs(rightEdge - canvas.width) <= distance && canvas.width - rect.x >= min.width) {
    next.width = canvas.width - rect.x;
    guides.x = canvas.width;
  }

  if (hasTop && Math.abs(rect.y) <= distance && bottomEdge >= min.height) {
    next.y = 0;
    next.height = bottomEdge;
    guides.y = 0;
  } else if (hasBottom && Math.abs(bottomEdge - canvas.height) <= distance && canvas.height - rect.y >= min.height) {
    next.height = canvas.height - rect.y;
    guides.y = canvas.height;
  }

  return {rect: next, guides};
};


