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

  protected get isUrlValid(): boolean {
    return this.canvasService.isValidImageUrl(this.content().src);
  }
}

