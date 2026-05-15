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
  readonly stepPx = input(5); // 5 px per step
  readonly maxMs = input(DEFAULT_TIMELINE_DURATION);
  readonly isHeader = input(false);
  readonly markersEvery = input(10);

  readonly spaceBetweenMarkers = computed(() => this.step() / this.maxMs());
  readonly spaceBetweenMainMarkers = computed(() =>
    (this.step() / this.maxMs()) * this.markersEvery()
  );
}
