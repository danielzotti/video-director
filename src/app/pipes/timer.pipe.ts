import { Pipe, PipeTransform } from '@angular/core';
import { formatAdaptiveTimelineTime } from '../utils/time-format.utils';

export type TimerFormatType = 'default' | 'compact' | 'dynamic' | 'timeline';

/** Token object so templates can reference format keys without magic strings. */
export const TIMER_FORMAT: Record<TimerFormatType, TimerFormatType> = {
  default: 'default',
  compact: 'compact',
  dynamic: 'dynamic',
  timeline: 'timeline',
};

/**
 * Formats a millisecond value for display.
 *
 * - default → `MM:SS.d`  (e.g. "01:05.3")
 * - compact → `Xs`       (e.g. "65.3s")
 * - dynamic → `h:mm:ss` or `m:ss` depending on length (e.g. "1:30:00" or "2:10")
 * - timeline → adaptive `h:mm:ss.d` / `m:ss.d` / `s.d` (e.g. "1:02:25.2", "2:25.2", "25.2")
 */
@Pipe({
  name: 'timer',
  standalone: true,
  pure: true,
})
export class TimerPipe implements PipeTransform {
  transform(valueMs: number | null | undefined, format: TimerFormatType = 'default'): string {
    if (valueMs == null || !Number.isFinite(valueMs)) {
      return '—';
    }

    const ms = Math.max(0, Math.round(valueMs));

    if (format === 'compact') {
      const s = ms / 1000;
      return `${Math.round(s * 10) / 10}s`;
    }

    const totalSeconds = Math.floor(ms / 1000);

    if (format === 'dynamic') {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
      }
      return `${minutes}:${pad(seconds)}`;
    }

    if (format === 'timeline') {
      return formatAdaptiveTimelineTime(ms);
    }

    // default: MM:SS.d
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const deciseconds = Math.floor((ms % 1000) / 100);
    return `${pad(minutes)}:${pad(seconds)}.${deciseconds}`;
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

