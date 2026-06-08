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

  private readonly visibleLabelsComputed = computed(() => {
    const zoom = Math.max(1, this.zoom());
    const maxMs = Math.max(1, this.maxMs());
    const printEveryRealMs = Math.max(100, this.printEveryMs());
    const stepScaledMs = printEveryRealMs * zoom;

    const labels: { leftPct: number; text: string }[] = [];
    for (let scaledMs = 0; scaledMs <= maxMs; scaledMs += stepScaledMs) {
      labels.push({
        leftPct: (scaledMs / maxMs) * 100,
        text: this.printTimeValue(scaledMs),
      });
    }

    // Ensure the last time label is always present at timeline end.
    const lastLabel = labels.at(-1);
    if (!lastLabel || lastLabel.leftPct < 100) {
      labels.push({
        leftPct: 100,
        text: this.printTimeValue(maxMs),
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
      case 'ms':
      default:
        value = timeMs;
        unit = 'ms';
    }

    return `${Math.round((value / this.zoom()) * 10) / 10}${unit}`;
  }
}
