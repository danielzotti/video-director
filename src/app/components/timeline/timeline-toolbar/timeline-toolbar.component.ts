import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TimelineService } from '../../../services/timeline.service';
import { TimerPipe, TIMER_FORMAT } from '../../../pipes/timer.pipe';
import { UiIconComponent } from '../../../ui';

@Component({
  selector: 'app-timeline-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent, TimerPipe],
  templateUrl: './timeline-toolbar.component.html',
  styleUrl: './timeline-toolbar.component.scss',
})
export class TimelineToolbarComponent {
  private readonly timelineService = inject(TimelineService);
  readonly sliderMin = 0;
  readonly sliderMax = 100;

  readonly isPlaying = this.timelineService.isPlaying;
  readonly time = this.timelineService.time;
  readonly duration = this.timelineService.duration;
  readonly zoom = this.timelineService.zoom;
  readonly minZoom = this.timelineService.minZoom;
  readonly maxZoom = this.timelineService.maxZoom;
  readonly showAllWidgets = this.timelineService.showAllWidgets;
  readonly snapToSeconds = this.timelineService.snapToSeconds;
  readonly snapToLayers = this.timelineService.snapToLayers;

  readonly stepValue = 1;
  readonly compactFormat = TIMER_FORMAT.compact;
  readonly zoomDisplay = computed(() => Math.round(this.zoom() * 100) / 100);
  readonly zoomSliderValue = computed(() => this.zoomToSliderValue(this.zoom()));

  onPlayClick(): void {
    this.timelineService.play();
  }

  onPauseClick(): void {
    this.timelineService.pause();
  }

  onResetTimeClick(): void {
    this.timelineService.resetTime();
  }

  onShowAllWidgetsChanged(event: Event): void {
    this.timelineService.setShowAllWidgets((event.target as HTMLInputElement).checked);
  }

  onSnapToSecondsChanged(event: Event): void {
    this.timelineService.setSnapToSeconds((event.target as HTMLInputElement).checked);
  }

  onSnapToLayersChanged(event: Event): void {
    this.timelineService.setSnapToLayers((event.target as HTMLInputElement).checked);
  }

  onZoomSliderChange(event: Event): void {
    const sliderValue = +(event.target as HTMLInputElement).value;
    this.timelineService.setZoom(this.sliderValueToZoom(sliderValue));
  }

  zoomIn(): void {
    this.timelineService.setZoom(Math.min(this.maxZoom(), this.zoom() + 1));
  }

  zoomOut(): void {
    this.timelineService.setZoom(Math.max(this.minZoom(), this.zoom() - 1));
  }

  private sliderValueToZoom(value: number): number {
    const min = this.minZoom();
    const max = Math.max(min, this.maxZoom());
    if (max <= min) {
      return min;
    }

    const clamped = Math.max(this.sliderMin, Math.min(this.sliderMax, value));
    const t = (clamped - this.sliderMin) / (this.sliderMax - this.sliderMin);
    const zoom = min * Math.pow(max / min, t);
    return Math.round(zoom * 100) / 100;
  }

  private zoomToSliderValue(zoom: number): number {
    const min = this.minZoom();
    const max = Math.max(min, this.maxZoom());
    if (max <= min) {
      return this.sliderMin;
    }

    const clampedZoom = Math.max(min, Math.min(max, zoom));
    const t = Math.log(clampedZoom / min) / Math.log(max / min);
    return this.sliderMin + t * (this.sliderMax - this.sliderMin);
  }
}
