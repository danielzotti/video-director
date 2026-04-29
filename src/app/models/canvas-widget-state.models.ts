import {Point2D, Rect2D} from './geometry.models';

export type WidgetState = Record<string, WidgetStateItem>;
export type WidgetStateList = WidgetStateItem[];

export interface WidgetStateItemPosition extends Point2D {
  z: number;
}

export interface WidgetStateItemSize {
  width: number;
  height: number;
}

export interface WidgetStateItemSizeAndPosition extends WidgetStateItemPosition, WidgetStateItemSize {}

export interface WidgetStateItemStyle {
  background: string;
  borderRadius: string;
  borderWidth: string;
}

export interface WidgetStateItem extends Rect2D, Partial<WidgetStateItemStyle> {
  uuid: string;
  z: number;
}
