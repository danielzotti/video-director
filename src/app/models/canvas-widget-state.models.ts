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
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  borderStyle: WidgetBorderStyle;
  padding: number;
}

export const WIDGET_BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted'] as const;
export type WidgetBorderStyle = typeof WIDGET_BORDER_STYLES[number];

export const DEFAULT_WIDGET_BORDER: Pick<WidgetStateItemStyle, 'borderRadius' | 'borderWidth' | 'borderColor' | 'borderStyle' | 'padding'> = {
  borderRadius: 0,
  borderWidth: 0,
  borderColor: '#000000',
  borderStyle: 'none',
  padding: 0,
};

export const WIDGET_CONTENT_TYPES = ['text', 'image', 'video'] as const;
export type WidgetContentType = typeof WIDGET_CONTENT_TYPES[number];

export const WIDGET_IMAGE_FIT_MODES = ['cover', 'contain'] as const;
export type WidgetImageFitMode = typeof WIDGET_IMAGE_FIT_MODES[number];

export const WIDGET_TEXT_FONT_FAMILIES = ['roboto', 'montserrat', 'exo', 'lora', 'fira-code'] as const;
export type WidgetTextFontFamily = typeof WIDGET_TEXT_FONT_FAMILIES[number];

export const WIDGET_TEXT_ALIGNMENTS_HORIZONTAL = ['left', 'center', 'right'] as const;
export type WidgetTextAlignmentHorizontal = typeof WIDGET_TEXT_ALIGNMENTS_HORIZONTAL[number];

export const WIDGET_TEXT_ALIGNMENTS_VERTICAL = ['top', 'center', 'bottom'] as const;
export type WidgetTextAlignmentVertical = typeof WIDGET_TEXT_ALIGNMENTS_VERTICAL[number];

export interface WidgetTextStyle {
  fontSize: number;
  fontFamily: WidgetTextFontFamily;
  color: string;
  autoSize: boolean;
  alignHorizontal: WidgetTextAlignmentHorizontal;
  alignVertical: WidgetTextAlignmentVertical;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  lineHeight: number;
}

export const DEFAULT_WIDGET_TEXT_STYLE: WidgetTextStyle = {
  fontSize: 24,
  fontFamily: 'roboto',
  color: '#000000',
  autoSize: false,
  alignHorizontal: 'center',
  alignVertical: 'center',
  bold: false,
  italic: false,
  underline: false,
  lineHeight: 1.2,
};

export interface WidgetTextContent {
  type: 'text';
  text: string;
  style: WidgetTextStyle;
}

export interface WidgetImageContent {
  type: 'image';
  src: string;
  alt?: string;
  fitMode: WidgetImageFitMode;
  offsetX?: number;
  offsetY?: number;
}

export interface WidgetVideoContent {
  type: 'video';
  src: string;
  poster?: string;
  fitMode: WidgetImageFitMode;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controls: boolean;
  offsetX?: number;
  offsetY?: number;
}

export type WidgetContent = WidgetTextContent | WidgetImageContent | WidgetVideoContent;

export const DEFAULT_WIDGET_TEXT = 'Nuovo widget';
export const DEFAULT_WIDGET_CONTENT: WidgetContent = {
  type: 'text',
  text: DEFAULT_WIDGET_TEXT,
  style: DEFAULT_WIDGET_TEXT_STYLE,
};

export const DEFAULT_WIDGET_VIDEO_CONTENT: WidgetVideoContent = {
  type: 'video',
  src: '',
  poster: '',
  fitMode: 'cover',
  autoplay: false,
  loop: false,
  muted: true,
  controls: true,
};

export interface WidgetStateItem extends Rect2D, Partial<WidgetStateItemStyle> {
  uuid: string;
  z: number;
  locked?: boolean;
  visible?: boolean;
  content: WidgetContent;
  name?: string;
}
