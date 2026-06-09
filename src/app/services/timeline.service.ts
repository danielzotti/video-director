import { computed, inject, Injectable, signal } from '@angular/core';
import { CanvasWidgetStateService } from './canvas-widget-state.service';
import { DEFAULT_TIMELINE_DURATION, TimelineWidget } from '../models/timeline.models';

@Injectable({ providedIn: 'root' })
export class TimelineService {
  private readonly widgetStateService = inject(CanvasWidgetStateService);
  private readonly minTimelineStepMs = 100;
  private readonly targetStepPxAtMaxZoom = 50;

  private readonly _time = signal(0);
  private readonly _duration = signal(DEFAULT_TIMELINE_DURATION);
  private readonly _isPlaying = signal(false);
  private readonly _zoom = signal(1);
  private readonly _showAllWidgets = signal(false);
  private readonly _maxZoom = signal(10);

  /** Master toggle for all timeline snapping modes. */
  private readonly _snapEnabled = signal(true);

  readonly time = this._time.asReadonly();
  readonly duration = this._duration.asReadonly();
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly zoom = this._zoom.asReadonly();
  readonly showAllWidgets = this._showAllWidgets.asReadonly();
  readonly maxZoom = this._maxZoom.asReadonly();
  readonly snapEnabled = this._snapEnabled.asReadonly();
  readonly snapToSeconds = computed(() => this._snapEnabled());
  readonly snapToLayers = computed(() => this._snapEnabled());

  /**
   * All canvas widgets mapped to TimelineWidget with guaranteed
   * timelineStart / timelineEnd values (defaults to 0 / duration).
   * Sorted by z-index in descending order (same as layers panel).
   */
  readonly layers = computed<TimelineWidget[]>(() =>
    [...this.widgetStateService.list()]
      .sort((a, b) => b.z - a.z)
      .map(w => ({
        ...w,
        timelineStart: w.timelineStart ?? 0,
        timelineEnd: w.timelineEnd ?? this._duration(),
      }))
  );

  /**
   * Minimum zoom level is always 1.
   * The viewport is scrollable, so long timelines don't need zoom-out compensation.
   */
  readonly minZoom = computed(() => 1);

  private timer: ReturnType<typeof setInterval> | null = null;
  /** Resolution of the internal playback timer in ms. */
  private readonly tickMs = 100;

  /** Start playback from the current position. */
  play(): void {
    if (this._isPlaying()) return;
    this._isPlaying.set(true);
    this.timer = setInterval(() => {
      const next = this._time() + this.tickMs;
      if (next >= this._duration()) {
        this._time.set(this._duration());
        this.pause();
        return;
      }
      this._time.set(next);
    }, this.tickMs);
  }

  /** Pause playback at the current position. */
  pause(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._isPlaying.set(false);
  }

  /** Move the playhead to a specific time (clamped to 0..duration). */
  setTime(time: number): void {
    this._time.set(Math.max(0, Math.min(time, this._duration())));
  }

  /** Stop playback and rewind to the beginning. */
  resetTime(): void {
    this.pause();
    this._time.set(0);
  }

  /** Set zoom level (clamped to minZoom..maxZoom). */
  setZoom(zoom: number): void {
    const min = this.minZoom();
    const max = this._maxZoom();
    this._zoom.set(Math.max(min, Math.min(max, zoom)));
  }

  /**
   * Update maxZoom based on viewport width and duration.
   * Formula: maxZoom = ceil((duration * targetStepPx) / (viewportWidth * 100ms)).
   * At max zoom, a 100ms step is about 50px wide for precise sub-second navigation.
   */
  setMaxZoom(viewportWidth: number): void {
    const duration = this._duration();
    const safeViewport = Math.max(1, viewportWidth);
    const calc = Math.ceil(
      (duration * this.targetStepPxAtMaxZoom) / (safeViewport * this.minTimelineStepMs)
    );
    const newMaxZoom = Math.max(1, calc);
    this._maxZoom.set(newMaxZoom);

    // Clamp current zoom if it exceeds new maxZoom
    if (this._zoom() > newMaxZoom) {
      this._zoom.set(newMaxZoom);
    }
  }

  /** Set the total duration of the timeline in ms (min 1 000 ms). */
  setDuration(duration: number): void {
    this._duration.set(Math.max(1000, duration));
    this.setZoom(this._zoom());
  }

  /** Override timeline visibility and force all canvas widgets to be visible. */
  setShowAllWidgets(value: boolean): void {
    this._showAllWidgets.set(value);
  }

  /** Toggle all timeline snapping modes at once. */
  setSnapEnabled(value: boolean): void {
    this._snapEnabled.set(value);
  }

  /** Toggle snapping to whole-second boundaries. Kept for API compatibility. */
  setSnapToSeconds(value: boolean): void {
    this.setSnapEnabled(value);
  }

  /** Toggle snapping to the start/end edges of other layers. Kept for API compatibility. */
  setSnapToLayers(value: boolean): void {
    this.setSnapEnabled(value);
  }

  /**
   * Persist updated start/end times for a widget.
   * Values are clamped to [0, duration] and rounded to the nearest 100ms
   * (tenth-of-second precision is the minimum granularity for all layers).
   */
  updateLayerTiming(uuid: string, timelineStart: number, timelineEnd: number): void {
    const widget = this.widgetStateService.getById(uuid);
    if (!widget) return;

    const roundTo100 = (ms: number) => Math.round(ms / 100) * 100;
    this.widgetStateService.update({
      ...widget,
      timelineStart: Math.max(0, roundTo100(timelineStart)),
      timelineEnd: Math.min(roundTo100(timelineEnd), this._duration()),
    });
  }

  /** Delegate layer reorder to CanvasWidgetStateService. */
  reorderLayers(uuid: string, targetIndex: number): void {
    this.widgetStateService.reorderLayerToIndex(uuid, targetIndex);
  }
}

