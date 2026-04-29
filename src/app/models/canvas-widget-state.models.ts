export type WidgetState = Record<string, WidgetStateItem>;
export type WidgetStateList = WidgetStateItem[];

export interface WidgetStateItemPosition  {
  x: number;
  y: number;
  z: number;
}

export interface WidgetStateItemSize {
  width: number;
  height: number;
}

export interface WidgetStateItemSizeAndPosition extends WidgetStateItemPosition, WidgetStateItemSize {
}

export interface WidgetStateItemStyle {
  background: string;
  borderRadius: string;
  borderWidth: string;
}

export interface WidgetStateItem extends WidgetStateItemSizeAndPosition, Partial<WidgetStateItemStyle> {
  uuid: string;
}
