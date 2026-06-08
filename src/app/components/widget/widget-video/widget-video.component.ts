import {ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input} from '@angular/core';
import {WidgetVideoContent} from '../../../models/canvas-widget-state.models';
import {CanvasService} from '../../../services/canvas.service';

@Component({
  selector: 'app-widget-video',
  standalone: true,
  templateUrl: './widget-video.component.html',
  styleUrl: './widget-video.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.border-radius.px]': 'innerBorderRadius()',
    '[style.overflow]': '"hidden"',
  },
})
export class WidgetVideoComponent {
  private static readonly FIRST_FRAME_SEEK_SECONDS = 0.001;

  private readonly canvasService = inject(CanvasService);
  private readonly destroyRef = inject(DestroyRef);
  private videoElement: HTMLVideoElement | null = null;

  widgetId = input.required<string>();
  content = input.required<WidgetVideoContent>();
  borderRadius = input(0);
  borderWidth = input(0);

  /** Inner border-radius = max(0, borderRadius - borderWidth) to follow the widget border curve. */
  protected readonly innerBorderRadius = computed(() =>
    Math.max(0, this.borderRadius() - this.borderWidth()),
  );

  protected readonly coverObjectPosition = computed(() => {
    const content = this.content();
    if (content.fitMode !== 'cover' && content.fitMode !== 'crop') {
      return '50% 50%';
    }

    const offsetX = typeof content.offsetX === 'number' ? content.offsetX : -50;
    const offsetY = typeof content.offsetY === 'number' ? content.offsetY : -50;

    return `${-offsetX}% ${-offsetY}%`;
  });

  protected readonly mediaObjectFit = computed(() => {
    const fitMode = this.content().fitMode;
    return fitMode === 'crop' ? 'cover' : fitMode;
  });

  protected readonly mediaTransform = computed(() => {
    const content = this.content();
    if (content.fitMode !== 'crop') {
      return 'none';
    }

    const zoom = Number.isFinite(content.cropZoom) ? Math.max(1, Math.min(10, content.cropZoom as number)) : 1;
    return `scale(${zoom})`;
  });

  protected readonly mediaTransformOrigin = computed(() => this.coverObjectPosition());

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

  protected onVideoMetadataReady(event: Event): void {
    const element = event.currentTarget as HTMLVideoElement | null;
    if (!element) {
      return;
    }

    this.onVideoReady(event);
    this.ensureFirstFramePreview(element);
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
    this.canvasService.setWidgetVideoVolumeState(this.widgetId(), element.volume);
  }

  private ensureFirstFramePreview(element: HTMLVideoElement): void {
    if (this.content().autoplay || element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    const previewTime = Math.min(WidgetVideoComponent.FIRST_FRAME_SEEK_SECONDS, duration);
    if (previewTime <= 0 || element.currentTime > 0) {
      return;
    }

    // Safari can keep a black frame at t=0 until a tiny seek is applied.
    element.currentTime = previewTime;
  }
}

