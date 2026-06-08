import { WidgetStateItem } from '../models/canvas-widget-state.models';

interface TimelineWindowInput {
  widget: Pick<WidgetStateItem, 'timelineStart' | 'timelineEnd'>;
  timeMs: number;
  durationMs: number;
}

/**
 * Returns whether a widget should be visible at a given timeline time.
 * The start/end bounds are inclusive and default to [0, duration].
 */
export const isWidgetVisibleInTimelineWindow = ({
  widget,
  timeMs,
  durationMs,
}: TimelineWindowInput): boolean => {
  const duration = normalizeMs(durationMs, 0);
  const currentTime = clamp(normalizeMs(timeMs, 0), 0, duration);

  const rawStart = normalizeMs(widget.timelineStart, 0);
  const rawEnd = normalizeMs(widget.timelineEnd, duration);
  const start = clamp(Math.min(rawStart, rawEnd), 0, duration);
  const end = clamp(Math.max(rawStart, rawEnd), 0, duration);

  return currentTime >= start && currentTime <= end;
};

const normalizeMs = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(Number(value)));
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);


