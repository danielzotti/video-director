import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DEFAULT_TIMELINE_DURATION } from '../../../models/timeline.models';

@Component({
  selector: 'app-timeline-time-markers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-time-markers.component.html',
  styleUrl: './timeline-time-markers.component.scss',
})
export class TimelineTimeMarkersComponent {
  readonly zoom = input(1);
  readonly step = input(100); // 100 ms per step
  readonly maxMs = input(DEFAULT_TIMELINE_DURATION);
  readonly isHeader = input(false);
  readonly printEveryMs = input(1000);

  private readonly majorScaledStepMs = computed(() => {
    const quantum = Math.max(1, this.step());
    const desiredScaled = Math.max(quantum, this.printEveryMs() * Math.max(1, this.zoom()));
    return Math.max(quantum, Math.round(desiredScaled / quantum) * quantum);
  });

  private readonly minorScaledStepMs = computed(() => {
    const quantum = Math.max(1, this.step());
    const major = this.majorScaledStepMs();
    const desiredMinor = major / 5;
    const snapped = Math.max(quantum, Math.round(desiredMinor / quantum) * quantum);
    return Math.min(snapped, major);
  });

  private readonly majorMarkersComputed = computed(() => this.buildMarkers(this.majorScaledStepMs()));

  private readonly minorMarkersComputed = computed(() => {
    const minorStep = this.minorScaledStepMs();
    const majorStep = this.majorScaledStepMs();
    if (minorStep >= majorStep) {
      return [] as number[];
    }

    return this.buildMarkers(minorStep).filter((pct) => {
      const max = Math.max(1, this.maxMs());
      const ms = (pct / 100) * max;
      return Math.round(ms) % majorStep !== 0;
    });
  });

  private buildMarkers(intervalMs: number): number[] {
    const max = Math.max(1, this.maxMs());
    const safeInterval = Math.max(1, intervalMs);
    const points: number[] = [];

    for (let ms = 0; ms <= max; ms += safeInterval) {
      points.push((ms / max) * 100);
    }

    const last = points.at(-1) ?? 0;
    if (last < 100) {
      points.push(100);
    }

    return points;
  }

  majorMarkers(): number[] {
    return this.majorMarkersComputed();
  }

  minorMarkers(): number[] {
    return this.minorMarkersComputed();
  }
}
