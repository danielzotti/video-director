import { resolveTimelineVideoSyncState } from './video-timeline-sync.utils';

describe('resolveTimelineVideoSyncState', () => {
  it('maps timeline offset to media time', () => {
    const result = resolveTimelineVideoSyncState({
      timelineTimeMs: 4_000,
      timelineDurationMs: 30_000,
      widgetStartMs: 3_000,
      widgetEndMs: 10_000,
      mediaDurationSeconds: 8,
    });

    expect(result.mediaTimeSeconds).toBeCloseTo(1, 6);
    expect(result.shouldPlay).toBeTrue();
    expect(result.isActiveInTimeline).toBeTrue();
  });

  it('stays at the first frame before the widget start time', () => {
    const result = resolveTimelineVideoSyncState({
      timelineTimeMs: 2_000,
      timelineDurationMs: 30_000,
      widgetStartMs: 3_000,
      widgetEndMs: 10_000,
      mediaDurationSeconds: 8,
    });

    expect(result.mediaTimeSeconds).toBe(0);
    expect(result.shouldPlay).toBeFalse();
    expect(result.isActiveInTimeline).toBeFalse();
  });

  it('clamps to the final media frame after the media duration when loop is disabled', () => {
    const result = resolveTimelineVideoSyncState({
      timelineTimeMs: 8_000,
      timelineDurationMs: 30_000,
      widgetStartMs: 3_000,
      widgetEndMs: 12_000,
      mediaDurationSeconds: 3,
      loop: false,
    });

    expect(result.mediaTimeSeconds).toBe(3);
    expect(result.shouldPlay).toBeFalse();
    expect(result.isActiveInTimeline).toBeTrue();
  });

  it('wraps media time when loop is enabled', () => {
    const result = resolveTimelineVideoSyncState({
      timelineTimeMs: 8_500,
      timelineDurationMs: 30_000,
      widgetStartMs: 3_000,
      widgetEndMs: 12_000,
      mediaDurationSeconds: 2,
      loop: true,
    });

    expect(result.mediaTimeSeconds).toBeCloseTo(1.5, 6);
    expect(result.shouldPlay).toBeTrue();
    expect(result.isActiveInTimeline).toBeTrue();
  });

  it('normalizes reversed layer bounds', () => {
    const result = resolveTimelineVideoSyncState({
      timelineTimeMs: 4_000,
      timelineDurationMs: 30_000,
      widgetStartMs: 8_000,
      widgetEndMs: 3_000,
      mediaDurationSeconds: 10,
    });

    expect(result.mediaTimeSeconds).toBeCloseTo(1, 6);
    expect(result.shouldPlay).toBeTrue();
    expect(result.isActiveInTimeline).toBeTrue();
  });
});
