import { WidgetStateItem } from './canvas-widget-state.models';

/** Default timeline duration in milliseconds (30 seconds). */
export const DEFAULT_TIMELINE_DURATION = 30_000;

/**
 * A WidgetStateItem with guaranteed (non-optional) timeline fields.
 * TimelineService maps all widgets to this type applying defaults.
 */
export type TimelineWidget = WidgetStateItem & {
  timelineStart: number;
  timelineEnd: number;
};

export interface TimelineLayersSortItem {
  uuid: string;
}

export type TimelineLayersSort = TimelineLayersSortItem[];

