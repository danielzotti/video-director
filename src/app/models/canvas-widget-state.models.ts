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

export const WIDGET_CONTENT_TYPES = ['text', 'image'] as const;
export type WidgetContentType = typeof WIDGET_CONTENT_TYPES[number];

export interface WidgetTextContent {
  type: 'text';
  text: string;
}

export interface WidgetImageContent {
  type: 'image';
  src: string;
  alt?: string;
}

export type WidgetContent = WidgetTextContent | WidgetImageContent;

export const DEFAULT_WIDGET_TEXT = 'Nuovo widget';
export const DEFAULT_WIDGET_CONTENT: WidgetContent = {
  type: 'text',
  text: DEFAULT_WIDGET_TEXT,
};

export interface WidgetStateItem extends Rect2D, Partial<WidgetStateItemStyle> {
  uuid: string;
  z: number;
  content: WidgetContent;
}
