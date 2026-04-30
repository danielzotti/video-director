export interface Point2D {
  x: number;
  y: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface Rect2D extends Point2D, Size2D {}

export type ResizeHandle =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';

export interface AxisGuides {
  x?: number;
  y?: number;
}

export interface SnapResult {
  point: Point2D;
  guides: AxisGuides;
}

