import { computed, inject, Injectable, signal } from '@angular/core';
import { CanvasWidgetStateService } from './canvas-widget-state.service';
import { DEFAULT_TIMELINE_DURATION, TimelineWidget } from '../models/timeline.models';

@Injectable({ providedIn: 'root' })
export class TimelineService {
  private readonly widgetStateService = inject(CanvasWidgetStateService);

  private readonly _time = signal(0);
  private readonly _duration = signal(DEFAULT_TIMELINE_DURATION);
  private readonly _isPlaying = signal(false);
  private readonly _zoom = signal(1);

  readonly time = this._time.asReadonly();
  readonly duration = this._duration.asReadonly();
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly zoom = this._zoom.asReadonly();

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

  /** Set zoom level (clamped to 1..10). */
  setZoom(zoom: number): void {
    this._zoom.set(Math.max(1, Math.min(10, zoom)));
  }

  /** Set the total duration of the timeline in ms (min 1 000 ms). */
  setDuration(duration: number): void {
    this._duration.set(Math.max(1000, duration));
  }

  /**
   * Persist updated start/end times for a widget.
   * Values are clamped to [0, duration].
   */
  updateLayerTiming(uuid: string, timelineStart: number, timelineEnd: number): void {
    const widget = this.widgetStateService.getById(uuid);
    if (!widget) return;

    this.widgetStateService.update({
      ...widget,
      timelineStart: Math.max(0, Math.round(timelineStart)),
      timelineEnd: Math.min(Math.round(timelineEnd), this._duration()),
    });
  }

  /** Delegate layer reorder to CanvasWidgetStateService. */
  reorderLayers(uuid: string, targetIndex: number): void {
    this.widgetStateService.reorderLayerToIndex(uuid, targetIndex);
  }
}

