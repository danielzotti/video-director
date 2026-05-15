import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DEFAULT_TIMELINE_DURATION } from '../../../models/timeline.models';

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
  readonly precision = input<'m' | 's' | 'ms'>('s');
  readonly printEveryMs = input(1000);

  readonly groups = computed(() => {
    const count = Math.ceil(this.maxMs() / this.step());
    return [...Array(Math.max(1, count)).keys()];
  });

  readonly labelWidth = computed(() => {
    const count = Math.ceil(this.maxMs() / this.step());
    return `${100 / Math.max(1, count)}%`;
  });

  printTimeWithUnit(index: number): string {
    const ms = index * this.step();
    return (ms / this.zoom()) % this.printEveryMs() === 0
      ? this.printTimeValue(ms)
      : '';
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
      case 'ms':
      default:
        value = timeMs;
        unit = 'ms';
    }

    return `${Math.round((value / this.zoom()) * 10) / 10}${unit}`;
  }
}
