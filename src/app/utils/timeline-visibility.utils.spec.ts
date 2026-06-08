import { isWidgetVisibleInTimelineWindow } from './timeline-visibility.utils';

describe('timeline-visibility.utils', () => {
  it('hides widget before timelineStart', () => {
    const isVisible = isWidgetVisibleInTimelineWindow({
      widget: { timelineStart: 10_000, timelineEnd: 20_000 },
      timeMs: 5_000,
      durationMs: 30_000,
    });

    expect(isVisible).toBeFalse();
  });

  it('shows widget inside configured interval', () => {
    const isVisible = isWidgetVisibleInTimelineWindow({
      widget: { timelineStart: 10_000, timelineEnd: 20_000 },
      timeMs: 15_000,
      durationMs: 30_000,
    });

    expect(isVisible).toBeTrue();
  });

  it('uses [0, duration] when start/end are missing', () => {
    expect(
      isWidgetVisibleInTimelineWindow({
        widget: {},
        timeMs: 0,
        durationMs: 30_000,
      }),
    ).toBeTrue();

    expect(
      isWidgetVisibleInTimelineWindow({
        widget: {},
        timeMs: 30_000,
        durationMs: 30_000,
      }),
    ).toBeTrue();
  });

  it('normalizes reversed start/end values', () => {
    const isVisible = isWidgetVisibleInTimelineWindow({
      widget: { timelineStart: 20_000, timelineEnd: 10_000 },
      timeMs: 15_000,
      durationMs: 30_000,
    });

    expect(isVisible).toBeTrue();
  });
});

