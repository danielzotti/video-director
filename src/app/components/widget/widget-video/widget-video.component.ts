import {ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input} from '@angular/core';
import {WidgetVideoContent} from '../../../models/canvas-widget-state.models';
import {CanvasService} from '../../../services/canvas.service';

@Component({
  selector: 'app-widget-video',
  standalone: true,
  templateUrl: './widget-video.component.html',
  styleUrl: './widget-video.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.overflow]': '"hidden"',
  },
})
export class WidgetVideoComponent {
  private readonly canvasService = inject(CanvasService);
  private readonly destroyRef = inject(DestroyRef);
  private videoElement: HTMLVideoElement | null = null;

  widgetId = input.required<string>();
  content = input.required<WidgetVideoContent>();

  constructor() {
    effect(() => {
      if (this.isUrlValid || !this.videoElement) {
        return;
      }

      this.canvasService.unregisterWidgetVideoElement(this.widgetId(), this.videoElement);
      this.videoElement = null;
    });

    this.destroyRef.onDestroy(() => {
      if (!this.videoElement) {
        return;
      }

      this.canvasService.unregisterWidgetVideoElement(this.widgetId(), this.videoElement);
      this.videoElement = null;
    });
  }

  protected get isUrlValid(): boolean {
    return this.canvasService.isValidVideoUrl(this.content().src);
  }

  protected onVideoReady(event: Event): void {
    const element = event.currentTarget as HTMLVideoElement | null;
    if (!element) {
      return;
    }

    this.videoElement = element;
    this.canvasService.registerWidgetVideoElement(this.widgetId(), element);
  }

  protected onVideoPlaybackChanged(isPlaying: boolean): void {
    this.canvasService.setWidgetVideoPlaybackState(this.widgetId(), isPlaying);
  }

  protected onVideoTimeUpdate(event: Event): void {
    const element = event.currentTarget as HTMLVideoElement;
    this.canvasService.setWidgetVideoTimeState(this.widgetId(), element.currentTime);
  }

  protected onVideoDurationChange(event: Event): void {
    const element = event.currentTarget as HTMLVideoElement;
    const duration = isFinite(element.duration) ? element.duration : 0;
    this.canvasService.setWidgetVideoDurationState(this.widgetId(), duration);
  }

  protected onVideoVolumeChange(event: Event): void {
    const element = event.currentTarget as HTMLVideoElement;
    this.canvasService.setWidgetVideoVolumeState(this.widgetId(), element.muted ? 0 : element.volume);
  }
}

