import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DEFAULT_TIMELINE_DURATION } from '../../../models/timeline.models';
import { formatAdaptiveTimelineTime } from '../../../utils/time-format.utils';

@Component({
  selector: 'app-timeline-time-labels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-time-labels.component.html',
  styleUrl: './timeline-time-labels.component.scss',
})
export class TimelineTimeLabelsComponent {

  readonly zoom = input(1);
  readonly step = input(100); // ms
  readonly stepPx = input(5); // px
  readonly maxMs = input(DEFAULT_TIMELINE_DURATION);
  readonly precision = input<'m' | 's' | 'ms' | 'timeline'>('s');
  readonly printEveryMs = input(1000);
  readonly visibleStartMs = input(0);
  readonly visibleEndMs = input(DEFAULT_TIMELINE_DURATION);

  private readonly virtualOverscanMs = computed(() => Math.max(100, this.printEveryMs()));

  private readonly visibleLabelsComputed = computed(() => {
    const maxMs = Math.max(1, this.maxMs());
    const printEveryRealMs = Math.max(100, this.printEveryMs());
    const stepScaledMs = printEveryRealMs;
    const overscan = this.virtualOverscanMs();
    const visibleStart = Math.max(0, this.visibleStartMs() - overscan);
    const visibleEnd = Math.min(maxMs, this.visibleEndMs() + overscan);
    const startMs = Math.max(0, Math.floor(visibleStart / stepScaledMs) * stepScaledMs);
    const endMs = Math.min(maxMs, Math.ceil(visibleEnd / stepScaledMs) * stepScaledMs);

    const labels: { leftPct: number; text: string }[] = [];
    for (let scaledMs = startMs; scaledMs <= endMs; scaledMs += stepScaledMs) {
      labels.push({
        leftPct: (scaledMs / maxMs) * 100,
        text: this.printTimeValue(scaledMs),
      });
    }


    return labels;
  });

  visibleLabels(): { leftPct: number; text: string }[] {
    return this.visibleLabelsComputed();
  }

  printTimeValue(timeMs: number): string {
    let value: number;
    let unit: string;

    switch (this.precision()) {
      case 'm':
        value = timeMs / (1000 * 60);
        unit = 'm';
        break;
      case 's':
        value = timeMs / 1000;
        unit = 's';
        break;
      case 'timeline': {
        return formatAdaptiveTimelineTime(timeMs);
      }
      case 'ms':
      default:
        value = timeMs;
        unit = 'ms';
    }

    return `${Math.round(value * 10) / 10}${unit}`;
  }
}
