export interface TimelineVideoSyncInput {
  timelineTimeMs: number;
  timelineDurationMs: number;
  widgetStartMs?: number;
  widgetEndMs?: number;
  mediaDurationSeconds?: number;
  loop?: boolean;
}

export interface TimelineVideoSyncState {
  mediaTimeSeconds: number;
  shouldPlay: boolean;
  isActiveInTimeline: boolean;
}

/**
 * Maps the current timeline playhead to the corresponding media time for a video widget.
 * Timeline start/end are expressed in ms, while media time is returned in seconds.
 */
export const resolveTimelineVideoSyncState = ({
  timelineTimeMs,
  timelineDurationMs,
  widgetStartMs,
  widgetEndMs,
  mediaDurationSeconds,
  loop = false,
}: TimelineVideoSyncInput): TimelineVideoSyncState => {
  const timelineDuration = normalizeMilliseconds(timelineDurationMs, 0);
  const currentTimelineTime = clamp(normalizeMilliseconds(timelineTimeMs, 0), 0, timelineDuration);

  const rawStart = normalizeMilliseconds(widgetStartMs, 0);
  const rawEnd = normalizeMilliseconds(widgetEndMs, timelineDuration);
  const startMs = clamp(Math.min(rawStart, rawEnd), 0, timelineDuration);
  const endMs = clamp(Math.max(rawStart, rawEnd), 0, timelineDuration);
  const relativeSeconds = Math.max(0, currentTimelineTime - startMs) / 1000;
  const mediaDuration = normalizeSeconds(mediaDurationSeconds, 0);
  const isActiveInTimeline = currentTimelineTime >= startMs && currentTimelineTime < endMs;

  let mediaTimeSeconds = 0;

  if (relativeSeconds > 0) {
    if (loop && mediaDuration > 0) {
      mediaTimeSeconds = relativeSeconds % mediaDuration;
    } else if (mediaDuration > 0) {
      mediaTimeSeconds = Math.min(relativeSeconds, mediaDuration);
    } else {
      mediaTimeSeconds = relativeSeconds;
    }
  }

  const shouldPlay = isActiveInTimeline && (loop || mediaDuration <= 0 || relativeSeconds < mediaDuration);

  return {
    mediaTimeSeconds,
    shouldPlay,
    isActiveInTimeline,
  };
};

const normalizeMilliseconds = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(Number(value)));
};

const normalizeSeconds = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Number(value));
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
