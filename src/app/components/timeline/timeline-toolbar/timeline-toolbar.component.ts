import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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

  readonly isPlaying = this.timelineService.isPlaying;
  readonly time = this.timelineService.time;
  readonly duration = this.timelineService.duration;
  readonly zoom = this.timelineService.zoom;

  readonly maxZoom = 10;
  readonly stepValue = 1;
  readonly compactFormat = TIMER_FORMAT.compact;

  onPlayClick(): void {
    this.timelineService.play();
  }

  onPauseClick(): void {
    this.timelineService.pause();
  }

  onResetTimeClick(): void {
    this.timelineService.resetTime();
  }

  onZoomSliderChange(event: Event): void {
    this.timelineService.setZoom(+(event.target as HTMLInputElement).value);
  }

  zoomIn(): void {
    this.timelineService.setZoom(Math.min(this.maxZoom, this.zoom() + 1));
  }

  zoomOut(): void {
    this.timelineService.setZoom(Math.max(1, this.zoom() - 1));
  }
}
