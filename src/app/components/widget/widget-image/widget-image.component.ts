import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {WidgetImageContent} from '../../../models/canvas-widget-state.models';
import {CanvasService} from '../../../services/canvas.service';

@Component({
  selector: 'app-widget-image',
  standalone: true,
  templateUrl: './widget-image.component.html',
  styleUrl: './widget-image.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.border-radius.px]': 'innerBorderRadius()',
    '[style.overflow]': '"hidden"',
  },
})
export class WidgetImageComponent {
  private readonly canvasService = inject(CanvasService);

  content = input.required<WidgetImageContent>();
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

    const zoom = Number.isFinite(content.cropZoom) ? Math.max(1, Math.min(5, content.cropZoom as number)) : 1;
    return `scale(${zoom})`;
  });

  protected readonly mediaTransformOrigin = computed(() => this.coverObjectPosition());

  protected get isUrlValid(): boolean {
    return this.canvasService.isValidImageUrl(this.content().src);
  }
}

