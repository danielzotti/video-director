import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {WidgetImageContent} from '../../../models/canvas-widget-state.models';
import {CanvasService} from '../../../services/canvas.service';

@Component({
  selector: 'app-widget-image',
  standalone: true,
  templateUrl: './widget-image.component.html',
  styleUrl: './widget-image.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetImageComponent {
  private readonly canvasService = inject(CanvasService);

  content = input.required<WidgetImageContent>();

  protected get isUrlValid(): boolean {
    return this.canvasService.isValidImageUrl(this.content().src);
  }
}

